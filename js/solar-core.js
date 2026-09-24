/* ============================================================
 * solar-core.js —— 常量 / 状态 / 工具 / 开普勒解算 / 渲染器 / 贴图 / 星空
 * （v4.0 拆分：四文件按序加载共享全局词法作用域，保住 file:// 双击可用）
 * ============================================================ */
'use strict';

/* ================= 常量与全局状态 ================= */
const TAU = Math.PI * 2;
const EPOCH_MS = Date.UTC(2000, 0, 1, 12);
const AU_KM = 149597870.7;
const EARTH_RADIUS_KM = 6371;
const COMPRESS_K = 28;
const REAL_AU = 42;
const SUN_VISUAL_RADIUS = 7;
const ROT_CLAMP = 0.35;
const MOON_VISUAL_DIST = 3.1;

const state = {
  simDays: (Date.now() - EPOCH_MS) / 86400000,
  speed: 20,
  paused: false,
  follow: null,
  selected: null,
  distanceMode: 'compressed',
  showOrbits: true,
  showLabels: true,
  showBelt: true,
  showProbes: false,
  bloom: true,
  realTex: false,
  project: false,
  bgIndex: 0,
  hz: false,        // v4.0 宜居带叠加层
  showAxis: true,   // v7.5 自转轴虚线（金星/天王星等高倾角行星）
  sys: 'solar',     // v4.0 当前系统（'solar' | EXOSYSTEMS key）
  sysStartDays: 0,
  quality: 2        // v4.0 自适应画质等级 2=全 1=省 0=最低
};
window.__solar = { state: state };

/* ================= 小工具 ================= */
const $ = function (id) { return document.getElementById(id); };
const D2R = Math.PI / 180;
function pad2(n) { return (n < 10 ? '0' : '') + n; }
function normAngle(x) { while (x > Math.PI) x -= TAU; while (x < -Math.PI) x += TAU; return x; }
function smoothstep(t) { return t * t * (3 - 2 * t); }
function fmtNum(n, digits) { return n.toLocaleString('zh-CN', { maximumFractionDigits: digits == null ? 2 : digits }); }
function fmtRotation(hours) {
  const retro = hours < 0;
  const h = Math.abs(hours);
  const s = h < 48 ? fmtNum(h, 1) + ' ' + t8('info.hours', '小时') : fmtNum(h / 24, 1) + ' ' + t8('info.days', '天');
  return s + (retro ? t8('info.retro', '（逆向自转）') : '');
}
function fmtPeriod(days) {
  if (days < 700) return fmtNum(days, 1) + ' ' + t8('info.days', '天');
  return fmtNum(days / 365.25, 1) + ' ' + t8('info.years', '年');
}
function simDate() { return new Date(EPOCH_MS + state.simDays * 86400000); }

/* v7.0 真实月球黄经（Meeus 低阶理论，±0.3°）——月相与 3D 月球位置共用 */
function realMoonLonRad(days) {
  const Lp = 218.316 + 13.176396 * days;
  const Mm = (134.963 + 13.064993 * days) * D2R;
  const Ms = (357.529 + 0.98560028 * days) * D2R;
  const D = (297.850 + 12.190749 * days) * D2R;
  let lon = Lp + 6.289 * Math.sin(Mm) + 1.274 * Math.sin(2 * D - Mm) + 0.658 * Math.sin(2 * D)
    + 0.214 * Math.sin(2 * Mm) - 0.186 * Math.sin(Ms) - 0.059 * Math.sin(2 * D - 2 * Mm)
    - 0.057 * Math.sin(2 * D - Ms - Mm) + 0.053 * Math.sin(2 * D + Mm) + 0.046 * Math.sin(2 * D - Ms)
    - 0.041 * Math.sin(Mm - Ms) - 0.035 * Math.sin(D) - 0.031 * Math.sin(Mm + Ms);
  lon = ((lon % 360) + 360) % 360;
  return lon * D2R;
}

/* i18n 安全取值（i18n.js 未加载时回退中文） */
function t8(path, fallback) {
  try {
    if (window.I18N) { const v = I18N.t(path); if (v != null) return v; }
  } catch (e) { }
  return fallback;
}

function showBanner(msg) {
  const b = $('error-banner');
  b.textContent = msg;
  b.classList.remove('hidden');
}
window.addEventListener('error', function (e) {
  if (window.__abortQuiet) return; // 引导中止的静默退出
  if (window.__firstErrShown) return; // 只显示第一条错误（后续脚本的连锁 TDZ 无诊断价值）
  window.__firstErrShown = true;
  const loc = e.filename ? (e.filename.split('/').pop() + ':' + e.lineno) : '';
  showBanner('⚠️ ' + t8('ui.errRuntime', '运行出错：') + (e.message || e.type) + (loc ? ' @' + loc : ''));
});

let toastTimer = null;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2600);
}

