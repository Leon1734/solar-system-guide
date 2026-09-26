/* ============================================================
 * solar-ui.js —— 选中/跟随/档案卡 / 时间控制 / 开关 / 模态框 / 系统切换 / 偏好
 * ============================================================ */
'use strict';
if (window.SolarOK === false) { window.__abortQuiet = true; throw new Error('solar boot aborted'); }

/* ================= 选中 / 跟随 / 信息面板 ================= */
function findByKey(key) {
  return activeList().find(function (b) { return b.data.key === key; }) ||
    bodies.find(function (b) { return b.data.key === key; });
}
function selectBody(body, opts) {
  opts = opts || {};
  if (window.__duckRestore && (!body || body.data.key !== 'c67p')) window.__duckRestore();
  state.selected = body;
  activeList().forEach(function (b) {
    if (b.highlight) b.highlight.visible = false;
    if (b.orbitLine) b.orbitLine.material.opacity = b.minor ? 0.22 : 0.38;
  });
  if (body) {
    if (body.highlight) body.highlight.visible = true;
    if (body.orbitLine) body.orbitLine.material.opacity = 0.85;
    renderInfoPanel(body);
    $('info-panel').classList.remove('hidden');
    if (opts.follow) startFollow(body);
  } else {
    $('info-panel').classList.add('hidden');
  }
  updateChipActive();
}
function startFollow(body) {
  state.follow = body;
  const wp = new THREE.Vector3();
  body.group.getWorldPosition(wp);
  if (!body.isSun) {
    const r = body.visualR || planetVisualRadius(body.data.radiusKm || EARTH_RADIUS_KM);
    const dist = Math.max(r * 7, 6);
    const dir = new THREE.Vector3(0.55, 0.4, 1).normalize();
    camera.position.copy(wp).addScaledVector(dir, dist);
  }
  controls.target.copy(wp);
  updateFollowBtn();
}
function stopFollow() {
  state.follow = null;
  updateFollowBtn();
}
function resetView() {
  stopFollow();
  if (state.sys !== 'solar') {
    camera.position.set(0, 26, 46);
    controls.maxDistance = 300;
  } else if (state.distanceMode === 'real') {
    camera.position.set(0, 900, 1600);
    controls.maxDistance = 9000;
  } else {
    camera.position.set(0, 150, 280);
    controls.maxDistance = 1200;
  }
  controls.target.set(0, 0, 0);
}
function updateFollowBtn() {
  const btn = $('btn-follow');
  if (!btn) return;
  if (state.follow) { btn.textContent = t8('ui.unfollow', '✕ 取消跟随'); btn.classList.add('active'); }
  else { btn.textContent = t8('ui.follow', '🎯 跟随视角'); btn.classList.remove('active'); }
}
function infoRow(label, value, id) {
  return '<li' + (id ? ' id="' + id + '"' : '') + '><span class="k">' + label + '</span><span class="v">' + value + '</span></li>';
}
function fmtDiameter(d) {
  if (d.radiusKm < 10) return fmtNum(d.radiusKm * 1000, 0) + ' m';
  return fmtNum(d.radiusKm, 0) + ' km' +
    (d.key === 'earth' ? t8('info.basis', '（基准）') : t8('info.timesEarth', '（地球的 ') + fmtNum(d.radiusKm / EARTH_RADIUS_KM, 3) + t8('info.timesSuffix', ' 倍）'));
}
function renderInfoPanel(body) {
  const d = body.data;
  stopSpeakAudio();
  if (body.isProbe) {
    $('info-name').textContent = d.name;
    $('info-en').textContent = d.en;
    $('info-desc').textContent = d.desc;
    let rows = infoRow(t8('info.type', '类型'), d.type);
    rows += infoRow(t8('info.launch', '发射日期'), d.launch);
    rows += infoRow(t8('info.cruise', '巡航速度'), fmtNum(d.speedAUyr * AU_KM / 31557600, 1) + ' km/s');
    rows += infoRow(t8('info.liveNow', '当前距日'), '—', 'row-live');
    rows += '<li><span class="k">' + t8('info.events', '里程碑') + '</span><span class="v">' +
      d.events.map(function (ev) { return ev[0] + ' ' + ev[1]; }).join('<br>') + '</span></li>';
    rows += infoRow(t8('info.status', '状态'), d.status);
    $('info-rows').innerHTML = rows;
    $('info-facts').innerHTML = '<h3>' + t8('info.facts', '🔍 你知道吗') + '</h3><ul>' +
      d.facts.map(function (f) { return '<li>' + f + '</li>'; }).join('') + '</ul>';
    updateFollowBtn();
    return;
  }
  if (body.isExoStar) {
    $('info-name').textContent = d.name;
    $('info-en').textContent = d.en;
    $('info-desc').textContent = d.desc;
    let rows = infoRow(t8('info.type', '类型'), d.type);
    rows += infoRow(t8('info.diameter', '直径'), fmtNum(d.radiusKm, 0) + ' km');
    rows += infoRow(t8('info.temp', '表面温度'), d.tempC);
    $('info-rows').innerHTML = rows;
    $('info-facts').innerHTML = '<h3>' + t8('info.facts', '🔍 你知道吗') + '</h3><ul>' +
      d.facts.map(function (f) { return '<li>' + f + '</li>'; }).join('') + '</ul>';
    updateFollowBtn();
    return;
  }
  const L = function (k, fb) { return I18N.bodyField(d.key, k, fb); };
  $('info-name').textContent = L('name', d.name);
  $('info-en').textContent = d.en;
  $('info-desc').textContent = L('desc', d.desc);
  let rows = infoRow(t8('info.type', '类型'), L('type', d.type));
  rows += infoRow(t8('info.diameter', '直径'), fmtDiameter(d));
  rows += infoRow(t8('info.mass', '质量'), d.massText);
  if (d.key === 'moon') rows += infoRow(t8('info.distEarth', '距地球'), t8('info.moonDist', '约 38.44 万 km'));
  else if (body.isMoonExtra) rows += infoRow(t8('info.parent', '所属'), body.parentBody.data.name);
  else if (d.key !== 'sun') rows += infoRow(t8('info.avgDist', '平均日距'), fmtNum(d.distanceAU, 3) + ' AU（' + fmtNum(d.distanceAU * AU_KM / 1e6, 1) + t8('info.millionKm', ' 百万 km）'), 'row-dist');
  else rows += infoRow(t8('info.galOrbit', '银河系轨道'), t8('info.galDesc', '以约 220 km/s 绕银心运动'));
  if (d.key !== 'sun' && !body.isMoonExtra) rows += infoRow(state.sys === 'solar' ? t8('info.liveNow', '当前距日') : t8('info.liveStar', '当前距星'), '—', 'row-live');
  const orbitAround = d.key === 'sun' ? d.periodText :
    (d.key === 'moon' || body.isMoonExtra ? fmtPeriod(d.periodDays) + t8('info.around', '（绕') + (body.parentBody ? body.parentBody.data.name : t8('body.earth', '地球')) + '）' : fmtPeriod(d.periodDays));
  rows += infoRow(t8('info.period', '公转周期'), orbitAround);
  rows += infoRow(t8('info.rotation', '自转周期'), d.key === 'sun' ? d.rotationHours ? fmtRotation(d.rotationHours) : '—' : fmtRotation(d.rotationHours));
  rows += infoRow(t8('info.tilt', '转轴倾角'), d.tiltDeg + '°');
  rows += infoRow(t8('info.moons', '已知卫星'), String(d.moons));
  rows += infoRow(t8('info.temp', '表面温度'), d.tempC);
  rows += infoRow(t8('info.gravity', '表面重力'), d.gravity);
  rows += infoRow(t8('info.atmo', '大气'), d.atmosphere);
  $('info-rows').innerHTML = rows;
  $('info-facts').innerHTML = '<h3>' + t8('info.facts', '🔍 你知道吗') + '</h3><ul>' +
    d.facts.map(function (f, i) { return '<li>' + L('fact' + i, f) + '</li>'; }).join('') + '</ul>';
  // B3: 公转进度环（行星/矮行星）
  const progRow = document.getElementById('row-progress');
  if (progRow) progRow.remove();
  if (!body.isProbe && !body.isExoStar && d.key !== 'sun' && d.periodDays > 0 && d.elements) {
    const DISC = { uranus: '1781-03-13', neptune: '1846-09-23', pluto: '1930-02-18', ceres: '1801-01-01' };
    const since = DISC[d.key] ? dayOfStr(DISC[d.key]) : 0; // 0 = 自 J2000
    const laps = Math.max(0, (state.simDays - since) / d.periodDays);
    const pct = (laps % 1) * 100;
    const li = document.createElement('li');
    li.id = 'row-progress';
    li.innerHTML = '<span class="k">' + t8('info.progress', '公转进度') + '</span><span class="v">' +
      (DISC[d.key] ? t8('info.sinceDisc', '自发现以来') : t8('info.since2000', '自 2000 年以来')) +
      ' ' + laps.toFixed(2) + ' ' + t8('info.laps', '圈 · 当前圈 ') + pct.toFixed(0) + '%</span>';
    $('info-rows').appendChild(li);
  }
  // D1: 土星光环特写按钮
  $('btn-ring').style.display = d.key === 'saturn' ? '' : 'none';
  // v8.0: 67P 双瓣结构按钮
  $('btn-duck').style.display = d.key === 'c67p' ? '' : 'none';
  updateFollowBtn();
}
function updateLiveDistance() {
  const row = document.getElementById('row-live');
  if (!row || !state.selected) return;
  const b = state.selected;
  if (b.isSun || b.isExoStar) { row.style.display = 'none'; return; }
  if (b.isMoon) {
    row.innerHTML = '<span class="k">' + t8('info.moonNoteK', '距地（示意，已放大）') + '</span><span class="v">' + t8('info.moonDist', '约 38.44 万 km') + '</span>';
    return;
  }
  const au = b.aumag || b.data.distanceAU;
  row.innerHTML = '<span class="k">' + (state.sys === 'solar' ? t8('info.liveNow', '当前距日') : t8('info.liveStar', '当前距星')) + '</span><span class="v">' +
    fmtNum(au, 3) + ' AU（' + fmtNum(au * AU_KM / 1e6, 1) + t8('info.millionKm', ' 百万 km）') + '</span>';
}

