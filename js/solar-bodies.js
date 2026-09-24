/* ============================================================
 * solar-bodies.js —— 天体构建：行星/矮行星/彗星/卫星/环带/探测器/系外系统
 * ============================================================ */
'use strict';
if (window.SolarOK === false) { window.__abortQuiet = true; throw new Error('solar boot aborted'); }
/* 数据版本守卫：浏览器缓存了旧 data.js 时给出明确指引，而非神秘未定义错误 */
if ((window.DATA_VERSION || 0) < 10) {
  window.__firstErrShown = false;
  showBanner('⚠️ 检测到旧版缓存数据，请按 Ctrl+F5 强制刷新页面（或清除浏览器缓存）后重试');
  window.__firstErrShown = true;
  window.__abortQuiet = true;
  throw new Error('data.js too old, hard-refresh required');
}

function planetVisualRadius(radiusKm) {
  return 1.05 * Math.pow(radiusKm / EARTH_RADIUS_KM, 0.45);
}
function makeLabel(text) {
  const el = document.createElement('div');
  el.className = 'body-label';
  el.textContent = text;
  labelsRoot.appendChild(el);
  return el;
}
function addPick(body, parent, radius) {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 12, 8),
    new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false })
  );
  m.userData.body = body;
  parent.add(m);
  pickMeshes.push(m);
  body.pick = m;
  return m;
}
function makeHighlight(body, parent, radius) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({
    map: T_HL, transparent: true, depthWrite: false, depthTest: false
  }));
  sp.scale.set(radius * 3.4, radius * 3.4, 1);
  sp.visible = false;
  parent.add(sp);
  body.highlight = sp;
  body.highlightBase = radius * 3.4;
}

/* ---- 太阳 ---- */
const sunBody = { data: SUN_DATA, isSun: true, aumag: 0 };
{
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(SUN_VISUAL_RADIUS, 64, 48),
    new THREE.MeshBasicMaterial({ map: T.sun })
  );
  group.add(mesh);
  const mkGlow = function (scale, opacity) {
    const g = new THREE.Sprite(new THREE.SpriteMaterial({
      map: T_GLOW, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: opacity
    }));
    g.scale.set(scale, scale, 1);
    group.add(g);
    return g;
  };
  mkGlow(SUN_VISUAL_RADIUS * 5.2, 1);
  mkGlow(SUN_VISUAL_RADIUS * 11, 0.35);
  sunBody.group = group; sunBody.mesh = mesh;
  sunBody.label = makeLabel('☀️ ' + t8('body.sun', '太阳'));
  sunBody.label.classList.add('label-sun');
  addPick(sunBody, group, SUN_VISUAL_RADIUS * 1.25);
  makeHighlight(sunBody, group, SUN_VISUAL_RADIUS);
  scene.add(group);
  bodies.push(sunBody);
}