/* ================= 开普勒轨道计算（行星/M0 双路径统一） ================= */
function helioPrep(p, days) {
  const el = p.elements;
  if (el.M0 !== undefined) {
    return {
      a: el.a, e: el.e,
      i: el.i * D2R, O: el.O * D2R, om: el.om * D2R,
      M: (el.M0 + 360 * days / p.periodDays) * D2R
    };
  }
  const rt = p.rates, T = days / 36525;
  const a = el.a + rt.a * T, e = el.e + rt.e * T;
  const i = (el.i + rt.i * T) * D2R;
  const L = (el.L + rt.L * T) * D2R;
  const w = (el.w + rt.w * T) * D2R;
  const O = (el.O + rt.O * T) * D2R;
  return { a: a, e: e, i: i, om: w - O, O: O, M: L - w };
}

function keplerSolve(M, e) {
  let E = M;
  for (let k = 0; k < 7; k++) {
    const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-7) break;
  }
  return E;
}

function orbitalPoint(el, E, out) {
  const xp = el.a * (Math.cos(E) - el.e);
  const yp = el.a * Math.sqrt(1 - el.e * el.e) * Math.sin(E);
  const cw = Math.cos(el.om), sw = Math.sin(el.om);
  const cO = Math.cos(el.O), sO = Math.sin(el.O);
  const ci = Math.cos(el.i), si = Math.sin(el.i);
  out.x = (cw * cO - sw * sO * ci) * xp + (-sw * cO - cw * sO * ci) * yp;
  out.y = (cw * sO + sw * cO * ci) * xp + (-sw * sO + cw * cO * ci) * yp;
  out.z = (sw * si) * xp + (cw * si) * yp;
  return out;
}

const _tmp = { x: 0, y: 0, z: 0 };
function helioPos(p, days, out) {
  const el = helioPrep(p, days);
  const M = normAngle(el.M);
  const E = keplerSolve(M, el.e);
  orbitalPoint(el, E, out);
  return el;
}

/* 黄道 -> 场景（X=x, Y=z北, Z=-y；北俯视逆时针） */
const _v3 = new THREE.Vector3();
function mapAU(x, y, z, out) {
  if (state.distanceMode === 'real') {
    out.set(x * REAL_AU, z * REAL_AU, -y * REAL_AU);
  } else {
    const r = Math.sqrt(x * x + y * y + z * z) || 1e-9;
    const k = (COMPRESS_K * Math.sqrt(r)) / r;
    out.set(x * k, z * k, -y * k);
  }
  return out;
}

/* ================= 渲染器 / 场景 ================= */
if (!window.THREE) {
  showBanner('⚠️ ' + t8('ui.errThree', 'three.js 加载失败，请检查 js/lib/three.min.js'));
  window.SolarOK = false;
} else {
  window.SolarOK = true;
}
let renderer = null;
if (window.SolarOK) {
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true });
  } catch (err) {
    renderer = null;
  }
  if (!renderer) {
    showBanner('⚠️ ' + t8('ui.errWebgl', '您的浏览器不支持 WebGL，无法运行本演示。'));
    window.SolarOK = false;
  }
}
if (!window.SolarOK) {
  window.__abortQuiet = true;
  throw new Error('solar boot aborted');
}

renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.setClearColor(0x02030a, 1);
renderer.autoClear = true;
$('scene-container').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 200000);
camera.position.set(0, 150, 280);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 3;
controls.maxDistance = 1200;

scene.add(new THREE.AmbientLight(0x404a60, 0.45));
const sunLight = new THREE.PointLight(0xfff1dc, 1.5);
scene.add(sunLight);

/* Bloom 后处理（失败自动降级直渲） */
let composer = null, bloomPass = null;
try {
  if (THREE.EffectComposer && THREE.RenderPass && THREE.UnrealBloomPass &&
      typeof THREE.EffectComposer === 'function') {
    composer = new THREE.EffectComposer(renderer);
    composer.addPass(new THREE.RenderPass(scene, camera));
    bloomPass = new THREE.UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight), 0.9, 0.55, 0.8);
    composer.addPass(bloomPass);
  }
} catch (e) {
  composer = null; bloomPass = null;
  console.warn('Bloom 后处理不可用，已回退直渲：', e && e.message);
}

/* ================= 背景色切换 ================= */
const BG_PRESETS = [
  { key: 'space', name: '深空黑', en: 'Deep space', color: 0x02030a },
  { key: 'pure', name: '纯黑', en: 'Black', color: 0x000000 },
  { key: 'navy', name: '深海军蓝', en: 'Navy', color: 0x0a1128 },
  { key: 'violet', name: '深紫', en: 'Violet', color: 0x120a24 },
  { key: 'ink', name: '墨灰', en: 'Ink', color: 0x101014 }
];
function applyBg() {
  const p = BG_PRESETS[state.bgIndex] || BG_PRESETS[0];
  renderer.setClearColor(p.color, 1);
  const btn = $('btn-bg');
  if (btn) btn.textContent = '🌌 ' + (window.I18N && I18N.lang === 'en' ? p.en : p.name);
}
$('btn-bg').addEventListener('click', function () {
  state.bgIndex = (state.bgIndex + 1) % BG_PRESETS.length;
  applyBg();
  savePrefs();
});
applyBg();