/* 档案卡语音朗读（v4.0 C1） */
let speakAudio = null;
function stopSpeakAudio() {
  if (window.speechSynthesis) { try { speechSynthesis.cancel(); } catch (e) { } }
}
function bindSpeakBtn() {
  $('btn-speak').addEventListener('click', function () {
    if (!window.speechSynthesis) { toast(t8('ui.noTts', '当前浏览器不支持语音朗读')); return; }
    if (speechSynthesis.speaking) { stopSpeakAudio(); return; }
    const b = state.selected;
    if (!b) return;
    const d = b.data;
    const L = function (k, fb) { return I18N.bodyField(d.key, k, fb); };
    const text = d.name + '。' + L('desc', d.desc) + '。' +
      d.facts.slice(0, 2).map(function (f, i) { return L('fact' + i, f); }).join('。');
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = I18N.lang === 'en' ? 'en-US' : 'zh-CN';
      u.rate = 1.0;
      speechSynthesis.speak(u);
    } catch (e) { }
  });
  // D1: 土星环卡西尼缝特写
  $('btn-ring').addEventListener('click', function () {
    if (state.selected && state.selected.data.key === 'saturn') {
      window.SolarApp.goto('saturn', 3.6, 3.0);
      toast(t8('ui.ringView', '🛰️ 正在俯瞰光环——注意恩克缝与卡西尼缝的明暗分层'));
    }
  });
  // v8.0: 67P 双瓣结构特写
  $('btn-duck').addEventListener('click', function () {
    if (!window.__duckToggle) return;
    const on = window.__duckToggle();
    if (on) {
      window.SolarApp.goto('c67p', 2.6, 2.6);
      toast(t8('ui.duckView', '🦆 双瓣"橡皮鸭"结构：两个彗核天体低速相拥而成——罗塞塔号的著名发现'));
    } else {
      window.SolarApp.goto('c67p', 14, 2.2);
    }
  });
}