/* ---- 轨道线 ---- */
function buildOrbitLine(p, opacity) {
  const el = helioPrep(p, state.simDays);
  const pts = [];
  for (let k = 0; k <= 256; k++) {
    orbitalPoint(el, (k / 256) * TAU, _tmp);
    mapAU(_tmp.x, _tmp.y, _tmp.z, _v3);
    pts.push(new THREE.Vector3(_v3.x, _v3.y, _v3.z));
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = new THREE.LineBasicMaterial({
    color: p.color, transparent: true, opacity: opacity, depthWrite: false
  });
  const line = new THREE.Line(geo, mat);
  line.visible = state.showOrbits;
  scene.add(line);
  return line;
}
function rebuildOrbits() {
  bodies.forEach(function (b) {
    if (b.orbitLine) {
      (b.isProbe ? probeGroup : scene).remove(b.orbitLine);
      b.orbitLine.geometry.dispose();
      b.orbitLine.material.dispose();
      b.orbitLine = b.isProbe ? buildProbeLine(b) : buildOrbitLine(b.data, b.minor ? 0.22 : 0.38);
    }
  });
  buildHZ(); // 宜居带随距离模式重建
}

/* ---- 环系统 ---- */
function fixRingUV(geo, inner, outer) {
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const r = Math.sqrt(pos.getX(i) * pos.getX(i) + pos.getY(i) * pos.getY(i));
    uv.setXY(i, (r - inner) / (outer - inner), 0.5);
  }
  uv.needsUpdate = true;
}
function addRing(parent, inner, outer, texture, opacity) {
  const geo = new THREE.RingGeometry(inner, outer, 128, 1);
  fixRingUV(geo, inner, outer);
  const mat = new THREE.MeshLambertMaterial({
    map: texture, side: THREE.DoubleSide, transparent: true,
    opacity: opacity, depthWrite: false,
    emissive: 0x8a8378, emissiveIntensity: 0.35, emissiveMap: texture
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 1;
  parent.add(mesh);
  return mesh;
}

/* ---- 行星 / 矮行星（统一构建） ---- */
const PLANET_TEXTURES = {
  mercury: T.mercury, venus: T.venus, earth: T.earth, mars: T.mars,
  jupiter: T.jupiter, saturn: T.saturn, uranus: T.uranus, neptune: T.neptune,
  pluto: T.pluto, ceres: T.ceres, eris: T.eris, apophis: T.ceres,
  vesta: T.moon, pallas: T.callisto,
  encke: T.halley, c67p: T.halley, halebopp: T.halley
};
let jupiterEcl = { x: 0, y: 0, z: 0 }; // 供特洛伊群使用

function buildOrbitingBody(p, minor) {
  const body = {
    data: p, isSun: false, isMoon: false, minor: !!minor,
    aumag: p.distanceAU, lastRotRaw: 0, cloudMesh: null, labelNear: minor ? 150 : null
  };
  const group = new THREE.Group();
  const tiltGroup = new THREE.Group();
  tiltGroup.rotation.z = -p.tiltDeg * D2R;
  group.add(tiltGroup);
  const r = minor ? Math.max(planetVisualRadius(p.radiusKm), 0.42) : planetVisualRadius(p.radiusKm);
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(r, minor ? 32 : 48, minor ? 24 : 32),
    new THREE.MeshStandardMaterial({ map: PLANET_TEXTURES[p.key], roughness: 1, metalness: 0 })
  );
  tiltGroup.add(mesh);
  // v7.5 自转轴虚线（|倾角|>30° 的行星才画，重点展示金星 177°/天王星 97.8°）
  if (Math.abs(p.tiltDeg) > 30) {
    const axisLen = r * 1.9;
    const axisPts = [];
    for (let i = -6; i <= 6; i++) {
      if (i === 0) continue;
      axisPts.push(new THREE.Vector3(0, i % 2 ? axisLen * i / 12 : axisLen * (i - 1) / 12 + 0.01, 0));
    }
    const axis = new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(axisPts),
      new THREE.LineBasicMaterial({ color: 0x9fd0ff, transparent: true, opacity: 0.5, depthWrite: false })
    );
    axis.visible = state.showAxis;
    tiltGroup.add(axis);
    if (!window.__axisLines) window.__axisLines = [];
    window.__axisLines.push(axis);
  }
  if (p.key === 'earth') {
    const clouds = new THREE.Mesh(
      new THREE.SphereGeometry(r * 1.025, 48, 32),
      new THREE.MeshLambertMaterial({ map: T_CLOUDS, transparent: true, depthWrite: false })
    );
    tiltGroup.add(clouds);
    body.cloudMesh = clouds;
  }
  if (p.key === 'saturn') body.ring = addRing(tiltGroup, r * 1.35, r * 2.35, T_RING_S, 0.96);
  if (p.key === 'uranus') body.ring = addRing(tiltGroup, r * 1.55, r * 2.05, T_RING_U, 0.8);
  body.group = group; body.mesh = mesh; body.tiltGroup = tiltGroup;
  const cometIcon = p.key === 'halley' || p.key === 'encke' || p.key === 'c67p' || p.key === 'halebopp';
  const rockIcon = p.key === 'apophis' || p.key === 'vesta' || p.key === 'pallas';
  body.label = makeLabel((minor ? (cometIcon ? '☄️ ' : rockIcon ? '🪨 ' : '') : '') + p.name);
  addPick(body, group, Math.max(r * 1.7, 1.35));
  makeHighlight(body, group, r);
  body.orbitLine = buildOrbitLine(p, minor ? 0.22 : 0.38);
  scene.add(group);
  bodies.push(body);
  return body;
}

