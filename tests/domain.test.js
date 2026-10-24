import test from 'node:test';
import assert from 'node:assert/strict';
import { addDays, calculateTargets, createDefaultProfile, dayIndex, daysBetween, getPlan, getStats, getWorkout, isDateKey, phaseForDay, todayKey, validateProfile } from '../src/domain.js';

test('date-only calculations handle leap days, month/year boundaries and DST', () => {
  assert.equal(addDays('2024-02-28', 1), '2024-02-29');
  assert.equal(addDays('2025-12-31', 1), '2026-01-01');
  assert.equal(addDays('2026-03-07', 3), '2026-03-10');
  assert.equal(daysBetween('2026-03-07', '2026-03-10'), 3);
  assert.equal(isDateKey('2025-02-29'), false);
  assert.equal(isDateKey('2026-13-01'), false);
  assert.equal(isDateKey('__proto__'), false);
  assert.throws(() => addDays('bad', 1));
  assert.equal(dayIndex('2026-01-01', '2025-12-01'), 1);
  assert.equal(dayIndex('2026-01-01', '2026-12-01'), 90);
  assert.equal(todayKey(new Date(2026, 0, 2, 0, 1)), '2026-01-02');
});

test('90 day program covers every date and phase with scheduled rest', () => {
  const profile = { ...createDefaultProfile(), startDate: '2026-01-01' };
  const plan = getPlan(profile);
  assert.equal(plan.length, 90);
  assert.equal(plan[0].date, '2026-01-01');
  assert.equal(plan.at(-1).date, '2026-03-31');
  assert.deepEqual([phaseForDay(30).id, phaseForDay(31).id, phaseForDay(60).id, phaseForDay(61).id], [1, 2, 2, 3]);
  assert.equal(plan.filter(w => w.type === 'rest').length, 12);
  assert.ok(plan.filter(w => w.type === 'recovery').length >= 12);
  for (const workout of plan) {
    assert.ok(workout.exercises.length >= 3);
    assert.ok(workout.warmup && workout.cooldown && workout.intensity);
    for (const exercise of workout.exercises) assert.ok(exercise.instruction && exercise.easier && exercise.sets > 0 && (exercise.reps > 0 || exercise.seconds > 0));
  }
  assert.ok(getWorkout(64).exercises[0].sets > getWorkout(1).exercises[0].sets);
  assert.equal(getWorkout(91).day, 90);
  assert.equal(getWorkout(-10).day, 1);
});

test('calorie targets use Mifflin and moderate deficit without unsafe weight loss target', () => {
  const p = { ...createDefaultProfile(), age: 30, height: 165, weight: 65, targetWeight: 60, sex: 'female', activity: 1.375 };
  const targets = calculateTargets(p);
  assert.equal(targets.bmr, 1370);
  assert.equal(targets.tdee, 1884);
  assert.equal(targets.calories, 1601);
  assert.equal(targets.protein, 104);
  assert.equal(targets.water, 2000);
  assert.ok(targets.weeklyLoss > 0 && targets.weeklyLoss < 0.5);
  const underweightGoal = calculateTargets({ ...p, targetWeight: 40 });
  assert.equal(underweightGoal.weeklyLoss, 0);
  assert.equal(underweightGoal.calories, underweightGoal.tdee);
  assert.match(underweightGoal.guidance, /偏低/);
  assert.equal(calculateTargets({ ...p, targetWeight: 70 }).calories, targets.tdee);
});

test('profile validation rejects invalid inputs without implicit coercion', () => {
  const p = createDefaultProfile();
  for (const invalid of [{ age: 17 }, { age: Infinity }, { weight: '65' }, { height: NaN }, { activity: 100 }, { startDate: '2026-02-30' }, { startDate: '9999-12-01' }, { sex: 'x' }, { level: 'expert' }]) {
    assert.throws(() => validateProfile({ ...p, ...invalid }));
  }
  assert.equal(validateProfile({ ...p, name: '  小林  ', untrusted: 'removed' }).name, '小林');
  assert.equal(validateProfile({ ...p, untrusted: 'removed' }).untrusted, undefined);
});

test('low estimated maintenance never becomes an extreme calorie recommendation', () => {
  const p = { ...createDefaultProfile(), age: 80, height: 130, weight: 35, targetWeight: 34, activity: 1.2 };
  for (const [sex, floor] of [['female', 1200], ['male', 1500]]) {
    const targets = calculateTargets({ ...p, targetWeight: 35, sex });
    assert.ok(targets.maintenance < floor);
    assert.equal(targets.calories, floor);
    assert.equal(targets.weeklyLoss, 0);
    assert.match(targets.guidance, /偏低/);
  }
});

test('statistics bound plan completion while retaining measurement history', () => {
  const profile = { ...createDefaultProfile(), startDate: '2026-01-01', weight: 65 };
  const state = { profile, records: {
    '2025-12-31': { completed: true, weight: 70 },
    '2026-01-01': { completed: true, weight: 64.8 },
    '2026-01-02': { completed: true },
    '2026-01-03': { completed: false, weight: 64.5 },
    '2026-01-04': { completed: true, weight: 64.2 },
    '2026-01-05': { completed: true, weight: 60 },
  } };
  const stats = getStats(state, '2026-01-04');
  assert.equal(stats.completed, 3);
  assert.equal(stats.streak, 1);
  assert.equal(stats.currentWeight, 64.2);
  assert.equal(stats.weightChange, -0.8);
  assert.equal(stats.weights.length, 4);
  assert.equal(getStats(state, '2026-01-03').streak, 2);
  assert.equal(getStats({ profile, records: {} }, '2026-01-01').currentWeight, 65);
});

test('measurements continue after day90 while plan totals remain bounded', () => {
  const profile = { ...createDefaultProfile(), startDate: '2026-01-01', weight: 65 };
  const state = { profile, records: {
    '2026-01-01': { completed: true, weight: 65 },
    '2026-03-31': { completed: true, weight: 62 },
    '2026-04-01': { completed: true, weight: 61.8 },
    '2026-04-02': { completed: true, weight: 60 },
  } };
  const stats = getStats(state, '2026-04-01');
  assert.equal(stats.currentDay, 90);
  assert.equal(stats.completed, 2);
  assert.equal(stats.currentWeight, 61.8);
  assert.equal(stats.weightChange, -3.2);
  assert.deepEqual(stats.weights.map(p => p.date), ['2026-01-01', '2026-03-31', '2026-04-01']);
  assert.equal(stats.totalMinutes, getWorkout(1, profile).duration + getWorkout(90, profile).duration);
});
