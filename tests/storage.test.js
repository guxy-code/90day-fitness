import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultProfile } from '../src/domain.js';
import { createInitialState, exportData, getRecord, importData, loadState, saveState, STORAGE_KEY, updateRecord, validateState } from '../src/storage.js';

const populated = () => ({ ...createInitialState(), profile: createDefaultProfile() });
function memoryStorage() {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
}

test('state round trip persists profile, meals and measurements without mutating source', () => {
  const original = populated();
  const next = updateRecord(original, '2026-01-02', { completed: true, water: 1500, weight: 64.8, waist: 80, notes: '状态不错', meals: [{ id: 'a', name: '燕麦牛奶', calories: 300, protein: 15, meal: 'breakfast' }] });
  assert.equal(Object.keys(original.records).length, 0);
  assert.equal(getRecord(next, '2026-01-02').meals[0].meal, 'breakfast');
  const storage = memoryStorage();
  saveState(next, storage);
  assert.deepEqual(loadState(storage), next);
  assert.deepEqual(importData(exportData(next)), next);
});

test('getRecord creates independent defaults and update retains previous fields', () => {
  let state = populated();
  const missing = getRecord(state, '2026-01-02');
  missing.meals.push({ name: 'external' });
  assert.deepEqual(getRecord(state, '2026-01-02').meals, []);
  state = updateRecord(state, '2026-01-02', { water: 250, completed: true });
  state = updateRecord(state, '2026-01-02', { water: 500 });
  assert.equal(getRecord(state, '2026-01-02').completed, true);
  assert.equal(getRecord(state, '2026-01-02').water, 500);
});

test('malformed backups, unknown versions, polluted dates and invalid values are rejected', () => {
  assert.throws(() => importData('not json'), /JSON/);
  assert.throws(() => importData('{}'), /版本/);
  assert.throws(() => importData(JSON.stringify({ version: 2, profile: null, records: {} })), /版本/);
  assert.throws(() => importData('{"version":1,"profile":null,"records":{"__proto__":{"completed":true}}}'), /日期/);
  assert.throws(() => validateState({ ...populated(), records: [] }), /格式/);
  for (const patch of [{ water: -1 }, { water: Infinity }, { weight: 0 }, { waist: 999 }, { steps: 100001 }, { sleep: 25 }, { completed: 'yes' }, { meals: [{ name: 'rice', calories: -1 }] }, { notes: 'x'.repeat(2001) }]) {
    assert.throws(() => updateRecord(populated(), '2026-01-02', patch));
  }
  assert.throws(() => updateRecord(populated(), '2026-02-30', {}), /日期/);
});

test('corrupt storage is retained for recovery and quota failures are actionable', () => {
  const storage = memoryStorage();
  storage.setItem(STORAGE_KEY, '{bad');
  assert.throws(() => loadState(storage), /备份/);
  assert.equal(storage.getItem(STORAGE_KEY), '{bad');
  assert.throws(() => saveState(populated(), { setItem() { throw new Error('QuotaExceeded'); } }), /保存失败/);
  assert.deepEqual(loadState(memoryStorage()), createInitialState());
});