PLANETS.forEach(function (p) { buildOrbitingBody(p, false); });
DWARFS.forEach(function (p) { buildOrbitingBody(p, true); });

/* ---- 宜居带叠加层（v4.0 A3） ---- */
let hzRing = null;
function buildHZ() {
  if (hzRing) {
    scene.remove(hzRing);
    hzRing.geometry.dispose();
    hzRing.material.dispose();
    hzRing = null;
  }
  let geo;
  if (state.sys === 'solar') {
    // 内外边界经 mapAU 采样（兼容压缩/真实两种距离模式）
    const innerAU = 0.95, outerAU = 1.67, N = 128;
    const posArr = [];
    const pi = new THREE.Vector3(), po = new THREE.Vector3();
    for (let k = 0; k < N; k++) {
      const th = k / N * TAU;
      mapAU(Math.cos(th) * innerAU, Math.sin(th) * innerAU, 0, pi);
      mapAU(Math.cos(th) * outerAU, Math.sin(th) * outerAU, 0, po);
      posArr.push(pi.x, pi.y, pi.z, po.x, po.y, po.z);
    }
    const idx = [];
    for (let k = 0; k < N; k++) {
      const a = k * 2, b = k * 2 + 1, c = ((k + 1) % N) * 2, d = ((k + 1) % N) * 2 + 1;
      idx.push(a, b, c, b, d, c);
    }
    geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(posArr, 3));
    geo.setIndex(idx);
  } else {
    const sys = EXOSYSTEMS.find(function (s) { return s.key === state.sys; });
    geo = new THREE.RingGeometry(sys.hz[0], sys.hz[1], 96);
    geo.rotateX(-Math.PI / 2);
  }
  hzRing = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    color: 0x46d070, transparent: true, opacity: 0.10,
    side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending
  }));
  hzRing.visible = state.hz;
  hzRing.renderOrder = 0.5;
  scene.add(hzRing);
}
buildHZ();

/* ---- 彗星家族（v5.0 泛化：哈雷 + 恩克 + 67P + 海尔-波普，各自彗发与双彗尾） ---- */
const cometBodies = [];
[COMET_HALLEY].concat(COMETS_EXTRA).forEach(function (p) {
  const b = buildOrbitingBody(p, true);
  b.isComet = true;
  b.prevScene = new THREE.Vector3();
  b.activity = 0;
  const coma = new THREE.Sprite(new THREE.SpriteMaterial({
    map: T_GLOW, transparent: true, blending: THREE.AdditiveBlending,
    depthWrite: false, color: 0xbfe8ff, opacity: 0
  }));
  coma.scale.set(2, 2, 1);
  b.group.add(coma);
  b.coma = coma;
  b.ionTail = makeTail(80, 0x7fd4ff, 1.6);
  b.dustTail = makeTail(70, 0xffd9a0, 1.9);
  cometBodies.push(b);
});