/* 日期字符串 → J2000 起天数（进度环用） */
function dayOfStr(s) { return (new Date(s + 'T12:00:00Z').getTime() - EPOCH_MS) / 86400000; }

/* ================= 拾取 ================= */
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let downX = 0, downY = 0, downT = 0;
const dom = renderer.domElement;
function pickAt(clientX, clientY) {
  const rect = dom.getBoundingClientRect();
  ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(pickMeshes, false);
  if (hits.length) return hits[0].object.userData.body;
  return null;
}
dom.addEventListener('pointerdown', function (e) {
  downX = e.clientX; downY = e.clientY; downT = Date.now();
});
dom.addEventListener('pointerup', function (e) {
  const moved = Math.hypot(e.clientX - downX, e.clientY - downY);
  if (moved < 6 && Date.now() - downT < 600) {
    const b = pickAt(e.clientX, e.clientY);
    if (b) selectBody(b, { follow: false });
  }
});
dom.addEventListener('dblclick', function (e) {
  const b = pickAt(e.clientX, e.clientY);
  if (b) selectBody(b, { follow: true });
});
let hoverPending = null;
dom.addEventListener('pointermove', function (e) { hoverPending = e; });
function updateHover() {
  if (!hoverPending) return;
  const e = hoverPending; hoverPending = null;
  dom.style.cursor = pickAt(e.clientX, e.clientY) ? 'pointer' : '';
}

