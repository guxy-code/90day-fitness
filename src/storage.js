import { isDateKey, validateProfile } from './domain.js';

export const STORAGE_KEY = '90day-fitness:v1';
export const DATA_VERSION = 1;

export function createInitialState() { return { version: DATA_VERSION, profile: null, records: {} }; }

export function emptyRecord() { return { completed: false, water: 0, meals: [], weight: null, waist: null, notes: '', steps: 0, sleep: 0 }; }

function plainObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }

function validateRecord(input) {
  if (!plainObject(input)) throw new Error('每日记录格式不正确');
  const record = emptyRecord();
  if (input.completed !== undefined) {
    if (typeof input.completed !== 'boolean') throw new Error('训练打卡状态应为布尔值');
    record.completed = input.completed;
  }
  for (const [key, min, max] of [['water', 0, 20000], ['weight', 20, 350], ['waist', 30, 300], ['steps', 0, 100000], ['sleep', 0, 24]]) {
    if (input[key] === undefined || (input[key] === null && ['weight', 'waist'].includes(key))) continue;
    if (typeof input[key] !== 'number' || !Number.isFinite(input[key]) || input[key] < min || input[key] > max) throw new Error(`${key} 记录超出有效范围`);
    record[key] = input[key];
  }
  if (input.notes !== undefined) {
    if (typeof input.notes !== 'string' || input.notes.length > 2000) throw new Error('备注最多 2000 字');
    record.notes = input.notes;
  }
  if (input.meals !== undefined) {
    if (!Array.isArray(input.meals) || input.meals.length > 50) throw new Error('每日最多记录 50 项饮食');
    record.meals = input.meals.map((meal, index) => {
      if (!plainObject(meal)) throw new Error('饮食记录格式不正确');
      if (typeof meal.name !== 'string' || !meal.name.trim() || meal.name.length > 100) throw new Error('请输入 1–100 字饮食名称');
      const result = { id: typeof meal.id === 'string' ? meal.id.slice(0, 100) : `meal-${index}`, name: meal.name.trim(), calories: 0, protein: 0, meal: 'snack' };
      for (const [key, max] of [['calories', 10000], ['protein', 500]]) {
        if (meal[key] !== undefined) {
          if (typeof meal[key] !== 'number' || !Number.isFinite(meal[key]) || meal[key] < 0 || meal[key] > max) throw new Error('饮食热量或蛋白质超出有效范围');
          result[key] = meal[key];
        }
      }
      if (typeof meal.meal === 'string' && ['breakfast', 'lunch', 'dinner', 'snack'].includes(meal.meal)) result.meal = meal.meal;
      return result;
    });
  }
  return record;
}

export function validateState(input) {
  if (!plainObject(input) || input.version !== DATA_VERSION) throw new Error('备份版本不兼容，请导入本应用导出的 v1 JSON 文件');
  if (!plainObject(input.records) || Object.keys(input.records).length > 5000) throw new Error('每日记录格式或数量不正确');
  const state = createInitialState();
  state.profile = input.profile == null ? null : validateProfile(input.profile);
  for (const [date, record] of Object.entries(input.records)) {
    if (!isDateKey(date)) throw new Error(`记录日期无效：${date.slice(0, 30)}`);
    state.records[date] = validateRecord(record);
  }
  return state;
}

export function loadState(storage = globalThis.localStorage) {
  const value = storage?.getItem(STORAGE_KEY);
  if (!value) return createInitialState();
  try { return validateState(JSON.parse(value)); }
  catch { throw new Error('本地数据无法读取。请先导出原始备份，再选择恢复或清空数据。'); }
}

export function saveState(state, storage = globalThis.localStorage) {
  const validated = validateState(state);
  if (!storage) throw new Error('此浏览器无法保存本地数据，请开启网站存储权限');
  try { storage.setItem(STORAGE_KEY, JSON.stringify(validated)); }
  catch { throw new Error('保存失败：浏览器存储空间不足或已禁用。请导出备份。'); }
  return validated;
}

export function exportData(state) { return JSON.stringify({ ...validateState(state), exportedAt: new Date().toISOString() }, null, 2); }

export function importData(text) {
  if (typeof text !== 'string' || text.length > 5000000) throw new Error('备份文件过大（最多 5 MB）或格式不正确');
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error('无法解析 JSON，请选择本应用导出的备份文件'); }
  return validateState(parsed);
}

export function getRecord(state, date) {
  if (!isDateKey(date)) throw new Error('日期无效');
  const record = state.records[date];
  return record ? { ...emptyRecord(), ...record, meals: [...record.meals] } : emptyRecord();
}

export function updateRecord(state, date, patch) {
  if (!isDateKey(date)) throw new Error('日期无效');
  const next = validateRecord({ ...getRecord(state, date), ...patch });
  return { ...state, records: { ...state.records, [date]: next } };
}
