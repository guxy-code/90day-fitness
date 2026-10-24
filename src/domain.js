/** Date-only arithmetic deliberately uses UTC so DST never changes a plan day. */
export function isDateKey(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export function todayKey(date = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function addDays(date, amount) {
  if (!isDateKey(date) || !Number.isInteger(amount)) throw new Error('日期格式应为 YYYY-MM-DD');
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

export function daysBetween(start, end) {
  if (!isDateKey(start) || !isDateKey(end)) return 0;
  return Math.round((Date.parse(`${end}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) / 86400000);
}

export function dayIndex(startDate, date = todayKey()) {
  return Math.min(90, Math.max(1, daysBetween(startDate, date) + 1));
}

export function createDefaultProfile() {
  return { name: '我的计划', startDate: todayKey(), sex: 'female', age: 30, height: 165, weight: 65, targetWeight: 60, activity: 1.375, level: 'beginner' };
}

export function validateProfile(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('个人信息格式不正确');
  const defaults = createDefaultProfile();
  const profile = { ...defaults };
  profile.name = typeof input.name === 'string' ? input.name.trim().slice(0, 40) : defaults.name;
  profile.name ||= defaults.name;
  if (!isDateKey(input.startDate)) throw new Error('请选择有效的计划开始日期');
  if (!isDateKey(addDays(input.startDate, 89))) throw new Error('开始日期过晚，无法生成完整的 90 天计划');
  profile.startDate = input.startDate;
  if (!['female', 'male'].includes(input.sex)) throw new Error('请选择用于基础代谢估算的生理性别');
  profile.sex = input.sex;
  for (const [key, min, max, label] of [
    ['age', 18, 80, '年龄'], ['height', 130, 220, '身高'], ['weight', 35, 250, '体重'], ['targetWeight', 35, 250, '目标体重'],
  ]) {
    if (typeof input[key] !== 'number' || !Number.isFinite(input[key]) || input[key] < min || input[key] > max) throw new Error(`${label}超出支持范围（${min}–${max}）`);
    profile[key] = input[key];
  }
  if (!Number.isInteger(profile.age)) throw new Error('年龄请填写整数');
  if (![1.2, 1.375, 1.55, 1.725].includes(input.activity)) throw new Error('请选择有效的日常活动水平');
  profile.activity = input.activity;
  if (!['beginner', 'intermediate'].includes(input.level)) throw new Error('请选择有效的训练水平');
  profile.level = input.level;
  return profile;
}

export const PHASES = [
  { id: 1, name: '建立习惯', label: '适应期', start: 1, end: 30, description: '练好动作，找到稳定节奏。每次留有余力，不追求力竭。', color: '#b8c9a2' },
  { id: 2, name: '稳步进阶', label: '进阶期', start: 31, end: 60, description: '在动作稳定的基础上增加一组或次数，逐渐提升力量与耐力。', color: '#dfb876' },
  { id: 3, name: '巩固塑形', label: '巩固期', start: 61, end: 90, description: '保持规律，专注动作质量与恢复，把好习惯带到第 91 天。', color: '#b1abc9' },
];

export function phaseForDay(day) {
  return PHASES[Math.min(2, Math.max(0, Math.floor((Number(day) - 1) / 30)))] || PHASES[0];
}

const exercise = (id, name, instruction, easier, seconds = 0) => ({ id, name, instruction, easier, seconds });
const EXERCISES = {
  squat: exercise('squat', '徒手深蹲', '双脚与肩同宽，髋向后坐；膝盖朝脚尖方向，起身时呼气。全程保持可控。', '扶稳椅背，或坐下再站起，减小下蹲幅度。'),
  bridge: exercise('bridge', '臀桥', '仰卧屈膝，脚跟靠近臀部，收紧臀部抬髋；避免腰部过度后仰。', '缩小抬起幅度，每次顶端停留 1 秒。'),
  lunge: exercise('lunge', '后撤弓步', '交替向后迈步，前脚稳定着地；躯干直立，双膝自然弯曲。每侧完成标注次数。', '扶墙或椅背，做浅幅度后撤步。'),
  calf: exercise('calf', '站姿提踵', '扶稳固定支撑物，慢慢踮脚，顶端稍停，再缓慢落下。', '双脚同时做，减少抬起高度。'),
  wallpush: exercise('wallpush', '斜板俯卧撑', '双手撑牢固墙面或固定台面，身体保持一直线，屈肘靠近再推回。', '站得更靠近墙面做墙壁俯卧撑。'),
  row: exercise('row', '俯身划船', '可使用两只装水的水瓶；髋向后折，背部自然平直，将肘向后拉再缓缓还原。', '不用负重，专注肩胛向后收。'),
  shoulder: exercise('shoulder', '站姿推举', '可持轻水瓶，肋骨回收，双手从肩侧向上推起；肩部无痛范围内活动。', '空手或减小活动幅度。'),
  birddog: exercise('birddog', '鸟狗式', '四点支撑，缓缓伸出对侧手脚；骨盆保持平稳，交替完成。每侧标注次数。', '只抬一只手或一条腿，身体不晃动。'),
  deadbug: exercise('deadbug', '死虫式', '仰卧抬手屈髋屈膝，呼气时对侧手脚缓慢伸远，腰背轻贴地。每侧标注次数。', '手臂保持不动，只交替脚跟点地。'),
  plank: exercise('plank', '前臂平板支撑', '肘在肩正下方，腹部收紧，正常呼吸；腰部下塌前结束。', '双膝落地，缩短保持时间。', 20),
  sideplank: exercise('sideplank', '屈膝侧支撑', '侧卧屈膝，前臂撑地，抬髋成一直线；左右各完成标注时间。', '降低抬髋高度，每次保持 10 秒。', 20),
  march: exercise('march', '原地快走', '自然摆臂，脚步轻落地；保持能说完整句子的呼吸强度。', '放慢速度，降低抬膝高度。', 60),
  step: exercise('step', '侧向并步', '左右迈步并拢，配合自然摆臂，保持膝盖微屈、脚步轻盈。', '缩小步幅，手臂自然下垂。', 45),
  knee: exercise('knee', '交替提膝', '交替提膝到舒适高度，站稳后换侧，避免上身后仰。', '扶墙，降低抬膝高度。', 40),
  walk: exercise('walk', '户外或室内步行', '选择平整路线，用能轻松交谈的速度步行；穿合脚鞋，按体感调整时长。', '拆为多次 5–10 分钟步行。', 900),
  cat: exercise('cat', '猫牛式', '四点支撑，配合呼吸轻柔拱背与伸展；颈部随脊柱自然移动。', '减小幅度，避免挤压腰部。', 60),
  hip: exercise('hip', '髋屈肌拉伸', '半跪姿，收腹，轻轻向前移髋，感受后侧大腿根前方拉伸。每侧标注时间。', '站立前后分腿，扶墙完成。', 30),
  chest: exercise('chest', '胸肩舒展', '双手在背后轻轻交握，肩向后下方放松；正常呼吸，不强拉。', '双手扶髋，轻轻展开胸口。', 30),
  breathing: exercise('breathing', '呼吸放松', '坐或仰卧，一手放腹部，缓慢吸气与呼气，放松肩颈。', '保持自然舒适呼吸，不屏气。', 120),
};

const WEEK = [
  { title: '下肢与臀部', type: 'strength', focus: '腿臀力量 · 稳定基础', ids: ['squat', 'bridge', 'lunge', 'calf', 'deadbug'] },
  { title: '轻有氧与核心', type: 'cardio', focus: '心肺耐力 · 核心控制', ids: ['march', 'step', 'knee', 'birddog', 'plank'] },
  { title: '上肢与背部', type: 'strength', focus: '肩背力量 · 改善体态', ids: ['wallpush', 'row', 'shoulder', 'birddog', 'deadbug'] },
  { title: '主动恢复', type: 'recovery', focus: '轻松活动 · 充分恢复', ids: ['walk', 'cat', 'hip', 'chest', 'breathing'] },
  { title: '全身力量', type: 'strength', focus: '全身协同 · 稳步进阶', ids: ['squat', 'wallpush', 'bridge', 'row', 'sideplank'] },
  { title: '活力步行与拉伸', type: 'cardio', focus: '轻快步行 · 释放压力', ids: ['walk', 'step', 'knee', 'hip', 'chest'] },
  { title: '休息与复盘', type: 'rest', focus: '休息也是计划的一部分', ids: ['cat', 'chest', 'breathing'] },
];

export function getWorkout(day, { level = 'beginner' } = {}) {
  const safeDay = Math.min(90, Math.max(1, Math.floor(Number(day) || 1)));
  const phase = phaseForDay(safeDay);
  const template = WEEK[(safeDay - 1) % 7];
  const recovery = ['recovery', 'rest'].includes(template.type);
  const progression = phase.id - 1;
  const advanced = level === 'intermediate' ? 1 : 0;
  const sets = recovery ? 1 : Math.min(4, 2 + progression + advanced);
  const exercises = template.ids.map(id => {
    const item = EXERCISES[id];
    const seconds = item.seconds ? (id === 'walk' ? 900 + progression * 300 : item.seconds + (!recovery ? progression * 5 : 0)) : 0;
    return { ...item, sets: id === 'walk' || recovery ? 1 : sets, reps: seconds ? null : 8 + progression * 2 + advanced * 2, seconds, rest: recovery ? 15 : 45 + progression * 5 };
  });
  return {
    day: safeDay, phase, title: template.title, type: template.type, focus: template.focus,
    duration: template.type === 'rest' ? 8 : template.type === 'recovery' ? 25 : 25 + progression * 5 + advanced * 5,
    exercises,
    warmup: recovery ? '从自然呼吸和轻柔活动开始。' : '先原地慢走 2 分钟，再做肩环绕、髋部活动与浅蹲，共 5 分钟。',
    cooldown: '用 3–5 分钟慢走与轻柔拉伸结束，拉伸保持舒适、不弹震。',
    intensity: recovery ? '轻松，RPE 2–3 / 10' : `适中，RPE ${phase.id === 1 ? '4–5' : '5–6'} / 10；每组保留 2–3 次余力`,
  };
}

export function getPlan(profile = {}) {
  return Array.from({ length: 90 }, (_, index) => ({ ...getWorkout(index + 1, profile), date: isDateKey(profile.startDate) ? addDays(profile.startDate, index) : null }));
}

export function calculateTargets(profile) {
  const p = validateProfile(profile);
  const bmr = 10 * p.weight + 6.25 * p.height - 5 * p.age + (p.sex === 'male' ? 5 : -161);
  const maintenance = Math.round(bmr * p.activity);
  const bmi = p.weight / (p.height / 100) ** 2;
  const targetBmi = p.targetWeight / (p.height / 100) ** 2;
  const losing = p.targetWeight < p.weight && bmi >= 18.5 && targetBmi >= 18.5;
  const deficit = losing ? Math.min(350, maintenance * 0.15) : 0;
  const minimumCalories = p.sex === 'male' ? 1500 : 1200;
  const calories = Math.round(Math.max(minimumCalories, maintenance - deficit));
  const protein = Math.round(p.weight * 1.6);
  const fat = Math.round(calories * 0.3 / 9);
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));
  return {
    bmr: Math.round(bmr), maintenance, tdee: maintenance, calories, protein, fat, carbs,
    water: Math.min(3500, Math.max(1500, Math.round(p.weight * 30 / 100) * 100)),
    bmi: Math.round(bmi * 10) / 10,
    weeklyLoss: losing ? Math.max(0, Math.round((maintenance - calories) * 7 / 7700 * 100) / 100) : 0,
    guidance: targetBmi < 18.5 || bmi < 18.5 ? '当前或目标 BMI 偏低，建议以维持体重、提升力量为主，先与专业人员讨论目标。' : maintenance < minimumCalories ? '公式估算的维持热量偏低，已避免继续降低热量。请与营养专业人员讨论个体需求，不按公式追求减重。' : '热量与营养目标为估算值，观察 2–3 周趋势后小幅调整；不以单日体重判断进展。',
  };
}

export function getStats(state, date = todayKey()) {
  const records = state?.records || {};
  const start = state?.profile?.startDate || date;
  const end = addDays(start, 89);
  const measurements = Object.entries(records).filter(([key]) => isDateKey(key) && key <= date).sort(([a], [b]) => a.localeCompare(b));
  const entries = measurements.filter(([key]) => key >= start && key <= end);
  const completed = entries.filter(([, record]) => record.completed).length;
  let cursor = records[date]?.completed ? date : addDays(date, -1);
  let streak = 0;
  while (cursor >= start && cursor <= end && records[cursor]?.completed) { streak += 1; cursor = addDays(cursor, -1); }
  const weights = measurements.filter(([, record]) => typeof record.weight === 'number' && Number.isFinite(record.weight)).map(([day, record]) => ({ date: day, weight: record.weight }));
  const currentWeight = weights.at(-1)?.weight ?? state?.profile?.weight ?? null;
  return { completed, streak, progress: Math.round(completed / 90 * 100), currentDay: dayIndex(start, date), currentWeight, weightChange: currentWeight != null && state?.profile ? Math.round((currentWeight - state.profile.weight) * 10) / 10 : 0, weights, totalMinutes: entries.filter(([, r]) => r.completed).reduce((total, [key]) => total + getWorkout(dayIndex(start, key), state.profile || {}).duration, 0) };
}