/* ================= chips / 时间 / 开关 ================= */
function chipDefs() {
  if (state.sys !== 'solar') {
    const sys = EXOSYSTEMS.find(function (s) { return s.key === state.sys; });
    const defs = [{ key: 'star_' + sys.key, label: '⭐ ' + sys.starName }];
    sys.planets.forEach(function (p) { defs.push({ key: p.key, label: p.name }); });
    defs.push({ key: '__solar', label: '↩ ' + t8('ui.solarSys', '太阳系'), action: 'solar' });
    return defs;
  }
  const icons = { mercury: '☿', venus: '♀', earth: '🌍', mars: '♂', jupiter: '🪐', saturn: '🪐', uranus: '🔷', neptune: '🔵' };
  return [{ key: 'sun', label: '☀️ ' + t8('body.sun', '太阳') }]
    .concat(PLANETS.map(function (p) { return { key: p.key, label: (icons[p.key] || '•') + ' ' + p.name }; }))
    .concat([
      { key: 'halley', label: '☄️ ' + t8('body.halley', '哈雷彗星') },
      { key: 'encke', label: '☄️ ' + t8('body.encke', '恩克') },
      { key: 'c67p', label: '☄️ ' + t8('body.c67p', '67P') },
      { key: 'halebopp', label: '☄️ ' + t8('body.halebopp', '海尔-波普') },
      { key: 'pluto', label: '🏔️ ' + t8('body.pluto', '冥王星') },
      { key: 'apophis', label: '🪨 ' + t8('body.apophis', '阿波菲斯') },
      { key: 'vesta', label: '🪨 ' + t8('body.vesta', '灶神星') },
      { key: 'pallas', label: '🪨 ' + t8('body.pallas', '智神星') },
      { key: 'moon', label: '🌙 ' + t8('body.moon', '月球') }
    ]);
}
function renderChips() {
  const root = $('planet-chips');
  root.innerHTML = '';
  chipDefs().forEach(function (c) {
    const btn = document.createElement('button');
    btn.className = 'chip';
    btn.dataset.key = c.key;
    btn.textContent = c.label;
    btn.addEventListener('click', function () {
      if (c.action === 'solar') { setSystem('solar'); return; }
      const b = findByKey(c.key);
      if (b) selectBody(b, { follow: true });
    });
    root.appendChild(btn);
  });
  updateChipActive();
}
function updateChipActive() {
  document.querySelectorAll('.chip').forEach(function (el) {
    el.classList.toggle('active', !!state.selected && el.dataset.key === state.selected.data.key);
  });
}
function updatePlayBtn() { $('btn-play').textContent = state.paused ? '▶' : '⏸'; }
$('btn-play').addEventListener('click', function () {
  state.paused = !state.paused; updatePlayBtn();
});
$('btn-today').addEventListener('click', function () {
  if (state.sys !== 'solar') { toast(t8('ui.noDateExo', '系外系统使用相对时间，不支持日历日期')); return; }
  state.simDays = (Date.now() - EPOCH_MS) / 86400000;
  syncDateInput();
});
function syncDateInput() {
  if (state.sys !== 'solar') return;
  const d = simDate();
  $('date-input').value = d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate());
}
$('date-input').addEventListener('change', function () {
  const v = this.value;
  if (!v) return;
  if (state.sys !== 'solar') { toast(t8('ui.noDateExo', '系外系统使用相对时间，不支持日历日期')); return; }
  const parts = v.split('-');
  const t = Date.UTC(+parts[0], +parts[1] - 1, +parts[2], 12);
  if (isFinite(t)) state.simDays = (t - EPOCH_MS) / 86400000;
});
function speedFromSlider(v) { return 0.1 * Math.pow(10, v / 25); }
function sliderFromSpeed(s) {
  return Math.max(0, Math.min(100, Math.round(25 * Math.log10(s / 0.1))));
}
function updateSpeedReadout() {
  const s = state.speed, en = I18N && I18N.lang === 'en';
  let text;
  if (s < 1) text = (s * 24).toFixed(1) + ' ' + (en ? 'hrs / s' : '小时 / 秒');
  else if (s < 30) text = (s < 3 ? s.toFixed(1) : s.toFixed(0)) + ' ' + (en ? 'days / s' : '天 / 秒');
  else if (s < 365) text = (s / 30.44).toFixed(1) + ' ' + (en ? 'mo / s' : '月 / 秒');
  else text = (s / 365.25).toFixed(s / 365.25 < 10 ? 1 : 0) + ' ' + (en ? 'yr / s' : '年 / 秒');
  $('speed-readout').textContent = text;
}
function setSpeed(s, syncSlider) {
  state.speed = s;
  if (syncSlider !== false) $('speed-slider').value = sliderFromSpeed(s);
  updateSpeedReadout();
}
$('speed-slider').addEventListener('input', function () {
  setSpeed(speedFromSlider(+this.value), false);
});

$('tg-orbits').addEventListener('change', function () {
  state.showOrbits = this.checked;
  activeList().forEach(function (b) { if (b.orbitLine && !(b.isExoStar)) b.orbitLine.visible = state.showOrbits; });
});
$('tg-labels').addEventListener('change', function () {
  state.showLabels = this.checked;
  labelsRoot.style.display = state.showLabels ? '' : 'none';
});
$('tg-belt').addEventListener('change', function () {
  state.showBelt = this.checked;
  beltPoints.visible = kuiperPoints.visible = trojanPoints.visible = state.showBelt && state.sys === 'solar';
});
$('tg-bloom').addEventListener('change', function () {
  state.bloom = this.checked && !!composer;
  if (!composer) toast(t8('ui.noBloom', '当前环境未加载后处理模块'));
});
$('tg-realtex').addEventListener('change', function () {
  if (this.checked) loadRealTextures();
  else restoreProceduralTextures();
});
$('btn-hz').addEventListener('click', function () {
  state.hz = !state.hz;
  this.classList.toggle('active', state.hz);
  if (hzRing) hzRing.visible = state.hz;
  toast(state.hz ? t8('ui.hzOn', '🟢 已显示宜居带——地球正在绿区中央') : t8('ui.hzOff', '已隐藏宜居带'));
  savePrefs();
});

