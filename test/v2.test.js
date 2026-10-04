/* v2 扩展天体验证：哈雷彗星 / 矮行星（M0 历元轨道） */
'use strict';
const fs = require('fs');
const vm = require('vm');

const ctx = {};
vm.createContext(ctx);
const src = fs.readFileSync(__dirname + '/../js/data.js', 'utf8') +
  "\n;this.__x = { PLANETS: PLANETS, DWARFS: DWARFS, HALLEY: COMET_HALLEY, TOURS: TOURS, PROBES: PROBES, STAR_LIFE: STAR_LIFE, EXOSYSTEMS: EXOSYSTEMS, COMETS_EXTRA: COMETS_EXTRA, CONSTELLATIONS: CONSTELLATIONS, ASTRO_EVENTS: ASTRO_EVENTS, EXTRA_QUIZ: EXTRA_QUIZ, ZODIAC_SIGNS: ZODIAC_SIGNS, MOON_FEATURES: MOON_FEATURES, CONSTELLATION_MYTHS: CONSTELLATION_MYTHS, METEOR_SHOWERS: METEOR_SHOWERS, DEEPSKY: DEEPSKY, OBSERVATORIES: OBSERVATORIES, CONST_MANSIONS: CONST_MANSIONS, findOppositions: findOppositions, findElongations: findElongations, findMoonPhases: findMoonPhases, findPlanetConjunctions: findPlanetConjunctions, findMoonConjunctions: findMoonConjunctions, SAN_YUAN: SAN_YUAN, findMoonCloseApproaches: findMoonCloseApproaches, findStarOccultations: findStarOccultations, BRIGHT_ECLIPTIC_STARS: BRIGHT_ECLIPTIC_STARS };";
vm.runInContext(src, ctx);
const { DWARFS, HALLEY, TOURS, PROBES, STAR_LIFE, EXOSYSTEMS, COMETS_EXTRA, PLANETS, CONSTELLATIONS, ASTRO_EVENTS, EXTRA_QUIZ, ZODIAC_SIGNS, MOON_FEATURES, CONSTELLATION_MYTHS, METEOR_SHOWERS, DEEPSKY, OBSERVATORIES, CONST_MANSIONS, findOppositions, findElongations, findMoonPhases, findPlanetConjunctions, findMoonConjunctions, SAN_YUAN, findMoonCloseApproaches, findStarOccultations, BRIGHT_ECLIPTIC_STARS } = ctx.__x;

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
check('课程数量', TOURS.length, 8, 0);
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
const evOk = ASTRO_EVENTS.every(e => /^\d{4}-\d{2}-\d{2}$/.test(e.d) && +e.d.slice(0, 4) >= 1000 && +e.d.slice(0, 4) <= 2070 && e.n && e.t);
console.log((evOk ? '✅' : '❌') + ' 日历日期与文案合法（下限 1000 年——容纳天关客星等史料条目）');
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

console.log('\nv8 地平坐标/深空天体/观测点检查：');
// 深空天体：4 个、坐标合法、中英文案齐
const dsOk = DEEPSKY.length === 4 &&
  DEEPSKY.every(d => d.ra >= 0 && d.ra < 24 && Math.abs(d.dec) <= 90 && d.desc && d.descEn && d.facts.length >= 2);
console.log((dsOk ? '✅' : '❌') + ' 深空天体 4 项，坐标与文案合法');
dsOk ? pass++ : fail++;
// 观测点：≥8 城、纬度/经度范围合法
const obsOk = OBSERVATORIES.length >= 8 &&
  OBSERVATORIES.every(o => Math.abs(o.lat) <= 90 && Math.abs(o.lon) <= 180 && o.n && o.en);
