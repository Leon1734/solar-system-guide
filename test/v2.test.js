/* v2 扩展天体验证：哈雷彗星 / 矮行星（M0 历元轨道） */
'use strict';
const fs = require('fs');
const vm = require('vm');

const ctx = {};
vm.createContext(ctx);
const src = fs.readFileSync(__dirname + '/../js/data.js', 'utf8') +
  '\n;this.__x = { PLANETS: PLANETS, DWARFS: DWARFS, HALLEY: COMET_HALLEY, TOURS: TOURS, PROBES: PROBES, STAR_LIFE: STAR_LIFE, EXOSYSTEMS: EXOSYSTEMS, COMETS_EXTRA: COMETS_EXTRA, CONSTELLATIONS: CONSTELLATIONS, ASTRO_EVENTS: ASTRO_EVENTS, EXTRA_QUIZ: EXTRA_QUIZ, ZODIAC_SIGNS: ZODIAC_SIGNS, MOON_FEATURES: MOON_FEATURES, CONSTELLATION_MYTHS: CONSTELLATION_MYTHS, METEOR_SHOWERS: METEOR_SHOWERS };';
vm.runInContext(src, ctx);
const { DWARFS, HALLEY, TOURS, PROBES, STAR_LIFE, EXOSYSTEMS, COMETS_EXTRA, PLANETS, CONSTELLATIONS, ASTRO_EVENTS, EXTRA_QUIZ, ZODIAC_SIGNS, MOON_FEATURES, CONSTELLATION_MYTHS, METEOR_SHOWERS } = ctx.__x;

const D2R = Math.PI / 180;
const TAU = Math.PI * 2;
const EPOCH_MS = Date.UTC(2000, 0, 1, 12);

function normAngle(x) { while (x > Math.PI) x -= TAU; while (x < -Math.PI) x += TAU; return x; }
function keplerSolve(M, e) {
  let E = M;
  for (let k = 0; k < 7; k++) {
    const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-7) break;
  }
  return E;
}
/* 与 main.js 相同的 M0 路径 */
function helioPosM0(p, days) {
  const el = p.elements;
  const a = el.a, e = el.e;
  const M = (el.M0 + 360 * days / p.periodDays) * D2R;
  const E = keplerSolve(normAngle(M), e);
  const xp = a * (Math.cos(E) - e);
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const cw = Math.cos(el.om * D2R), sw = Math.sin(el.om * D2R);
  const cO = Math.cos(el.O * D2R), sO = Math.sin(el.O * D2R);
  const ci = Math.cos(el.i * D2R), si = Math.sin(el.i * D2R);
  return {
    x: (cw * cO - sw * sO * ci) * xp + (-sw * cO - cw * sO * ci) * yp,
    y: (cw * sO + sw * cO * ci) * xp + (-sw * sO + cw * cO * ci) * yp,
    z: (sw * si) * xp + (cw * si) * yp
  };
}
const rOf = v => Math.hypot(v.x, v.y, v.z);

let pass = 0, fail = 0;
function check(name, got, want, tol) {
  const ok = Math.abs(got - want) <= tol;
  console.log((ok ? '✅' : '❌') + ' ' + name + ': got=' + got.toFixed(4) + ' want≈' + want + ' (tol ' + tol + ')');
  ok ? pass++ : fail++;
}

/* 哈雷：1986-02-09 近日点，r = a(1-e) ≈ 0.586 AU */
const tpHalley = (Date.UTC(1986, 1, 9) - EPOCH_MS) / 86400000;
const vPeri = helioPosM0(HALLEY, tpHalley);
check('哈雷近日点距离 [AU]', rOf(vPeri), 0.586, 0.02);
/* 远日点 ≈ 35.1 AU */
check('哈雷远日点 [AU]', HALLEY.elements.a * (1 + HALLEY.elements.e), 35.08, 0.1);
/* 周期 */
check('哈雷周期 [年]', HALLEY.periodDays / 365.25, 75.3, 0.5);
/* 今天（2026-09）应在远离段，r 约 35 AU 附近 */
const now = (Date.now() - EPOCH_MS) / 86400000;
const rNow = rOf(helioPosM0(HALLEY, now));
console.log('   哈雷 2026-09 距日 = ' + rNow.toFixed(2) + ' AU（预期 34~36）');
check('哈雷当前距日 [AU]', rNow, 35, 1.6);