function makeTail(count, color, size) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    size: size, map: T_DOT, vertexColors: true, transparent: true,
    opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  scene.add(pts);
  return { pts: pts, pos: pos, col: col, count: count, base: new THREE.Color(color) };
}
const _hv = new THREE.Vector3(), _anti = new THREE.Vector3(), _tang = new THREE.Vector3(), _p2 = new THREE.Vector3();
function updateComet(b) {
  if (state.sys !== 'solar') { b.ionTail.pts.visible = b.dustTail.pts.visible = false; return; }
  const rAU = b.aumag;
  let act = Math.max(0, Math.min(1, (3.6 - rAU) / 3.2));
  act = Math.pow(act, 1.35);
  b.activity = act;
  b.coma.material.opacity = act * 0.75;
  const cs = 1.4 + 4.5 * act;
  b.coma.scale.set(cs, cs, 1);
  const on = act > 0.02;
  b.ionTail.pts.visible = b.dustTail.pts.visible = on;
  if (!on) return;
  b.group.getWorldPosition(_hv);
  _anti.copy(_hv).normalize();
  _tang.copy(_hv).sub(b.prevScene);
  if (_tang.lengthSq() < 1e-9) _tang.set(0, 0, 1);
  _tang.normalize();
  if (b.prevScene.lengthSq() < 1e-9) b.prevScene.copy(_hv);
  const ionLen = 8 + 34 * act;
  const dustLen = 5 + 20 * act;
  const c1 = b.ionTail.base, c2 = b.dustTail.base;
  for (let i = 0; i < b.ionTail.count; i++) {
    const t = i / (b.ionTail.count - 1);
    const jit = t * 1.5;
    b.ionTail.pos[i * 3] = _hv.x + _anti.x * ionLen * t + (Math.random() - 0.5) * jit;
    b.ionTail.pos[i * 3 + 1] = _hv.y + _anti.y * ionLen * t + (Math.random() - 0.5) * jit;
    b.ionTail.pos[i * 3 + 2] = _hv.z + _anti.z * ionLen * t + (Math.random() - 0.5) * jit;
    const f = (1 - t) * 0.8;
    b.ionTail.col[i * 3] = c1.r * f; b.ionTail.col[i * 3 + 1] = c1.g * f; b.ionTail.col[i * 3 + 2] = c1.b * f;
  }
  for (let i = 0; i < b.dustTail.count; i++) {
    const t = i / (b.dustTail.count - 1);
    _p2.copy(_anti).addScaledVector(_tang, 0.55 * t).normalize();
    const jit = t * 2.2;
    b.dustTail.pos[i * 3] = _hv.x + _p2.x * dustLen * t + (Math.random() - 0.5) * jit;
    b.dustTail.pos[i * 3 + 1] = _hv.y + _p2.y * dustLen * t + (Math.random() - 0.5) * jit;
    b.dustTail.pos[i * 3 + 2] = _hv.z + _p2.z * dustLen * t + (Math.random() - 0.5) * jit;
    const f = (1 - t) * 0.7;
    b.dustTail.col[i * 3] = c2.r * f; b.dustTail.col[i * 3 + 1] = c2.g * f; b.dustTail.col[i * 3 + 2] = c2.b * f;
  }
  b.ionTail.pts.geometry.attributes.position.needsUpdate = true;
  b.ionTail.pts.geometry.attributes.color.needsUpdate = true;
  b.dustTail.pts.geometry.attributes.position.needsUpdate = true;
  b.dustTail.pts.geometry.attributes.color.needsUpdate = true;
  b.prevScene.copy(_hv);
}

/* ---- 开普勒第二定律面积扇形（v6.0 C1）----
 * 跟随偏心天体（e>0.05）时绘制"近 30 天扫过"的着色扇形 */
let areaWedge = null, areaToastShown = false;
function updateAreaWedge() {
  const b = state.follow;
  const active = b && !b.isSun && !b.isMoon && !b.isMoonExtra && !b.isProbe && !b.isExo && !b.isExoStar &&
    state.sys === 'solar' && b.data.elements && b.data.elements.e > 0.05;
  if (!active) {
    if (areaWedge) areaWedge.visible = false;
    return;
  }
  if (!areaWedge) {
    areaWedge = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshBasicMaterial({
        transparent: true, opacity: 0.22, side: THREE.DoubleSide,
        depthWrite: false, blending: THREE.AdditiveBlending
      })
    );
    areaWedge.frustumCulled = false;
    scene.add(areaWedge);
  }
  areaWedge.material.color.setHex(b.data.color);
  areaWedge.visible = true;
  if (!areaToastShown) {
    areaToastShown = true;
    toast(t8('ui.areaLaw', '📐 面积定律：着色区为近 30 天扫过的扇形——近日点短而胖、远日点长而瘦，面积相等'));
  }
  const N = 24, span = 30;
  const verts = [0, 0, 0];
  for (let i = 0; i <= N; i++) {
    helioPos(b.data, state.simDays - span + span * i / N, _tmp);
    mapAU(_tmp.x, _tmp.y, _tmp.z, _v3);
    verts.push(_v3.x, _v3.y, _v3.z);
  }
  const idx = [];
  for (let i = 1; i <= N; i++) idx.push(0, i, i + 1);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setIndex(idx);
  areaWedge.geometry.dispose();
  areaWedge.geometry = geo;
}