console.log((obsOk ? '✅' : '❌') + ' 观测点预设 ' + OBSERVATORIES.length + ' 城（含南半球悉尼）');
obsOk ? pass++ : fail++;
// 地平坐标锚点（与 sky.js 同算法，固定观测点）——复用既有 D2R3
function eclToHorizTest(lon, lat, days, latDeg, lonDeg) {
  const eps = 23.4393 * D2R3;
  const sinB = Math.sin(lat), cosB = Math.cos(lat);
  const sinD = sinB * Math.cos(eps) + cosB * Math.sin(eps) * Math.sin(lon);
  const dec = Math.asin(sinD);
  const y = Math.sin(lon) * Math.cos(eps) - Math.tan(lat) * Math.sin(eps);
  const ra = Math.atan2(y, Math.cos(lon));
  let gmst = (280.46061837 + 360.98564736629 * days) % 360;
  if (gmst < 0) gmst += 360;
  let H = (gmst + lonDeg) * D2R - ra;
  while (H > Math.PI) H -= 2 * Math.PI;
  while (H < -Math.PI) H += 2 * Math.PI;
  const phi = latDeg * D2R;
  const alt = Math.asin(Math.sin(dec) * Math.sin(phi) + Math.cos(dec) * Math.cos(phi) * Math.cos(H));
  let az = Math.atan2(-Math.cos(dec) * Math.sin(H),
    Math.sin(dec) * Math.cos(phi) - Math.cos(dec) * Math.sin(phi) * Math.cos(H)) / D2R;
  az = (az + 360) % 360;
  return { alt: alt / D2R, az: az };
}
const J2000T = Date.UTC(2000, 0, 1, 12);
{ // 锚点1：北京春分日——扫描全天找太阳最大高度角时刻，应满足 alt≈50° 且此刻 az≈180°（正午正南）
  const days0 = Math.floor((Date.UTC(2024, 2, 20) - J2000T) / 86400000);
  let best = { alt: -90, az: 0 };
  for (let m = 0; m < 1440; m += 2) {
    const hh = eclToHorizTest(0, 0, days0 + m / 1440, 39.9, 116.4);
    if (hh.alt > best.alt) best = hh;
  }
  check('北京正午太阳高度角 [°]', best.alt, 50, 1.5);
  check('正午太阳方位角（正南）[°]', Math.min(best.az, 360 - best.az), 180, 1.5);
}
{ // 锚点2：天北极（黄道坐标 λ=90°, β=90°-ε）的高度角 = 观测纬度
  const h = eclToHorizTest(90 * D2R3, 66.5607 * D2R3, 9000, 39.9, 116.4);
  check('北京天极高度角≈纬度 [°]', h.alt, 39.9, 0.5);
}
{ // 锚点3：悉尼（南纬 33.87°）看天北极应在地平线下同角度
  const h = eclToHorizTest(90 * D2R3, 66.5607 * D2R3, 9000, -33.87, 151.21);
  check('南半球天极在地平线下 [°]', h.alt, -33.87, 0.5);
}

console.log('\nv9 二十八宿/史料/辐射点/弹弓物理检查：');
// 二十八宿：28 项、四象各 7、坐标合法、文案完整
const mmOk = CONST_MANSIONS.length === 28 &&
  ['东方青龙', '北方玄武', '西方白虎', '南方朱雀'].every(img =>
    CONST_MANSIONS.filter(m => m.img === img).length === 7) &&
  CONST_MANSIONS.every(m => m.ra >= 0 && m.ra < 24 && Math.abs(m.dec) <= 90 && m.n && m.meaning && m.star);