function setMode(m) {
  if (m === state.distanceMode) return;
  if (state.sys !== 'solar') { toast(t8('ui.noModeExo', '系外系统为示意尺度，不支持距离模式切换')); return; }
  state.distanceMode = m;
  $('btn-mode').textContent = m === 'compressed' ? t8('ui.modeC', '距离：压缩（观赏）') : t8('ui.modeR', '距离：真实（1AU=42格）');
  rebuildOrbits();
  resetView();
}
$('btn-mode').addEventListener('click', function () {
  setMode(state.distanceMode === 'compressed' ? 'real' : 'compressed');
});
$('btn-probe').addEventListener('click', function () {
  state.showProbes = !state.showProbes;
  this.classList.toggle('active', state.showProbes);
  probeGroup.visible = state.showProbes;
  toast(state.showProbes ? t8('ui.probeOn', '🛰️ 已显示探测器足迹——试试把日期拨到 1989 年') : t8('ui.probeOff', '已隐藏探测器足迹'));
});
$('btn-follow').addEventListener('click', function () {
  if (state.follow) stopFollow();
  else if (state.selected) startFollow(state.selected);
});
$('btn-close-info').addEventListener('click', function () {
  selectBody(null);
  stopFollow();
});

/* ================= 系统切换（v4.0 A2） ================= */
function setSystem(key) {
  if (state.sys === key) return;
  if (window.TourEngine && TourEngine.active()) TourEngine.exit();
  selectBody(null);
  const goingExo = key !== 'solar';
  if (goingExo) buildExoSystem(key);
  state.sys = key;
  exoGroup.visible = goingExo;
  bodies.forEach(function (b) {
    if (b.group && !b.isProbe) b.group.visible = !goingExo;
    if (b.orbitLine && !b.isProbe) b.orbitLine.visible = !goingExo && state.showOrbits;
  });
  probeGroup.visible = !goingExo && state.showProbes;
  beltPoints.visible = kuiperPoints.visible = trojanPoints.visible = !goingExo && state.showBelt;
  pickMeshes.length = 0;
  activeList().forEach(function (b) { if (b.pick) pickMeshes.push(b.pick); });
  if (goingExo) {
    const sys = EXOSYSTEMS.find(function (s) { return s.key === key; });
    state.sysStartDays = state.simDays;
    camera.position.set(0, sys.hz[1] * 1.8 + 8, sys.hz[1] * 3.2 + 14);
    controls.target.set(0, 0, 0);
    controls.maxDistance = 400;
  } else {
    resetView();
  }
  buildHZ();
  renderChips();
  $('sys-select').value = key;
  const name = goingExo ? EXOSYSTEMS.find(function (s) { return s.key === key; }).name : t8('ui.solarSys', '太阳系');
  toast((goingExo ? '🚀 ' : '🏠 ') + t8('ui.sysSwitch', '已切换到：') + name);
}
$('sys-select').addEventListener('change', function () {
  setSystem(this.value);
});

/* ================= 真实贴图（可选联网） ================= */
const REAL_BASE = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r147/examples/textures/planets/';
const REAL_MAPS = {
  earth: 'earth_atmos_2048.jpg',
  clouds: 'earth_clouds_1024.png',
  moon: 'moon_1024.jpg',
  mars: 'mars_1k_color.jpg'
};
function loadRealTextures() {
  if (!navigator.onLine) { toast(t8('ui.offline', '当前离线，继续使用程序化贴图')); $('tg-realtex').checked = false; return; }
  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin('anonymous');
  let ok = 0, fail = 0, total = 0;
  const done = function () {
    if (ok + fail < total) return;
    toast(fail === 0 ? t8('ui.realTexOk', '✅ 已加载 NASA 真实贴图（地球/月球/火星）') :
      t8('ui.realTexPart', '部分贴图加载失败，已保留程序化贴图'));
    if (fail === total) $('tg-realtex').checked = false;
  };
  Object.keys(REAL_MAPS).forEach(function (k) {
    total++;
    loader.load(REAL_BASE + REAL_MAPS[k], function (tex) {
      tex.encoding = THREE.sRGBEncoding;
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      const body = findByKey(k === 'clouds' ? 'earth' : k);
      if (!body) { fail++; done(); return; }
      if (k === 'clouds') { body.cloudMesh.material.map = tex; body.cloudMesh.material.needsUpdate = true; }
      else { body.mesh.material.map = tex; body.mesh.material.needsUpdate = true; }
      ok++; done();
    }, undefined, function () { fail++; done(); });
  });
  state.realTex = true;
}
function restoreProceduralTextures() {
  const earth = findByKey('earth'), moon = findByKey('moon'), mars = findByKey('mars');
  if (earth) {
    earth.mesh.material.map = proceduralMaps.earth;
    earth.cloudMesh.material.map = proceduralMaps.clouds;
    earth.mesh.material.needsUpdate = earth.cloudMesh.material.needsUpdate = true;
  }
  if (moon) { moon.mesh.material.map = proceduralMaps.moon; moon.mesh.material.needsUpdate = true; }
  if (mars) { mars.mesh.material.map = proceduralMaps.mars; mars.mesh.material.needsUpdate = true; }
  state.realTex = false;
  toast(t8('ui.procTex', '已恢复程序化贴图'));
}