/* ---- 月球 + 大卫星 ---- */
const moonBody = { data: MOON_DATA, isSun: false, isMoon: true, aumag: 0.00257, lastRotRaw: 0, labelNear: 90 };
{
  const earth = bodies.find(function (b) { return b.data.key === 'earth'; });
  const group = new THREE.Group();
  const r = planetVisualRadius(MOON_DATA.radiusKm) * 0.85;
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(r, 32, 24),
    new THREE.MeshStandardMaterial({ map: T.moon, roughness: 1, metalness: 0 })
  );
  group.add(mesh);
  moonBody.group = group; moonBody.mesh = mesh;
  moonBody.label = makeLabel('🌙 ' + t8('body.moon', '月球'));
  addPick(moonBody, group, Math.max(r * 1.8, 1.1));
  makeHighlight(moonBody, group, r);
  earth.group.add(group);
  bodies.push(moonBody);
  moonBody.parentBody = earth;
}
MOONS_EXTRA.forEach(function (m) {
  const parent = bodies.find(function (b) { return b.data.key === m.parent; });
  const body = {
    data: m, isSun: false, isMoonExtra: true, aumag: parent ? parent.aumag : 0,
    lastRotRaw: 0, labelNear: 46, parentBody: parent
  };
  const group = new THREE.Group();
  const r = Math.max(planetVisualRadius(m.radiusKm) * 0.8, 0.34);
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(r, 24, 16),
    new THREE.MeshStandardMaterial({ map: T[m.key], roughness: 1, metalness: 0 })
  );
  group.add(mesh);
  body.group = group; body.mesh = mesh; body.visualR = r;
  body.label = makeLabel(m.name.split('（')[0]);
  addPick(body, group, Math.max(r * 1.9, 1.0));
  makeHighlight(body, group, r);
  parent.group.add(group);
  bodies.push(body);
});

/* ---- 小行星带 / 柯伊伯带 / 特洛伊群 ---- */
const BELT_COUNT = 2200, KUIPER_COUNT = 2400, TROJAN_COUNT = 760;
let beltPoints, kuiperPoints, trojanPoints;
let beltData, kuiperData, trojanData;