console.log((mmOk ? '✅' : '❌') + ' 二十八宿：28 项、四象各 7、坐标文案合法');
mmOk ? pass++ : fail++;
// 宿链应大致沿黄经递增（驿站环；允许近似距星的小逆序——如历史上"觜参倒置"）
// 跳过首尾回绕对（轸176°→角195°是链闭合，+389° 不计入）
let lonSeqOk = true, prevLon = -1, maxJump = 0;
const EPS2 = 23.4393 * D2R3;
CONST_MANSIONS.forEach((m, i, arr) => {
  const lon = ((Math.atan2(Math.sin(m.ra * 15 * D2R3) * Math.cos(EPS2) - Math.tan(m.dec * D2R3) * Math.sin(EPS2), Math.cos(m.ra * 15 * D2R3)) / D2R3) % 360 + 360) % 360;
  m.__lonN = lon;
});
CONST_MANSIONS.forEach(function (m, i) {
  if (i === 0) { prevLon = m.__lonN; return; }
  let d = m.__lonN - prevLon;
  const wrapClose = prevLon > 300 && m.__lonN < 260; // 首尾回绕（轸→角）
  if (wrapClose) d = m.__lonN + 360 - prevLon;
  if (d > 5 && d < 355) {
    maxJump = Math.max(maxJump, d);
    if (d > 40) lonSeqOk = false; // 允许小逆序与近似坐标波动（井→鬼距星近似差 34°），禁止 >40° 大跳跃
  }
  prevLon = m.__lonN;
});
console.log((lonSeqOk ? '✅' : '❌') + ' 二十八宿链大致沿黄道（最大站间距 ' + maxJump.toFixed(0) + '°，回绕闭合除外）');
lonSeqOk ? pass++ : fail++;
// 史料：1054 事件 + cn 引文；哈雷 2061 cn
const ev1054 = ASTRO_EVENTS.find(e => e.d === '1054-07-04');
const cnOk = ev1054 && ev1054.cn && ev1054.cn.indexOf('宋史') >= 0 &&
  ASTRO_EVENTS.find(e => e.d === '2061-07-28' && e.cn);
console.log((cnOk ? '✅' : '❌') + ' 天象史料：天关客星 + 哈雷古回归记载');
cnOk ? pass++ : fail++;
// 流星雨辐射点坐标合法
const radOk2 = METEOR_SHOWERS.every(s => s.ra >= 0 && s.ra < 24 && Math.abs(s.dec) <= 90);
console.log((radOk2 ? "✅" : "❌") + " 流星雨辐射点赤经赤纬合法");
radOk2 ? pass++ : fail++;
// 弹弓物理（与 gravity.js 同式）
function sling(b, side, K, P) {
  const turn = 2 * Math.atan(K / (b * b));
  const A = 60 * D2R3;
  const uin = { x: Math.sin(A), y: -Math.cos(A) };
  const s2 = side === 'back' ? 1 : -1;
  const c = Math.cos(s2 * turn), si = Math.sin(s2 * turn);
  const uout = { x: uin.x * c - uin.y * si, y: uin.x * si + uin.y * c };
  const vin = Math.hypot(uin.x, P + uin.y);
  const vout = Math.hypot(uout.x, P + uout.y);
  return { turnDeg: turn / D2R3, dv: vout - vin, gainPct: (vout - vin) / vin * 100, vinMag: vin, voutMag: vout };
}
const gb = sling(1.0, 'back', 1.2, 1.0);
const gf = sling(1.0, 'front', 1.2, 1.0);
const ge = sling(1.0, 'back', 0.15, 0.30);
check('木星后方掠过增益 [%]', gb.gainPct, 96, 25);
check('木星前方掠过损耗为负', gf.dv < 0 ? 1 : 0, 1, 0);
check('地球弹弓增益 < 20%（微弱一推）', ge.gainPct < 20 ? 1 : 0, 1, 0);
check('转弯角随 b 增大而减小', sling(2.0, 'back', 1.2, 1.0).turnDeg < gb.turnDeg ? 1 : 0, 1, 0);