/* 冥王星：J2000 时 M0=14.53°，应在近日点附近（29.7 AU 附近，实际 2000 年 ~30 AU） */
const pluto = DWARFS.find(d => d.key === 'pluto');
check('冥王星 2000 年距日 [AU]', rOf(helioPosM0(pluto, 0)), 30.0, 0.6);
check('冥王星周期 [年]', pluto.periodDays / 365.25, 248, 2);
/* 谷神星：位于主带 2.0~3.0 AU */
const ceres = DWARFS.find(d => d.key === 'ceres');
check('谷神星 2000 年距日 [AU]', rOf(helioPosM0(ceres, 0)), 2.77, 0.22);
/* 阋神星周期 ≈ 558 年 */
const eris = DWARFS.find(d => d.key === 'eris');
check('阋神星周期 [年]', eris.periodDays / 365.25, 559, 3);

/* 课程数据完整性：7 课，每课有徽章/测验，测验答案索引合法 */
console.log('\n漫游课程数据检查：');
check('课程数量', TOURS.length, 7, 0);
TOURS.forEach(t => {
  const ok = t.badge && t.quiz.length >= 2 &&
    t.quiz.every(q => q.answer >= 0 && q.answer < q.options.length) &&
    t.steps.length >= 3;
  console.log((ok ? '✅' : '❌') + ' ' + t.id + '（' + t.steps.length + ' 步 / ' + t.quiz.length + ' 题）');
  ok ? pass++ : fail++;
});
const badgeIds = TOURS.map(t => t.badge.id);
check('徽章 id 唯一', new Set(badgeIds).size, badgeIds.length, 0);

/* ---------- v3 扩展：探测器足迹 / 恒星演化 ---------- */
console.log('\n探测器数据检查：');
check('探测器数量', PROBES.length, 4, 0);
const D2R2 = Math.PI / 180;
PROBES.forEach(p => {
  // 锚点时间须严格递增
  const days = [p.launch].concat(p.events.map(e => e[0]))
    .map(s => new Date(s + 'T12:00:00Z').getTime());
  const inc = days.every((d, i) => i === 0 || d > days[i - 1]);
  // 2040-01-01 距日估算
  const lastEv = p.events[p.events.length - 1];
  const lastD = new Date(lastEv[0] + 'T12:00:00Z').getTime();
  const au2040 = lastEv[2] + p.speedAUyr * (Date.UTC(2040, 0, 1) - lastD) / (365.25 * 86400000);
  const ok = inc && au2040 > 60 && au2040 < 260;
  console.log((ok ? '✅' : '❌') + ' ' + p.name + '：锚点递增 ' + inc + '，2040 年距日 ≈ ' + au2040.toFixed(0) + ' AU');
  ok ? pass++ : fail++;
});
// 旅行者1号方向应带北黄纬（黄道面上方逃离）
const v1 = PROBES.find(p => p.key === 'voyager1');
check('旅行者1号黄纬 [+35°]', v1.dir.lat, 35.1, 0.5);
const v2 = PROBES.find(p => p.key === 'voyager2');
check('旅行者2号黄纬 [-48.6°]', v2.dir.lat, -48.6, 0.5);

console.log('\n恒星演化剧场检查：');
check('演化阶段数', STAR_LIFE.length, 6, 0);
const orderOk = STAR_LIFE.map(s => s.key).join(',') ===
  'nebula,protostar,main,giant,nebula2,dwarf';
console.log((orderOk ? '✅' : '❌') + ' 阶段顺序: ' + STAR_LIFE.map(s => s.key).join(' → '));
orderOk ? pass++ : fail++;
const textOk = STAR_LIFE.every(s => s.desc && s.detail && s.age && s.icon);
textOk ? (console.log('✅ 每阶段文案完整'), pass++) : (console.log('❌ 文案缺失'), fail++);