function buildPointCloud(count, size, color, opacity) {
  const pos = new Float32Array(count * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    size: size, map: T_DOT, transparent: true, opacity: opacity,
    color: color, sizeAttenuation: true, depthWrite: false
  });
  const pts = new THREE.Points(geo, mat);
  scene.add(pts);
  return pts;
}
(function buildBelt() {
  beltData = { a: [], e: [], peri: [], incl: [], node: [], phase: [], period: [] };
  for (let i = 0; i < BELT_COUNT; i++) {
    const t = Math.random();
    const a = 2.08 + Math.pow(t, 1.4) * 1.32;
    beltData.a.push(a);
    beltData.e.push(Math.random() * 0.13);
    beltData.peri.push(Math.random() * TAU);
    beltData.incl.push((Math.random() - 0.5) * 0.28);
    beltData.node.push(Math.random() * TAU);
    beltData.phase.push(Math.random() * TAU);
    beltData.period.push(365.25 * Math.pow(a, 1.5));
  }
  beltPoints = buildPointCloud(BELT_COUNT, 0.85, 0x9a9184, 0.8);
})();
(function buildKuiper() {
  kuiperData = { a: [], e: [], incl: [], node: [], phase: [], period: [] };
  for (let i = 0; i < KUIPER_COUNT; i++) {
    const a = 30 + Math.pow(Math.random(), 0.8) * 19;
    kuiperData.a.push(a);
    kuiperData.e.push(Math.random() * 0.12);
    kuiperData.incl.push((Math.random() - 0.5) * 0.5);
    kuiperData.node.push(Math.random() * TAU);
    kuiperData.phase.push(Math.random() * TAU);
    kuiperData.period.push(365.25 * Math.pow(a, 1.5));
  }
  kuiperPoints = buildPointCloud(KUIPER_COUNT, 1.0, 0x7a90b8, 0.62);
})();
(function buildTrojans() {
  trojanData = { side: [], dLon: [], rFac: [], incl: [], node: [] };
  for (let i = 0; i < TROJAN_COUNT; i++) {
    trojanData.side.push(i % 2 === 0 ? 1 : -1);
    const g = (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
    trojanData.dLon.push(g * 0.26);
    trojanData.rFac.push(1 + (Math.random() - 0.5) * 0.09);
    trojanData.incl.push((Math.random() - 0.5) * 0.44);
    trojanData.node.push(Math.random() * TAU);
  }
  trojanPoints = buildPointCloud(TROJAN_COUNT, 0.85, 0x8fae8a, 0.72);
})();

function updateBelt() {
  if (!state.showBelt || state.sys !== 'solar') return;
  const pos = beltPoints.geometry.attributes.position.array;
  for (let i = 0; i < BELT_COUNT; i++) {
    const th = beltData.phase[i] + TAU * state.simDays / beltData.period[i];
    const r = beltData.a[i] * (1 - beltData.e[i] * beltData.e[i]) /
      (1 + beltData.e[i] * Math.cos(th - beltData.peri[i]));
    const x = r * Math.cos(th), y = r * Math.sin(th);
    const z = r * Math.sin(beltData.incl[i]) * Math.sin(th - beltData.node[i]);
    mapAU(x, y, z, _v3);
    pos[i * 3] = _v3.x; pos[i * 3 + 1] = _v3.y; pos[i * 3 + 2] = _v3.z;
  }
  beltPoints.geometry.attributes.position.needsUpdate = true;
}
function updateKuiper() {
  if (!state.showBelt || state.sys !== 'solar') return;
  const pos = kuiperPoints.geometry.attributes.position.array;
  for (let i = 0; i < KUIPER_COUNT; i++) {
    const th = kuiperData.phase[i] + TAU * state.simDays / kuiperData.period[i];
    const r = kuiperData.a[i];
    const x = r * Math.cos(th), y = r * Math.sin(th);
    const z = r * Math.sin(kuiperData.incl[i]) * Math.sin(th - kuiperData.node[i]);
    mapAU(x, y, z, _v3);
    pos[i * 3] = _v3.x; pos[i * 3 + 1] = _v3.y; pos[i * 3 + 2] = _v3.z;
  }
  kuiperPoints.geometry.attributes.position.needsUpdate = true;
}
function updateTrojans() {
  if (!state.showBelt || state.sys !== 'solar') return;
  const jupR = Math.sqrt(jupiterEcl.x * jupiterEcl.x + jupiterEcl.y * jupiterEcl.y);
  const jupLon = Math.atan2(jupiterEcl.y, jupiterEcl.x);
  const pos = trojanPoints.geometry.attributes.position.array;
  for (let i = 0; i < TROJAN_COUNT; i++) {
    const lon = jupLon + (Math.PI / 3) * trojanData.side[i] + trojanData.dLon[i];
    const r = jupR * trojanData.rFac[i];
    const x = r * Math.cos(lon), y = r * Math.sin(lon);
    const z = r * Math.sin(trojanData.incl[i]) * Math.sin(lon - trojanData.node[i]);
    mapAU(x, y, z, _v3);
    pos[i * 3] = _v3.x; pos[i * 3 + 1] = _v3.y; pos[i * 3 + 2] = _v3.z;
  }
  trojanPoints.geometry.attributes.position.needsUpdate = true;
}

/* ---- 探测器足迹（科普级近似轨迹） ---- */
const probeGroup = new THREE.Group();
probeGroup.visible = state.showProbes;
scene.add(probeGroup);
const _day = function (s) { return (new Date(s + 'T12:00:00Z').getTime() - EPOCH_MS) / 86400000; };

function probeAU(body, days) {
  const a = body.anchors;
  if (days <= a[0].day) return 0.6;
  for (let i = 1; i < a.length; i++) {
    if (days <= a[i].day) {
      const t = (days - a[i - 1].day) / (a[i].day - a[i - 1].day);
      return a[i - 1].au + (a[i].au - a[i - 1].au) * t;
    }
  }
  const last = a[a.length - 1];
  return last.au + body.data.speedAUyr * (days - last.day) / 365.25;
}
function probeEcl(body, days, out) {
  const au = probeAU(body, days);
  const ramp = body.data.latRamp;
  const t = Math.max(0, Math.min(1, (au - ramp[0]) / (ramp[1] - ramp[0])));
  const lat = body.data.dir.lat * (t * t * (3 - 2 * t));
  const lo = body.data.dir.lon * D2R, la = lat * D2R;
  out.x = au * Math.cos(la) * Math.cos(lo);
  out.y = au * Math.cos(la) * Math.sin(lo);
  out.z = au * Math.sin(la);
  return au;
}

const probeBodies = [];
PROBES.forEach(function (p) {
  const body = { data: p, isProbe: true, aumag: 0.6 };
  const group = new THREE.Group();
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({
    map: T_DOT, color: p.color, transparent: true, depthWrite: false, opacity: 0.95
  }));
  sp.scale.set(2.4, 2.4, 1);
  group.add(sp);
  body.mesh = sp;
  body.visualR = 1;
  body.label = makeLabel('🛰️ ' + p.name);
  addPick(body, group, 2.6);
  makeHighlight(body, group, 1.2);
  body.group = group;
  const anchors = [{ day: _day(p.launch), au: 0.6 }];
  p.events.forEach(function (ev) { anchors.push({ day: _day(ev[0]), au: ev[2] }); });
  body.anchors = anchors;
  probeGroup.add(group);
  bodies.push(body);
  probeBodies.push(body);
});