/* ================= 模态框 ================= */
const MODALS = ['modal-size', 'modal-science', 'modal-help', 'modal-tours', 'modal-badges', 'modal-compare', 'modal-eclipse', 'modal-starlife', 'modal-transit', 'modal-meteors', 'modal-sky', 'modal-moon', 'modal-calendar', 'modal-quiz'];
function closeAllModals() {
  MODALS.forEach(function (id) { $(id).classList.add('hidden'); });
}
function bindModal(openBtn, modalId) {
  const modal = $(modalId);
  $(openBtn).addEventListener('click', function () {
    closeAllModals();
    modal.classList.remove('hidden');
    if (modalId === 'modal-size') drawSizeComparison();
    if (modalId === 'modal-transit' && window.TransitLab) TransitLab.start();
    if (modalId === 'modal-meteors' && window.MeteorLab) MeteorLab.start();
    if (modalId === 'modal-starlife' && window.StarLife) StarLife.start();
  });
  modal.querySelectorAll('.modal-close').forEach(function (el) {
    el.addEventListener('click', function () { modal.classList.add('hidden'); });
  });
  modal.addEventListener('click', function (e) {
    if (e.target === modal) modal.classList.add('hidden');
  });
}

function buildScienceContent() {
  $('science-kepler').innerHTML = SCIENCE.kepler.map(function (k, i) {
    const o = I18N.scienceKepler(i);
    return '<div class="law-card"><div class="law-title">' + o.icon + ' ' + o.title + '</div><p>' + o.text + '</p></div>';
  }).join('');
  $('science-tips').innerHTML = SCIENCE.tips.map(function (tp, i) {
    const o = I18N.scienceTip(i);
    return '<details><summary>' + o[0] + '</summary><p>' + o[1] + '</p></details>';
  }).join('');
}
function buildHelpContent() {
  const items = I18N.helpItems();
  $('help-list').innerHTML = items.map(function (h) {
    return '<div class="help-row"><span class="hk">' + h[0] + '</span><span class="hv">' + h[1] + '</span></div>';
  }).join('') +
    '<p class="help-note">' + t8('ui.helpNote', '💡 切换"真实距离"模式感受太阳系的空旷；把日期设为生日看看那天的行星排列；链接可带参数分享：?date=2026-01-01&follow=saturn&mode=real&tour=kepler') + '</p>';
}

/* ================= 尺寸对比 ================= */
function drawSizeComparison() {
  const cv = $('size-canvas');
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height, CY = H * 0.5;
  ctx.clearRect(0, 0, W, H);
  const pxPerKm = 0.0008, gap = 22;
  const sunR = SUN_DATA.radiusKm * pxPerKm;
  const sunCX = -sunR * 0.62;
  const grad = ctx.createRadialGradient(sunCX + sunR * 0.7, CY, sunR * 0.2, sunCX, CY, sunR);
  grad.addColorStop(0, '#fff4c2'); grad.addColorStop(0.55, '#ffc23e'); grad.addColorStop(1, '#e2610f');
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(sunCX, CY, sunR, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ffd97a'; ctx.font = '15px sans-serif';
  ctx.fillText(t8('size.sunNote', '太阳（画面仅显示其边缘一小部分）'), 18, 40);
  let x = sunR + sunCX + 40;
  let earthX = 0, tier = 0;
  PLANETS.forEach(function (p) {
    const r = p.radiusKm * pxPerKm / 2;
    x += r;
    const g2 = ctx.createRadialGradient(x - r * 0.35, CY - r * 0.4, r * 0.15, x, CY, r);
    const c = '#' + ('00000' + p.color.toString(16)).slice(-6);
    g2.addColorStop(0, shadeColor(c, 40)); g2.addColorStop(1, shadeColor(c, -35));
    ctx.fillStyle = g2;
    ctx.beginPath(); ctx.arc(x, CY, r, 0, TAU); ctx.fill();
    if (p.key === 'earth') earthX = x;
    const small = r < 11;
    const ty = CY + Math.max(r, 16) + (small ? (tier % 2 === 0 ? 24 : 52) : 24);
    tier += small ? 1 : 0;
    ctx.fillStyle = '#dfe6f2'; ctx.textAlign = 'center';
    ctx.font = '12px sans-serif';
    ctx.fillText(p.name, x, ty);
    ctx.fillStyle = '#8fa0b8'; ctx.font = '10.5px sans-serif';
    ctx.fillText(fmtNum(p.radiusKm, 0) + ' km', x, ty + 15);
    if (small) {
      ctx.strokeStyle = 'rgba(140,170,220,0.35)';
      ctx.beginPath(); ctx.moveTo(x, CY + r + 2); ctx.lineTo(x, ty - 14); ctx.stroke();
    }
    ctx.textAlign = 'left';
    x += r + gap;
  });
  ctx.strokeStyle = 'rgba(120,180,255,0.5)';
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(earthX, CY - 58); ctx.lineTo(earthX, CY + 58);
  ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = '#8fa0b8'; ctx.font = '12px sans-serif';
  ctx.fillText(t8('size.note', '⟵ 所有天体均按真实比例线性绘制 ⟶'), W / 2 - 120, H - 14);
}
function shadeColor(hex, percent) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = Math.max(0, Math.min(255, Math.round(r + (percent / 100) * 255)));
  g = Math.max(0, Math.min(255, Math.round(g + (percent / 100) * 255)));
  b = Math.max(0, Math.min(255, Math.round(b + (percent / 100) * 255)));
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}