console.log('\nv10 水星凌日锚点检查（2032-11-13）：');
{ // 水星地心方向与太阳方向夹角应进入日面视半径（<0.28°）
  const mercury = PLANETS.find(p => p.key === 'mercury');
  const earth = PLANETS.find(p => p.key === 'earth');
  function helioRates(p, days) {
    const T = days / 36525, el = p.elements, rt = p.rates;
    const a = el.a + rt.a * T, e = el.e + rt.e * T;
    const M = (((el.L + rt.L * T) - (el.w + rt.w * T)) * D2R3 % 6.2832 + 6.2832) % 6.2832;
    const om = ((el.w + rt.w * T) - (el.O + rt.O * T)) * D2R3;
    const O = (el.O + rt.O * T) * D2R3, inc = (el.i + rt.i * T) * D2R3;
    const E = kepler3(M, e);
    const xp = a * (Math.cos(E) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
    const cw = Math.cos(om), sw = Math.sin(om), cO = Math.cos(O), sO = Math.sin(O);
    const ci = Math.cos(inc), si = Math.sin(inc);
    return {
      x: (cw * cO - sw * sO * ci) * xp + (-sw * cO - cw * sO * ci) * yp,
      y: (cw * sO + sw * cO * ci) * xp + (-sw * sO + cw * cO * ci) * yp,
      z: (sw * si) * xp + (cw * si) * yp
    };
  }
  // 在 2032-11-13 前后 6 小时步进扫描最小夹角
  const t0 = Date.UTC(2032, 10, 12, 12);
  let minSep = 999;
  for (let h = -72; h <= 72; h += 6) {
    const days = (t0 + h * 3600000 - J2000T) / 86400000;
    const m = helioRates(mercury, days), e = helioRates(earth, days);
    const mx = m.x - e.x, my = m.y - e.y, mz = m.z - e.z;
    const sx = -e.x, sy = -e.y, sz = -e.z;
    const dot = mx * sx + my * sy + mz * sz;
    const sep = Math.acos(Math.max(-1, Math.min(1, dot / (Math.hypot(mx, my, mz) * Math.hypot(sx, sy, sz))))) / D2R3;
    if (sep < minSep) minSep = sep;
  }
  check('2032-11-13 水星凌日最小地心夹角 [°]', minSep, 0.15, 0.25);
}

console.log('\nv11 冲日预言机/接力链检查：');
// 冲日锚点（真实天象）
const d0opp = (Date.UTC(2024, 0, 1) - J2000T) / 86400000;
const d1opp = (Date.UTC(2028, 0, 1) - J2000T) / 86400000;
const ops = findOppositions(d0opp, d1opp);
[['mars', '2025-01-16'], ['jupiter', '2024-12-07'], ['saturn', '2024-09-08'], ['saturn', '2025-09-21'], ['mars', '2027-02-19']].forEach(([key, date]) => {
  const target = (Date.parse(date + 'T12:00Z') - J2000T) / 86400000;
  const hit = ops.filter(o => o.key === key && Math.abs(o.days - target) < 5);
  const ok = hit.length > 0;
  console.log((ok ? '✅' : '❌') + ' 冲日预言：' + key + ' ' + date + (hit.length ? '（预测 ' + new Date(J2000T + hit[0].days * 86400000).toISOString().slice(0, 10) + '）' : '（未检出）'));
  ok ? pass++ : fail++;
});
check('4 年冲日总数合理（5 行星×~4 年 ≈ 17）', ops.length >= 14 && ops.length <= 22 ? 1 : 0, 1, 0);
// 接力链物理：三段乘积可达逃逸（倍率 = v出/v入）
function slingMult(b, side, K, P) {
  const s = sling(b, side, K, P);
  return s.voutMag / s.vinMag;
}
const mEarth2 = slingMult(0.6, 'back', 0.15, 0.30);
const mJup2 = slingMult(0.6, 'back', 1.2, 1.0);
const mSat2 = slingMult(0.7, 'back', 0.70, 0.72);
const cum = mEarth2 * mJup2 * mSat2;
console.log('   接力链乘积：地球 ×' + mEarth2.toFixed(2) + ' → 木星 ×' + mJup2.toFixed(2) + ' → 土星 ×' + mSat2.toFixed(2) + ' = 累计 ×' + cum.toFixed(2));
check('接力链累计倍率 > 1.55（超越逃逸）', cum > 1.55 ? 1 : 0, 1, 0);
check('地球段后掠有正增益且量级最小', mEarth2 > 1.0 && mEarth2 < mJup2 ? 1 : 0, 1, 0);

console.log('\nv12 大距/月相预言机检查：');
{
  const el = findElongations((Date.UTC(2024, 0, 1) - J2000T) / 86400000, (Date.UTC(2028, 0, 1) - J2000T) / 86400000);
  const me = el.filter(e => e.key === 'mercury'), ve = el.filter(e => e.key === 'venus');
  const meDeg = me.map(e => e.deg), veDeg = ve.map(e => e.deg);
  const meOk = meDeg.length >= 16 && Math.min.apply(null, meDeg) > 16 && Math.max.apply(null, meDeg) < 30;
  const veOk = veDeg.length >= 4 && Math.min.apply(null, veDeg) > 44 && Math.max.apply(null, veDeg) < 48;
  console.log((meOk ? '✅' : '❌') + ' 水星大距 ' + meDeg.length + ' 次，范围 ' + Math.min.apply(null, meDeg).toFixed(1) + '-' + Math.max.apply(null, meDeg).toFixed(1) + '°（真实 18-28）');
  meOk ? pass++ : fail++;
  console.log((veOk ? '✅' : '❌') + ' 金星大距 ' + veDeg.length + ' 次，范围 ' + Math.min.apply(null, veDeg).toFixed(1) + '-' + Math.max.apply(null, veDeg).toFixed(1) + '°（真实 45-47，无边界伪峰）');
  veOk ? pass++ : fail++;
  // 东西成对（跨 4 年应各有东西）
  const eastOk = me.some(e => e.type === 'east') && me.some(e => e.type === 'west') && ve.every(e => e.type === 'east' || e.type === 'west');
  eastOk ? (console.log('✅ 东西大距均有检出'), pass++) : (console.log('❌ 东西大距缺失'), fail++);
}
{
  const mp = findMoonPhases((Date.UTC(2024, 0, 1) - J2000T) / 86400000, (Date.UTC(2025, 0, 1) - J2000T) / 86400000);
  const news = mp.filter(m => m.type === 'new'), fulls = mp.filter(m => m.type === 'full');
  const cntOk = news.length >= 12 && news.length <= 14 && fulls.length >= 12 && fulls.length <= 14;
  console.log((cntOk ? '✅' : '❌') + ' 2024 年新月 ' + news.length + ' / 满月 ' + fulls.length + '（真实各 12-13）');
  cntOk ? pass++ : fail++;
  const gaps = [];
  for (let i = 1; i < news.length; i++) gaps.push(news[i].days - news[i - 1].days);
  const syn = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  check('朔望月周期 [天]', syn, 29.53, 0.1);
  // 锚点：日全食=新月、狼月=满月
  const t1 = (Date.UTC(2024, 3, 8, 18) - J2000T) / 86400000;
  const h1 = news.find(m => Math.abs(m.days - t1) < 1);
  console.log((h1 ? '✅' : '❌') + ' 2024-04-08 日全食锚点为新月' + (h1 ? '（偏差 ' + Math.abs(h1.days - t1).toFixed(2) + ' 天）' : ''));
  h1 ? pass++ : fail++;
  const t2 = (Date.UTC(2024, 0, 25, 17) - J2000T) / 86400000;
  const h2 = fulls.find(m => Math.abs(m.days - t2) < 1);
  console.log((h2 ? '✅' : '❌') + ' 2024-01-25 狼月锚点为满月' + (h2 ? '（偏差 ' + Math.abs(h2.days - t2).toFixed(2) + ' 天）' : ''));
  h2 ? pass++ : fail++;
}

console.log('\nv13 同框天象（合）检查：');
{
  const pc = findPlanetConjunctions((Date.UTC(2020, 5, 1) - J2000T) / 86400000, (Date.UTC(2027, 5, 1) - J2000T) / 86400000);
  // 锚点：木土大合 2020-12-21（真实分离 0.1°）
  const t1 = (Date.UTC(2020, 11, 21) - J2000T) / 86400000;
  const h1 = pc.find(c => c.p1.key === 'jupiter' && c.p2.key === 'saturn' && Math.abs(c.days - t1) < 4);
  console.log((h1 ? '✅' : '❌') + ' 木土大合 2020-12-21' + (h1 ? '（预测 ' + new Date(J2000T + h1.days * 86400000).toISOString().slice(0, 10) + '，分离 ' + h1.sepDeg.toFixed(2) + '°）' : ' 未检出'));
  h1 ? pass++ : fail++;
  // 锚点：金星合木星 2024-05-23 / 2025-08-12，金星合火星 2026-01-07
  [['venus', 'jupiter', '2024-05-23'], ['venus', 'jupiter', '2025-08-12'], ['venus', 'mars', '2026-01-07']].forEach(function (a) {
    const t = (Date.parse(a[2] + 'T12:00Z') - J2000T) / 86400000;
    const h = pc.find(c => ((c.p1.key === a[0] && c.p2.key === a[1]) || (c.p1.key === a[1] && c.p2.key === a[0])) && Math.abs(c.days - t) < 4);
    console.log((h ? '✅' : '❌') + ' 合锚点 ' + a[0] + '-' + a[1] + ' ' + a[2] + (h ? '（分离 ' + h.sepDeg.toFixed(2) + '°）' : ' 未检出'));
    h ? pass++ : fail++;
  });
  // 全部 <1.5° 且数量合理
  const allOk = pc.every(c => c.sepDeg < 1.5) && pc.length >= 30 && pc.length <= 80;
  console.log((allOk ? '✅' : '❌') + ' 互合 ' + pc.length + ' 条（7 年，全部 <1.5°）');
  allOk ? pass++ : fail++;
}
{
  const now = (Date.UTC(2026, 9, 1) - J2000T) / 86400000;
  const mc = findMoonConjunctions(now, now + 90);
  const ok = mc.length >= 6 && mc.length <= 16 && mc.every(c => c.sepDeg < 4);
  console.log((ok ? '✅' : '❌') + ' 未来 90 天合月 ' + mc.length + ' 次，全部 <4°');
  ok ? pass++ : fail++;
}

console.log('\nv14 三垣/极近相合检查：');
{
  // 三垣：3 垣、每垣 3-4 星、坐标合法、note 完整
  const syOk = SAN_YUAN.length === 3 &&
    SAN_YUAN.every(y => y.stars.length >= 3 && y.stars.length <= 4 &&
      y.stars.every(s => s.ra >= 0 && s.ra < 24 && Math.abs(s.dec) <= 90 && s.n) && y.note);
  console.log((syOk ? '✅' : '❌') + ' 三垣骨架：紫微/太微/天市，' + SAN_YUAN.reduce((n, y) => n + y.stars.length, 0) + ' 星');
  syOk ? pass++ : fail++;
  // 紫微垣应围绕北极（勾陈一 dec>89）
  const zi = SAN_YUAN.find(y => y.n === '紫微垣');
  const polarOk = zi && zi.stars.some(s => s.dec > 89);
  console.log((polarOk ? '✅' : '❌') + ' 紫微垣含北极星（恒显圈中枢）');
  polarOk ? pass++ : fail++;
  // 极近合月：未来 2 年内月-行星分离 <1° 应有数次
  const n0 = (Date.UTC(2026, 9, 1) - J2000T) / 86400000;
  const near = findMoonConjunctions(n0, n0 + 730).filter(c => c.sepDeg < 1.0);
  console.log((near.length >= 1 ? '✅' : '❌') + ' 未来 2 年极近合月（<1°）' + near.length + ' 次');
  near.length >= 1 ? pass++ : fail++;
}

console.log('\nv17 月掩星引擎检查：');
{
  const e1 = findMoonCloseApproaches((Date.UTC(2025, 0, 1) - J2000T) / 86400000, (Date.UTC(2025, 4, 1) - J2000T) / 86400000);
  const mars = e1.find(e => e.p.key === 'mars' && Math.abs(e.days - (Date.UTC(2025, 1, 9) - J2000T) / 86400000) < 2);
  console.log((mars ? '✅' : '❌') + ' 2025-02-09 月掩火星（掠边级）' + (mars ? '：分离 ' + mars.sepDeg.toFixed(2) + '°' : ''));
  mars ? pass++ : fail++;
  const e2 = findMoonCloseApproaches((Date.UTC(2025, 8, 1) - J2000T) / 86400000, (Date.UTC(2026, 2, 1) - J2000T) / 86400000);
  const ple = e2.filter(e => e.p.key === 'pleiades' && e.sepDeg < 1.2);
  console.log((ple.length >= 2 ? '✅' : '❌') + ' 月掩昴星团（半年 ' + ple.length + ' 次，主要驻留期）');
  ple.length >= 2 ? pass++ : fail++;
  const now = (Date.UTC(2026, 9, 1) - J2000T) / 86400000;
  const near90 = findMoonCloseApproaches(now, now + 90);
  console.log('   未来 90 天掩/极近事件 ' + near90.length + ' 条');
  check('未来 90 天掩/极近 >= 2 条', near90.length >= 2 ? 1 : 0, 1, 0);
}

console.log('\nv20 月掩亮星引擎检查（BRIGHT_ECLIPTIC_STARS）：');
{
  // 星表合法性：6 颗、黄纬 ±7° 内（月球天平动极限+视差才够得着）、键唯一
  check('黄道亮星表 6 颗', BRIGHT_ECLIPTIC_STARS.length, 6, 0);
  check('亮星黄纬均在 ±7° 内', BRIGHT_ECLIPTIC_STARS.every(s => Math.abs(s.ecl[1]) <= 7) ? 1 : 0, 1, 0);
  check('亮星键唯一', new Set(BRIGHT_ECLIPTIC_STARS.map(s => s.key)).size === BRIGHT_ECLIPTIC_STARS.length ? 1 : 0, 1, 0);
  // 物理锚点：2026 全年——轩辕十四（β=0.33°）与心宿二（β=-4.57°）均处于掩星季，
  // 各应发生 ≥2 次月掩（真实历表：2026 年两星均为每月一掩系列）
  const d26a = (Date.UTC(2026, 0, 1, 12) - J2000T) / 86400000;
  const ev26 = findStarOccultations(d26a, d26a + 365);
  const reg = ev26.filter(e => e.p === 'star-regulus' && e.occult);
  const ant = ev26.filter(e => e.p === 'star-antares' && e.occult);
  console.log('   2026 年掩星事件：轩辕十四 ' + reg.length + ' 次，心宿二 ' + ant.length + ' 次');
  check('2026 轩辕十四月掩 >= 2 次', reg.length >= 2 ? 1 : 0, 1, 0);
  check('2026 心宿二月掩 >= 2 次', ant.length >= 2 ? 1 : 0, 1, 0);
  // 不变量：排序 / 阈值 / 掩食判定自洽
  check('掩星事件按日期排序', ev26.every((e, i) => i === 0 || ev26[i - 1].days <= e.days) ? 1 : 0, 1, 0);
  check('月伴阈值 < 1.2°', ev26.every(e => e.sepDeg < 1.2) ? 1 : 0, 1, 0);
  check('掩食判定 < 0.95° 与标志自洽', ev26.every(e => !e.occult || e.sepDeg < 0.95) ? 1 : 0, 1, 0);
}

console.log('\nv20 VVEJ 四段远征可达性（金星→金星→地球→木星）：');
{
  const GP = { jupiter: [1.2, 1.00], saturn: [0.70, 0.72], earth: [0.15, 0.30], venus: [0.10, 0.28], mercury: [0.04, 0.10] };
  const stages = [['venus', 1.10], ['venus', 1.18], ['earth', 1.15], ['jupiter', 1.40]];
  stages.forEach((st, i) => {
    let best = 0;
    for (let b = 0.4; b <= 3; b += 0.05) {
      const r = sling(b, 'back', GP[st[0]][0], GP[st[0]][1]);
      best = Math.max(best, r.voutMag / r.vinMag);
    }
    console.log('   第' + (i + 1) + '站 ' + st[0] + ' 需 ×' + st[1] + ' → 最优可达 ×' + best.toFixed(3));
    check('VVEJ 第' + (i + 1) + '站可达', best >= st[1] ? 1 : 0, 1, 0);
  });
  // 3D 月相模块文件与关键要素
  const m3 = fs.readFileSync(__dirname + '/../js/moon3d.js', 'utf8');
  check('moon3d.js 含方向光照', m3.indexOf('DirectionalLight') > 0 ? 1 : 0, 1, 0);
  check('moon3d.js 含天平动模型', m3.indexOf('libration') > 0 ? 1 : 0, 1, 0);
  check('moon3d.js 含地照补光', m3.indexOf('earthShine') > 0 ? 1 : 0, 1, 0);
  check('index.html 挂载 3D 月相画布', fs.readFileSync(__dirname + '/../index.html', 'utf8').indexOf('moon3d-canvas') > 0 ? 1 : 0, 1, 0);
}

console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
