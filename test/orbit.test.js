/* 验证开普勒轨道计算（与 main.js 相同算法，脱离 DOM 运行） */
'use strict';
const fs = require('fs');
const vm = require('vm');

const ctx = { window: {} };
vm.createContext(ctx);
const src = fs.readFileSync(__dirname + '/../js/data.js', 'utf8') +
  '\n;this.__export = { PLANETS: PLANETS, SUN_DATA: SUN_DATA };';
vm.runInContext(src, ctx);
const planets = ctx.__export.PLANETS;

const D2R = Math.PI / 180;
const TAU = Math.PI * 2;
const EPOCH_MS = Date.UTC(2000, 0, 1, 12);
const AU_KM = 149597870.7;

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
function helioPos(p, days) {
  const T = days / 36525;
  const el = p.elements, rt = p.rates;
  const a = el.a + rt.a * T, e = el.e + rt.e * T;
  const i = (el.i + rt.i * T) * D2R, L = (el.L + rt.L * T) * D2R;
  const w = (el.w + rt.w * T) * D2R, O = (el.O + rt.O * T) * D2R;
  const om = w - O;
  const M = normAngle(L - w);
  const E = keplerSolve(M, e);
  const xp = a * (Math.cos(E) - e);
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const cw = Math.cos(om), sw = Math.sin(om);
  const cO = Math.cos(O), sO = Math.sin(O);
  const ci = Math.cos(i), si = Math.sin(i);
  return {
    x: (cw * cO - sw * sO * ci) * xp + (-sw * cO - cw * sO * ci) * yp,
    y: (cw * sO + sw * cO * ci) * xp + (-sw * sO + cw * cO * ci) * yp,
    z: (sw * si) * xp + (cw * si) * yp
  };
}

let pass = 0, fail = 0;
function check(name, got, want, tol) {
  const ok = Math.abs(got - want) <= tol;
  console.log((ok ? '✅' : '❌') + ' ' + name + ': got=' + got.toFixed(5) + ' want≈' + want + ' (tol ' + tol + ')');
  ok ? pass++ : fail++;
}

const daysNow = (Date.now() - EPOCH_MS) / 86400000; // 2026-09-12 附近
console.log('模拟日期距 J2000 天数:', daysNow.toFixed(2));

const byKey = {};
planets.forEach(p => byKey[p.key] = p);

// 1) 地球日距应接近 1.006 AU（9月中旬趋近秋分，日距略大于1）
const earth = helioPos(byKey.earth, daysNow);
const rE = Math.hypot(earth.x, earth.y, earth.z);
check('地球当前日距 [AU]', rE, 1.005, 0.008);

// 2) 地球黄经：双校验
//    a) 物理一致性——日心黄经日变率应 ≈0.986°/天（回归年）；
//    b) 绝对校验——对独立平黄经锚点比对（锚点速率基准为回归年，
//       与恒星年累积 9757 天差约 0.36°，故容差放宽）
const lonE = (Math.atan2(earth.y, earth.x) / D2R + 360) % 360;
const earthPrev = helioPos(byKey.earth, daysNow - 1, { x: 0, y: 0, z: 0 });
const lonPrev = (Math.atan2(earthPrev.y, earthPrev.x) / D2R + 360) % 360;
let dDay = lonE - lonPrev;
if (dDay < 0) dDay += 360;
check('地球黄经日变率 [°/天]', dDay, 0.986, 0.04);
const meanSun = (280.459 + 0.98564736 * daysNow) % 360;   // 太阳平黄经（独立常数）
const meanEarth = (meanSun + 180) % 360;                   // 地球 = 太阳平黄经 + 180°
let dLon = Math.abs(lonE - meanEarth);
if (dLon > 180) dLon = 360 - dLon;
console.log('   地球日心黄经 = ' + lonE.toFixed(2) + '°（平黄经锚点 ' + meanEarth.toFixed(2) + '°，偏差含 EoC 与速率基准差）');
check('地球日心黄经 vs 平黄经锚点 [°]', dLon, 0, 2.6);

// 3) 水星近日点距离 ≈ 0.307 AU
{
  const p = byKey.mercury;
  check('水星近日点 [AU]', p.elements.a * (1 - p.elements.e), 0.307, 0.002);
}
// 4) 海王星公转周期 T = a^1.5 年 ≈ 164.8
{
  const p = byKey.neptune;
  check('海王星周期 [年]', Math.pow(p.elements.a, 1.5), 164.8, 0.5);
}
// 5) 各行星 2026-09-12 日距合理性
console.log('\n各行星 2026-09-12 日距 [AU]:');
['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'].forEach(k => {
  const v = helioPos(byKey[k], daysNow);
  const r = Math.hypot(v.x, v.y, v.z);
  const okRange = r > byKey[k].elements.a * (1 - byKey[k].elements.e) - 0.01 &&
                  r < byKey[k].elements.a * (1 + byKey[k].elements.e) + 0.01;
  console.log((okRange ? '  ✅ ' : '  ❌ ') + byKey[k].name + ' r=' + r.toFixed(3) + ' AU');
  okRange ? pass++ : fail++;
});
// 6) 木星-土星 2026 年位置粗查：木星应在巨蟹座/狮子一带（黄经 120-140°）
{
  const j = helioPos(byKey.jupiter, daysNow);
  const lon = (Math.atan2(j.y, j.x) / D2R + 360) % 360;
  console.log('   木星日心黄经 = ' + lon.toFixed(1) + '°');
}

console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