/* ================= 贴图 ================= */
const TEX = SolarTextures.build();
function ctex(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.encoding = THREE.sRGBEncoding;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}
const T = {
  sun: ctex(TEX.sun), mercury: ctex(TEX.mercury), venus: ctex(TEX.venus),
  earth: ctex(TEX.earth), moon: ctex(TEX.moon), mars: ctex(TEX.mars),
  jupiter: ctex(TEX.jupiter), saturn: ctex(TEX.saturn),
  uranus: ctex(TEX.uranus), neptune: ctex(TEX.neptune),
  pluto: ctex(TEX.pluto), ceres: ctex(TEX.ceres), eris: ctex(TEX.eris),
  io: ctex(TEX.io), europa: ctex(TEX.europa), ganymede: ctex(TEX.ganymede),
  callisto: ctex(TEX.callisto), titan: ctex(TEX.titan),
  halley: ctex(TEX.halleyNucleus)
};
const T_CLOUDS = new THREE.CanvasTexture(TEX.earthClouds);
const T_RING_S = new THREE.CanvasTexture(TEX.ringSaturn), T_RING_U = new THREE.CanvasTexture(TEX.ringUranus);
const T_GLOW = new THREE.CanvasTexture(TEX.glowSun), T_DOT = new THREE.CanvasTexture(TEX.glowSoft);
const T_HL = new THREE.CanvasTexture(TEX.highlight);
const T_MILKY = new THREE.CanvasTexture(TEX.milkyHaze);
const proceduralMaps = { earth: T.earth, mars: T.mars, moon: T.moon, clouds: T_CLOUDS };

/* ================= 星空 + 银河背景 ================= */
const milkyGroup = new THREE.Group();
milkyGroup.rotation.set(1.02, 0, 0.55);
scene.add(milkyGroup);
(function buildStars() {
  function gauss() {
    return (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
  }
  function layer(count, rMin, rMax, size, opacity, parent, band) {
    const pos = new Float32Array(count * 3), col = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const lon = Math.random() * TAU;
      const u = band ? Math.max(-1, Math.min(1, gauss() * 0.16)) : Math.random() * 2 - 1;
      const s = Math.sqrt(1 - u * u);
      const r = rMin + (rMax - rMin) * Math.random();
      pos[i * 3] = r * s * Math.cos(lon);
      pos[i * 3 + 1] = r * u;
      pos[i * 3 + 2] = r * s * Math.sin(lon);
      const t = Math.random();
      let c = [1, 1, 1];
      if (t < 0.12) c = [0.72, 0.8, 1];
      else if (t < 0.24) c = [1, 0.85, 0.66];
      else if (band && t < 0.55) c = [0.94, 0.92, 1.0];
      const b = 0.5 + Math.random() * 0.5;
      col[i * 3] = c[0] * b; col[i * 3 + 1] = c[1] * b; col[i * 3 + 2] = c[2] * b;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const m = new THREE.PointsMaterial({
      size: size, map: T_DOT, vertexColors: true, transparent: true,
      opacity: opacity, sizeAttenuation: false, depthWrite: false
    });
    parent.add(new THREE.Points(g, m));
  }
  layer(3200, 42000, 56000, 2.2, 0.9, scene, false);
  layer(240, 40000, 52000, 4.2, 0.95, scene, false);
  layer(4200, 44000, 56000, 2.0, 0.75, milkyGroup, true);
  for (let i = 0; i < 26; i++) {
    const lon = (i / 26) * TAU + (Math.random() - 0.5) * 0.22;
    const r = 45000 + Math.random() * 8000;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: T_MILKY, transparent: true, opacity: 0.045 + Math.random() * 0.05,
      blending: THREE.AdditiveBlending, depthWrite: false, color: 0x8fa8e8
    }));
    sp.position.set(r * Math.cos(lon), (Math.random() - 0.5) * 1400, r * Math.sin(lon));
    const sw = 6500 + Math.random() * 7500;
    sp.scale.set(sw, sw * 0.55, 1);
    milkyGroup.add(sp);
  }
})();

/* ================= 天体注册表（跨文件共享） ================= */
const bodies = [];          // 太阳系天体（含太阳/行星/卫星/矮行星/彗星/探测器）
const pickMeshes = [];      // 当前可拾取网格（随系统切换重建）
const labelsRoot = $('labels');
const camTmp = new THREE.Vector3();
function activeList() { return state.sys === 'solar' ? bodies : exoBodies; }