function buildProbeLine(body) {
  const d0 = _day(body.data.launch), d1 = _day('2050-01-01');
  const pts = [];
  for (let k = 0; k <= 100; k++) {
    probeEcl(body, d0 + (d1 - d0) * k / 100, _tmp);
    mapAU(_tmp.x, _tmp.y, _tmp.z, _v3);
    pts.push(new THREE.Vector3(_v3.x, _v3.y, _v3.z));
  }
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color: body.data.color, transparent: true, opacity: 0.32, depthWrite: false })
  );
  line.visible = state.showProbes && state.showOrbits;
  probeGroup.add(line);
  return line;
}
probeBodies.forEach(function (b) { b.orbitLine = buildProbeLine(b); });

function updateProbes() {
  if (!state.showProbes || state.sys !== 'solar') return;
  camera.getWorldPosition(camTmp);
  probeBodies.forEach(function (b) {
    b.group.visible = state.simDays >= b.anchors[0].day;
    if (!b.group.visible) { b.label.style.display = 'none'; return; }
    b.aumag = probeEcl(b, state.simDays, _tmp);
    mapAU(_tmp.x, _tmp.y, _tmp.z, _v3);
    b.group.position.copy(_v3);
    const s = Math.max(1.1, Math.min(34, camTmp.distanceTo(_v3) * 0.006));
    b.mesh.scale.set(s, s, 1);
  });
}

/* ---- 系外行星系统（v4.0 A2） ---- */
const exoGroup = new THREE.Group();
exoGroup.visible = false;
scene.add(exoGroup);
let exoBodies = [];
const exoBuilt = {};
const EXO_STAR_KM = { trappist1: 84200, proxima: 107200, kepler452: 772600 }; // 星半径（太阳半径换算 km）

function exoTypeName(hzIn) {
  return hzIn ? t8('exo.hzPlanet', '系外行星 · 宜居带内') : t8('exo.planet', '系外行星');
}