/* ================= 小知识滚动条 ================= */
let tickerPaused = false;
let tickerLast = -1;
function tickerNext() {
  const el = $('fact-ticker');
  const list = I18N.funFacts();
  let i;
  do { i = Math.floor(Math.random() * list.length); } while (i === tickerLast && list.length > 1);
  tickerLast = i;
  el.classList.remove('fade-in'); void el.offsetWidth;
  el.textContent = list[i];
  el.classList.add('fade-in');
}
(function ticker() {
  tickerNext();
  setInterval(function () { if (!tickerPaused) tickerNext(); }, 9000);
})();

/* ================= 偏好 / URL / 分享 ================= */
const PREF_KEY = 'solar_prefs_v2';
function savePrefs() {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify({
      slider: +$('speed-slider').value,
      showOrbits: state.showOrbits, showLabels: state.showLabels,
      showBelt: state.showBelt, bloom: state.bloom,
      bgIndex: state.bgIndex, hz: state.hz
    }));
  } catch (e) { }
}
function loadPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(PREF_KEY) || 'null');
    if (!p) return;
    if (typeof p.slider === 'number') { $('speed-slider').value = p.slider; setSpeed(speedFromSlider(p.slider), false); }
    if (p.showOrbits === false) { state.showOrbits = false; $('tg-orbits').checked = false; activeList().forEach(function (b) { if (b.orbitLine) b.orbitLine.visible = false; }); }
    if (p.showLabels === false) { state.showLabels = false; $('tg-labels').checked = false; labelsRoot.style.display = 'none'; }
    if (p.showBelt === false) { state.showBelt = false; $('tg-belt').checked = false; beltPoints.visible = kuiperPoints.visible = trojanPoints.visible = false; }
    if (p.bloom === false) { state.bloom = false; $('tg-bloom').checked = false; }
    if (typeof p.bgIndex === 'number' && BG_PRESETS[p.bgIndex]) { state.bgIndex = p.bgIndex; applyBg(); }
    if (p.hz === true) { state.hz = true; $('btn-hz').classList.add('active'); if (hzRing) hzRing.visible = true; }
  } catch (e) { }
}
['tg-orbits', 'tg-labels', 'tg-belt', 'tg-bloom'].forEach(function (id) {
  $(id).addEventListener('change', savePrefs);
});
$('speed-slider').addEventListener('change', savePrefs);
$('btn-hz').addEventListener('click', savePrefs);

$('btn-share').addEventListener('click', function () {
  const url = location.origin && location.protocol !== 'file:'
    ? location.origin + location.pathname
    : location.href.split('?')[0];
  const params = new URLSearchParams();
  if (state.sys !== 'solar') params.set('sys', state.sys);
  else {
    const d = simDate();
    params.set('date', d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate()));
  }
  if (state.follow) params.set('follow', state.follow.data.key);
  if (state.distanceMode === 'real') params.set('mode', 'real');
  if (state.hz) params.set('hz', '1');
  const full = url + '?' + params.toString();
  const done = function () { toast(t8('ui.copied', '🔗 链接已复制：') + full.slice(0, 60) + (full.length > 60 ? '…' : '')); };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(full).then(done, function () { toast(full); });
  } else toast(full);
});

function applyUrlParams() {
  const q = new URLSearchParams(location.search);
  if (q.get('lang') === 'en' && window.I18N) I18N.setLang('en', true);
  const sys = q.get('sys');
  if (sys && EXOSYSTEMS.find(function (s) { return s.key === sys; })) setSystem(sys);
  const dstr = q.get('date');
  if (state.sys === 'solar' && dstr && /^\d{4}-\d{2}-\d{2}$/.test(dstr)) {
    const parts = dstr.split('-');
    const t = Date.UTC(+parts[0], +parts[1] - 1, +parts[2], 12);
    if (isFinite(t)) { state.simDays = (t - EPOCH_MS) / 86400000; syncDateInput(); }
  }
  const sp = parseFloat(q.get('speed'));
  if (isFinite(sp) && sp > 0) setSpeed(sp);
  if (q.get('mode') === 'real') setMode('real');
  if (q.get('hz') === '1' && !state.hz) $('btn-hz').click();
  const fk = q.get('follow');
  if (fk) { const b = findByKey(fk); if (b) selectBody(b, { follow: true }); }
  if (q.get('freeze') === '1') { state.paused = true; updatePlayBtn(); }
  const tour = q.get('tour');
  if (tour && TOURS.find(function (t) { return t.id === tour; })) {
    setTimeout(function () { if (window.TourEngine) TourEngine.start(tour); }, 1600);
  }
  return q.get('view');
}