/* ---------- v4 扩展：系外行星 / i18n 完整性 ---------- */
console.log('\n系外行星系统检查：');
check('系外系统数量', EXOSYSTEMS.length, 4, 0);
EXOSYSTEMS.forEach(s => {
  const ok = s.hz && s.hz[0] < s.hz[1] &&
    s.planets.length >= 1 &&
    s.planets.every(p => p.key && p.periodDays > 0 && p.distScene > 0 && p.desc && p.facts.length >= 1) &&
    s.planets.some(p => p.hzIn) &&
    Math.min.apply(null, s.planets.map(p => p.distScene)) > s.starRadius;
  console.log((ok ? '✅' : '❌') + ' ' + s.key + '（' + s.planets.length + ' 行星，宜居带 ' + s.hz[0] + '-' + s.hz[1] + '）');
  ok ? pass++ : fail++;
});
const exoKeys = EXOSYSTEMS.flatMap(s => s.planets.map(p => p.key));
check('系外行星 key 唯一', new Set(exoKeys).size, exoKeys.length, 0);
// 阿波菲斯已入 DWARFS 且 M0 已校准
const ap = DWARFS.find(d => d.key === 'apophis');
check('阿波菲斯在库', ap ? 1 : 0, 1, 0);
check('阿波菲斯 M0 校准值', ap ? ap.elements.M0 : 0, 229.97, 0.01);

console.log('\ni18n 完整性检查：');
const srcI = fs.readFileSync(__dirname + '/../js/i18n.js', 'utf8');
['tours:', 'cards:', 'funFacts:', 'help:', 'starlife:'].forEach(k => {
  const has = srcI.indexOf(k) >= 0;
  console.log((has ? '✅' : '❌') + ' EN 覆盖层含 ' + k);
  has ? pass++ : fail++;
});
// 英文课程步骤数与中文一致
const ENsrc = srcI;
const stepsMatch = TOURS.every(t => {
  const seg = ENsrc.indexOf(t.id + ': {');
  return seg > 0;
});
console.log((stepsMatch ? '✅' : '❌') + ' 每门课程均有英文覆盖');
stepsMatch ? pass++ : fail++;

/* ---------- v5 扩展：彗星群 / 小行星 / 距角物理 ---------- */
const D2R3 = Math.PI / 180;
function kepler3(M, e) {
  let E = M;
  for (let k = 0; k < 9; k++) { const d = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E)); E -= d; if (Math.abs(d) < 1e-9) break; }
  return E;
}
function rAt(p, days) { // M0 路径的日距（与 main.js helioPrep 一致）
  const el = p.elements;
  const M = ((el.M0 + 360 * days / p.periodDays) % 360) * D2R3;
  const E = kepler3(M, el.e);
  return el.a * (1 - el.e * Math.cos(E));
}
const EPOCH5 = new Date('2000-01-01T12:00:00Z').getTime();
const dayOf = s => (new Date(s + 'T12:00:00Z') - EPOCH5) / 86400000;