function buildExoSystem(key) {
  if (exoBuilt[key]) return;
  exoBuilt[key] = true;
  const sys = EXOSYSTEMS.find(function (s) { return s.key === key; });
  // 恒星
  const starData = {
    key: 'star_' + sys.key, name: sys.starName, en: sys.starEn, type: sys.starType,
    radiusKm: EXO_STAR_KM[sys.key] || 200000, massText: '—', distanceAU: 0,
    periodDays: 0, rotationHours: 0, tiltDeg: 0, moons: '—',
    tempC: sys.starTemp, gravity: '—', atmosphere: '—',
    desc: sys.starDesc, facts: sys.starFacts, color: sys.starColor
  };
  const star = { data: starData, isExoStar: true, isSun: false, isMoon: false, aumag: 0, lastRotRaw: 0 };
  const sGroup = new THREE.Group();
  const sMesh = new THREE.Mesh(
    new THREE.SphereGeometry(sys.starRadius, 48, 32),
    new THREE.MeshBasicMaterial({ color: sys.starColor })
  );
  sGroup.add(sMesh);
  const sGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: T_GLOW, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: sys.starColor
  }));
  sGlow.scale.set(sys.starRadius * 6, sys.starRadius * 6, 1);
  sGroup.add(sGlow);
  star.group = sGroup; star.mesh = sMesh;
  star.label = makeLabel('⭐ ' + sys.starName);
  star.label.classList.add('label-sun');
  addPick(star, sGroup, sys.starRadius * 1.4);
  makeHighlight(star, sGroup, sys.starRadius);
  const sLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0)]),
    new THREE.LineBasicMaterial({ visible: false })
  );
  sLine.visible = false;
  exoGroup.add(sLine);
  star.orbitLine = sLine;
  exoGroup.add(sGroup);
  exoBodies.push(star);
  // 行星
  sys.planets.forEach(function (p) {
    const data = {
      key: p.key, name: p.name, en: p.en, type: exoTypeName(p.hzIn),
      radiusKm: p.radiusKm, massText: '—', distanceAU: p.distanceAU,
      periodDays: p.periodDays, rotationHours: p.periodDays * 24, tiltDeg: 0,
      moons: '—', tempC: p.hzIn ? t8('exo.hzTemp', '宜居带内 · 可能存在液态水') : t8('exo.outTemp', '宜居带外'),
      gravity: '—', atmosphere: t8('exo.atmo', '待韦伯望远镜揭秘'),
      desc: p.desc, facts: p.facts, color: p.color
    };
    const body = {
      data: data, isSun: false, isMoon: false, isExo: true,
      distScene: p.distScene, periodDays: p.periodDays,
      aumag: p.distanceAU, lastRotRaw: 0
    };
    const group = new THREE.Group();
    const r = Math.max(planetVisualRadius(p.radiusKm), 0.5);
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(r, 32, 24),
      new THREE.MeshStandardMaterial({ color: p.color, roughness: 1, metalness: 0 })
    );
    group.add(mesh);
    if (p.hzIn) { // 宜居带成员加一圈淡绿描边光
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({
        map: T_DOT, color: 0x46d070, transparent: true, opacity: 0.28,
        blending: THREE.AdditiveBlending, depthWrite: false
      }));
      halo.scale.set(r * 3.2, r * 3.2, 1);
      group.add(halo);
    }
    body.group = group; body.mesh = mesh; body.visualR = r;
    body.label = makeLabel(p.name);
    addPick(body, group, Math.max(r * 1.7, 1.2));
    makeHighlight(body, group, r);
    // 圆轨道线（示意尺度）
    const pts = [];
    for (let k = 0; k <= 128; k++) {
      const th = k / 128 * TAU;
      pts.push(new THREE.Vector3(Math.cos(th) * p.distScene, 0, Math.sin(th) * p.distScene));
    }
    const orbit = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: p.color, transparent: true, opacity: 0.3, depthWrite: false })
    );
    orbit.visible = state.showOrbits;
    exoGroup.add(orbit);
    body.orbitLine = orbit;
    exoGroup.add(group);
    exoBodies.push(body);
  });
}

function updateExo() {
  exoBodies.forEach(function (b) {
    if (b.isExoStar) {
      b.mesh.rotation.y = TAU * (state.simDays / 25) % TAU;
      return;
    }
    const ang = TAU * (state.simDays - state.sysStartDays) / b.periodDays;
    b.group.position.set(Math.cos(ang) * b.distScene, 0, -Math.sin(ang) * b.distScene);
  });
}