/* ================= 投影模式 ================= */
function setProject(on) {
  state.project = on;
  document.body.classList.toggle('projecting', on);
}
$('btn-project').addEventListener('click', function () { setProject(!state.project); });
$('btn-exit-project').addEventListener('click', function () { setProject(false); });

/* ================= 键盘 ================= */
window.addEventListener('keydown', function (e) {
  if (e.target && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox' && e.target.type !== 'range') return;
  if (e.target && e.target.tagName === 'SELECT') return;
  if (e.code === 'Space') {
    e.preventDefault();
    state.paused = !state.paused; updatePlayBtn();
  } else if (e.key === 'Escape') {
    const openModal = MODALS.some(function (id) { return !$(id).classList.contains('hidden'); });
    if (openModal) { closeAllModals(); return; }
    if (window.TourEngine && TourEngine.active()) { TourEngine.exit(); return; }
    if (state.project) { setProject(false); return; }
    if (state.selected) { selectBody(null); stopFollow(); }
    else resetView();
  } else if (e.key === 'ArrowLeft') {
    state.simDays -= e.shiftKey ? 30 : 1;
  } else if (e.key === 'ArrowRight') {
    state.simDays += e.shiftKey ? 30 : 1;
  }
});

/* ================= 模态框绑定与静态内容 ================= */
bindModal('btn-size', 'modal-size');
bindModal('btn-science', 'modal-science');
bindModal('btn-help', 'modal-help');
bindModal('btn-tours', 'modal-tours');
bindModal('btn-badges', 'modal-badges');
bindModal('btn-compare', 'modal-compare');
bindModal('btn-eclipse', 'modal-eclipse');
  bindModal('btn-starlife', 'modal-starlife');
bindModal('btn-transit', 'modal-transit');
bindModal('btn-meteors', 'modal-meteors');
bindModal('btn-sky', 'modal-sky');
bindModal('btn-moon', 'modal-moon');
bindModal('btn-cal', 'modal-calendar');
bindModal('btn-quiz', 'modal-quiz');
$('btn-const').addEventListener('click', function () {
  StarMap.toggle(!state.showConst);
  this.classList.toggle('active', state.showConst);
  toast(state.showConst ? t8('ui.constOn', '⭐ 已显示星座连线与黄道圈') : t8('ui.constOff', '已隐藏星座'));
  savePrefs();
});
$('btn-axis').addEventListener('click', function () {
  state.showAxis = !state.showAxis;
  this.classList.toggle('active', state.showAxis);
  (window.__axisLines || []).forEach(function (l) { l.visible = state.showAxis; });
  savePrefs();
});
/* v7.5 首次访问向导：三步提示（localStorage 记忆） */
function firstVisitGuide() {
  let seen = false;
  try { seen = localStorage.getItem('solar_seen_v1') === '1'; } catch (e) { }
  if (seen) return;
  try { localStorage.setItem('solar_seen_v1', '1'); } catch (e) { }
  const steps = [
    t8('ui.guide1', '👋 欢迎！左键拖拽旋转视角，滚轮缩放，单击天体看档案'),
    t8('ui.guide2', '🎓 推荐「漫游课程」：向导带你飞越太阳系，还能收集徽章'),
    t8('ui.guide3', '📅 天文日历 + 今晚天空：看看今天天上有什么')
  ];
  steps.forEach(function (msg, i) {
    setTimeout(function () { toast(msg); }, 800 + i * 4200);
  });
}
$('btn-starlife').addEventListener('click', function () {
  if (window.StarLife) window.StarLife.start();
});
bindSpeakBtn();
buildScienceContent();
buildHelpContent();
renderChips();
firstVisitGuide();

/* 系统下拉选项 */
(function fillSysSelect() {
  const sel = $('sys-select');
  const mk = function (val, label) {
    const o = document.createElement('option');
    o.value = val; o.textContent = label;
    sel.appendChild(o);
  };
  mk('solar', '☀️ ' + t8('ui.solarSys', '太阳系'));
  EXOSYSTEMS.forEach(function (s) { mk(s.key, '🪐 ' + s.name); });
})();

/* 语言切换后刷新动态内容 */
window.addEventListener('solar-lang', function () {
  buildScienceContent();
  buildHelpContent();
  renderChips();
  if (state.selected) renderInfoPanel(state.selected);
  updateSpeedReadout();
  updateFollowBtn();
  applyBg();
  tickerNext();
});