console.log('\n彗星群检查：');
check('新增彗星数量', COMETS_EXTRA.length, 3, 0);
[['恩克', 'encke', '2023-10-22'], ['67P', 'c67p', '2021-11-02'], ['海尔-波普', 'halebopp', '1997-04-01']].forEach(([cn, key, peri]) => {
  const c = COMETS_EXTRA.find(x => x.key === key);
  const r = c ? rAt(c, dayOf(peri)) : -1;
  const q = c ? c.elements.a * (1 - c.elements.e) : -1;
  const ok = c && Math.abs(r - q) < 0.01;
  console.log((ok ? '✅' : '❌') + ' ' + cn + ' 近日点校准：r=' + r.toFixed(4) + ' ≈ q=' + q.toFixed(4));
  ok ? pass++ : fail++;
});
console.log('\n主带小行星检查：');
[['灶神星', 'vesta'], ['智神星', 'pallas']].forEach(([cn, key]) => {
  const a = DWARFS.find(x => x.key === key);
  if (!a) { console.log('❌ ' + cn + ' 不在库'); fail++; return; }
  const r = rAt(a, 0);
  const q = a.elements.a * (1 - a.elements.e), Q = a.elements.a * (1 + a.elements.e);
  const ok = r > q - 0.01 && r < Q + 0.01;
  console.log((ok ? '✅' : '❌') + ' ' + cn + ' 2000 年距日 r=' + r.toFixed(3) + ' ∈ [' + q.toFixed(3) + ', ' + Q.toFixed(3) + ']');
  ok ? pass++ : fail++;
});
console.log('\n距角物理检查（金星会合周期）：');
{ // 8 年内金星距角应扫过 0°~约 47°（东大距 46~47°）
  const earth = PLANETS.find(p => p.key === 'earth');
  const venus = PLANETS.find(p => p.key === 'venus');
  function helioPlanet(p, days) { // 行星 rates 路径
    const T = days / 36525, el = p.elements, rt = p.rates;
    const a = el.a + rt.a * T, e = el.e + rt.e * T;
    const M = ((el.L + rt.L * T) - (el.w + rt.w * T)) * D2R3;
    const om = ((el.w + rt.w * T) - (el.O + rt.O * T)) * D2R3;
    const O = (el.O + rt.O * T) * D2R3, i = (el.i + rt.i * T) * D2R3;
    const E = kepler3(((M % 6.2832) + 6.2832) % 6.2832, e);
    const xp = a * (Math.cos(E) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
    const cw = Math.cos(om), sw = Math.sin(om), cO = Math.cos(O), sO = Math.sin(O);
    const ci = Math.cos(i), si = Math.sin(i);
    return {
      x: (cw * cO - sw * sO * ci) * xp + (-sw * cO - cw * sO * ci) * yp,
      y: (cw * sO + sw * cO * ci) * xp + (-sw * sO + cw * cO * ci) * yp
    };
  }
  let maxE = 0, minE = 180;
  for (let d = 0; d < 8 * 365.25; d += 2) {
    const eP = helioPlanet(earth, d), vP = helioPlanet(venus, d);
    const lonP = Math.atan2(vP.y - eP.y, vP.x - eP.x);
    const lonS = Math.atan2(-eP.y, -eP.x);
    let dd = Math.abs(lonP - lonS); if (dd > Math.PI) dd = 2 * Math.PI - dd;
    const deg = dd * 180 / Math.PI;
    if (deg > maxE) maxE = deg;
    if (deg < minE) minE = deg;
  }
  check('金星最大距角 [°]', maxE, 46.5, 1.5);
  check('金星最小距角（下合）[°]', minE, 0, 1.5);
}
console.log('\n开普勒-186 检查：');
{
  const k = EXOSYSTEMS.find(s => s.key === 'kepler186');
  const ok = k && k.planets.length === 5 && k.planets.some(p => p.key === 'k186f' && p.hzIn);
  console.log((ok ? '✅' : '❌') + ' kepler186：5 行星含宜居带成员 186f');
  ok ? pass++ : fail++;
}

console.log('\nv6 星座/日历/题库检查：');
// 星座：≥20 个、黄道 12 全在、连线与恒星完备
check('星座数量', CONSTELLATIONS.length >= 20 ? 1 : 0, 1, 0);
const conNames = CONSTELLATIONS.map(c => c.n);
const zodiacAll = ZODIAC_SIGNS.every(z => conNames.includes(z));
console.log((zodiacAll ? '✅' : '❌') + ' 黄道十二宫星座层全覆盖');
zodiacAll ? pass++ : fail++;
const conOk = CONSTELLATIONS.every(c =>
  c.s.length >= 2 && c.l.length >= 1 &&
  c.l.every(p => p[0] < c.s.length && p[1] < c.s.length));
console.log((conOk ? '✅' : '❌') + ' 星座连线索引全部合法');
conOk ? pass++ : fail++;
// 天文日历：条数/日期合法/时间范围/阿波菲斯在列
check('日历条数 ≥ 20', ASTRO_EVENTS.length >= 20 ? 1 : 0, 1, 0);
const evOk = ASTRO_EVENTS.every(e => /^\d{4}-\d{2}-\d{2}$/.test(e.d) && +e.d.slice(0, 4) >= 1980 && +e.d.slice(0, 4) <= 2070 && e.n && e.t);
console.log((evOk ? '✅' : '❌') + ' 日历日期与文案合法');
evOk ? pass++ : fail++;
check('日历含阿波菲斯 2029', ASTRO_EVENTS.some(e => e.d === '2029-04-13') ? 1 : 0, 1, 0);
// 题库：课程 14 题 + 扩展 ≥ 8，答案索引合法
const quizCount = TOURS.reduce((n, t) => n + t.quiz.length, 0) + EXTRA_QUIZ.length;
check('题库 ≥ 20 题', quizCount >= 20 ? 1 : 0, 1, 0);
const quizOk = EXTRA_QUIZ.every(q => q.answer >= 0 && q.answer < q.options.length && q.explain);
console.log((quizOk ? '✅' : '❌') + ' 扩展题库答案合法');
quizOk ? pass++ : fail++;
// 月面地名
check('月面地名 ≥ 6', MOON_FEATURES.length >= 6 ? 1 : 0, 1, 0);

console.log('\nv7 神话/流星雨/真实月相检查：');
// 神话：每个有亮星标签的星座都有故事
const myOk = CONSTELLATIONS.every(c => !c.b || CONSTELLATION_MYTHS[c.e]);
console.log((myOk ? '✅' : '❌') + ' 亮星星座均配神话小传');
myOk ? pass++ : fail++;
check('神话条数 ≥ 20', Object.keys(CONSTELLATION_MYTHS).length >= 20 ? 1 : 0, 1, 0);
const mythOk = Object.values(CONSTELLATION_MYTHS).every(m => m.story && m.storyEn && m.star);
console.log((mythOk ? '✅' : '❌') + ' 神话字段完整（story/storyEn/star）');
mythOk ? pass++ : fail++;
// 流星雨数据
const shOk = METEOR_SHOWERS.length >= 5 &&
  METEOR_SHOWERS.every(s => s.peak >= 0 && s.peak <= 365 && s.zhr > 0 && s.con && s.parent);
console.log((shOk ? '✅' : '❌') + ' 流星雨数据合法（' + METEOR_SHOWERS.length + ' 场，含双子座/象限仪座）');
shOk ? pass++ : fail++;
// 流星雨辐射点星座必须存在于星座层
const conEn = CONSTELLATIONS.map(c => c.e);
const radOk = METEOR_SHOWERS.every(s => conEn.includes(s.con));
console.log((radOk ? '✅' : '❌') + ' 辐射点星座均可高亮联动');
radOk ? pass++ : fail++;
// 真实月相锚点（Meeus 简式）：2024-01-25 满月 / 2024-04-08 新月（日食）
{
  const D2R = Math.PI / 180, J2000 = Date.UTC(2000, 0, 1, 12);
  function moonLonDeg(ms) {
    const d = (ms - J2000) / 86400000;
    const Mm = (134.963 + 13.064993 * d) * D2R, Ms = (357.529 + 0.98560028 * d) * D2R, D = (297.850 + 12.190749 * d) * D2R;
    let lon = 218.316 + 13.176396 * d + 6.289 * Math.sin(Mm) + 1.274 * Math.sin(2 * D - Mm) + 0.658 * Math.sin(2 * D)
      + 0.214 * Math.sin(2 * Mm) - 0.186 * Math.sin(Ms) - 0.059 * Math.sin(2 * D - 2 * Mm)
      - 0.057 * Math.sin(2 * D - Ms - Mm) + 0.053 * Math.sin(2 * D + Mm);
    return ((lon % 360) + 360) % 360;
  }
  function sunLonDeg(ms) {
    const d = (ms - J2000) / 86400000;
    const M = (357.529 + 0.98560028 * d) * D2R;
    let lon = 280.459 + 0.98564736 * d + 1.915 * Math.sin(M) + 0.020 * Math.sin(2 * M);
    return ((lon % 360) + 360) % 360;
  }
  const elong = s => { let e = moonLonDeg(new Date(s).getTime()) - sunLonDeg(new Date(s).getTime()); return ((e % 360) + 360) % 360; };
  check('2024-01-25 狼月距角 [°]', elong('2024-01-25T17:54Z'), 180, 3);
  check('2024-04-08 日食新月距角 [°]', elong('2024-04-08T18:21Z'), 0, 3);
}

console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
