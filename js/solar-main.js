/* ============================================================
 * solar-main.js —— 标签投影 / 相机补间 / SolarApp API / 主循环 / 启动
 * ============================================================ */
'use strict';
if (window.SolarOK === false) { window.__abortQuiet = true; throw new Error('solar boot aborted'); }

/* ================= 标签投影（近距显示规则） ================= */
const labelTmp = new THREE.Vector3();
function updateLabels() {
  if (!state.showLabels) return;
  camera.getWorldPosition(camTmp);
  activeList().forEach(function (b) {
    b.group.getWorldPosition(labelTmp);
    if (b.isProbe && !state.showProbes) { b.label.style.display = 'none'; return; }
    let visible = true;
    if (b.labelNear !== null && b.labelNear !== undefined) {
      const d = camTmp.distanceTo(labelTmp);
      const parentSel = b.parentBody && (state.selected === b.parentBody || state.follow === b.parentBody);
      const selfSel = state.selected === b || state.follow === b;
      if (b.isComet && b.activity > 0.03) visible = true;
      else visible = selfSel || parentSel || d < b.labelNear;
    }
    if (visible) {
      const above = b.visualR || planetVisualRadius(b.data.radiusKm) || 1;
      labelTmp.y += above + 1.2;
      labelTmp.project(camera);
      visible = labelTmp.z < 1 && Math.abs(labelTmp.x) < 1.1 && Math.abs(labelTmp.y) < 1.1;
      if (visible) {
        b.label.style.display = '';
        b.label.style.left = ((labelTmp.x * 0.5 + 0.5) * window.innerWidth) + 'px';
        b.label.style.top = ((-labelTmp.y * 0.5 + 0.5) * window.innerHeight) + 'px';
        return;
      }
    }
    b.label.style.display = 'none';
  });
}
bodies.forEach(function (b) {
  b.label.addEventListener('click', function () { selectBody(b, { follow: true }); });
});

/* ================= 相机补间 ================= */
let tween = null;
function tweenCam(opts) {
  opts = opts || {};
  opts.dur = opts.dur || 2.2;
  const startPos = camera.position.clone();
  const startTgt = controls.target.clone();
  if (opts.key) {
    const b = typeof opts.key === 'string' ? findByKey(opts.key) : opts.key;
    if (!b) return;
    state.follow = b;
    updateFollowBtn();
    const r = b.visualR || planetVisualRadius(b.data.radiusKm || EARTH_RADIUS_KM);
    const dist = opts.dist || Math.max(r * 7, 6);
    const wp = new THREE.Vector3();
    b.group.getWorldPosition(wp);
    const dir = wp.clone().sub(camera.position);
    dir.y = Math.abs(dir.y) < wp.length() * 0.05 ? wp.length() * 0.25 : dir.y;
    if (dir.lengthSq() < 1e-6) dir.set(0.55, 0.4, 1);
    dir.normalize();
    tween = {
      t: 0, dur: opts.dur, startPos: startPos, startTgt: startTgt,
      body: b, dist: dist, dir: dir
    };
  } else {
    stopFollow();
    const pos = opts.pos || [0, 150, 280];
    tween = {
      t: 0, dur: opts.dur, startPos: startPos, startTgt: startTgt,
      endPos: new THREE.Vector3(pos[0], pos[1], pos[2]), endTgt: new THREE.Vector3(0, 0, 0)
    };
  }
}
const twTgt = new THREE.Vector3(), twPos = new THREE.Vector3();
function updateTween(dt) {
  if (!tween) return;
  tween.t += dt / tween.dur;
  const e = smoothstep(Math.min(1, tween.t));
  let endPos, endTgt;
  if (tween.body) {
    tween.body.group.getWorldPosition(twTgt);
    endTgt = twTgt;
    endPos = twPos.copy(twTgt).addScaledVector(tween.dir, tween.dist);
  } else {
    endPos = tween.endPos; endTgt = tween.endTgt;
  }
  camera.position.lerpVectors(tween.startPos, endPos, e);
  controls.target.lerpVectors(tween.startTgt, endTgt, e);
  if (tween.t >= 1) tween = null;
}

/* ================= 脉冲高亮（课程用） ================= */
let pulseName = null, pulseUntil = 0;
const ringClouds = {
  belt: { obj: () => beltPoints, size: 0.85, op: 0.8 },
  kuiper: { obj: () => kuiperPoints, size: 1.0, op: 0.62 },
  trojan: { obj: () => trojanPoints, size: 0.85, op: 0.72 }
};
function pulse(name) {
  if (!ringClouds[name]) return;
  pulseName = name; pulseUntil = clock.elapsedTime + 6;
}
function applyPulse() {
  Object.keys(ringClouds).forEach(function (k) {
    const rc = ringClouds[k];
    const on = k === pulseName && clock.elapsedTime < pulseUntil;
    rc.obj().material.size = on ? rc.size * 2.2 : rc.size;
    rc.obj().material.opacity = on ? Math.min(1, rc.op * 1.6) : rc.op;
  });
}

/* ================= 自转 ================= */
function applySpin(b, rawAngle) {
  let delta = rawAngle - b.lastRotRaw;
  if (Math.abs(delta) > Math.PI) delta = normAngle(delta);
  if (delta > ROT_CLAMP) delta = ROT_CLAMP;
  if (delta < -ROT_CLAMP) delta = -ROT_CLAMP;
  b.mesh.rotation.y = (b.mesh.rotation.y + delta) % TAU;
  b.lastRotRaw = rawAngle;
}

/* ================= SolarApp 对外 API ================= */
const tickHooks = [], afterHooks = [];
const SolarApp = {
  version: '4.0',
  state: state, renderer: renderer, scene: scene, camera: camera, controls: controls,
  bodies: bodies, exoBodies: exoBodies,
  byKey: findByKey,
  selected: function () { return state.selected; },
  select: function (x, follow) {
    const b = typeof x === 'string' ? findByKey(x) : x;
    selectBody(b || null, { follow: !!follow });
  },
  follow: function (x) { const b = typeof x === 'string' ? findByKey(x) : x; if (b) selectBody(b, { follow: true }); },
  stopFollow: stopFollow,
  goto: function (key, dist, dur) { tweenCam({ key: key, dist: dist, dur: dur }); },
  gotoOrigin: function (pos, dur) { tweenCam({ origin: true, pos: pos, dur: dur }); },
  worldPos: function (key, out) {
    const b = findByKey(key);
    if (!b) return null;
    out = out || new THREE.Vector3();
    return b.group.getWorldPosition(out);
  },
  setDate: function (v) {
    if (typeof v === 'number') state.simDays = v;
    else if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      const p = v.split('-');
      const t = Date.UTC(+p[0], +p[1] - 1, +p[2], 12);
      if (isFinite(t)) state.simDays = (t - EPOCH_MS) / 86400000;
    }
    syncDateInput();
  },
  days: function () { return state.simDays; },
  setSpeed: function (s) { setSpeed(s); },
  pause: function () { state.paused = true; updatePlayBtn(); },
  resume: function () { state.paused = false; updatePlayBtn(); },
  setPaused: function (b) { state.paused = !!b; updatePlayBtn(); },
  setMode: setMode,
  setSystem: setSystem,
  setBeltVisible: function (on) {
    state.showBelt = !!on; $('tg-belt').checked = !!on;
    beltPoints.visible = kuiperPoints.visible = trojanPoints.visible = !!on && state.sys === 'solar';
  },
  pulse: pulse,
  toast: toast,
  setTickerPaused: function (b) { tickerPaused = !!b; },
  toggleProject: function (on) { setProject(on === undefined ? !state.project : on); },
  onTick: function (fn) { tickHooks.push(fn); },
  onAfterRender: function (fn) { afterHooks.push(fn); },
  tickOnce: function (dt) { simulate(dt || 0.016); renderFrame(dt || 0.016); },
  fmtNum: fmtNum, AU_KM: AU_KM, TAU: TAU
};
window.SolarApp = SolarApp;

/* ================= 自适应画质（v4.0 C3） ================= */
let fpsFrames = 0, fpsElapsed = 0, graceElapsed = 0;
function adaptQuality(dt) {
  graceElapsed += dt;
  if (graceElapsed < 8) return; // 启动宽限期（贴图上传会拖慢首几秒）
  fpsFrames++; fpsElapsed += dt;
  if (fpsElapsed < 3) return;
  const fps = fpsFrames / fpsElapsed;
  fpsFrames = 0; fpsElapsed = 0;
  if (fps >= 45) return;
  if (state.quality === 2 && state.bloom && composer) {
    state.quality = 1;
    state.bloom = false;
    $('tg-bloom').checked = false;
    toast(t8('ui.autoDegrade1', '⚡ 检测到帧率偏低，已自动关闭辉光以保证流畅'));
  } else if (state.quality === 1) {
    state.quality = 0;
    renderer.setPixelRatio(1);
    toast(t8('ui.autoDegrade2', '⚡ 已降低渲染分辨率以保证流畅（设置不受影响）'));
  }
}

/* ================= 动画主循环 ================= */
const clock = new THREE.Clock();
const worldPos = new THREE.Vector3();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.1);
  simulate(dt);
  renderFrame(dt);
  adaptQuality(dt);
}

/* 模拟推进（与渲染解耦，可由 tickOnce 手动驱动） */
function simulate(dt) {
  if (!state.paused) state.simDays += state.speed * dt;

  if (state.sys === 'solar') {
    bodies.forEach(function (b) {
      if (b.isSun) {
        b.mesh.rotation.y = TAU * (state.simDays / 25.38) % TAU;
        return;
      }
      if (b.isProbe) return; // 由 updateProbes 统一处理
      if (b.isMoon) {
        // v7.0：黄经用真实月球理论（月相与农历对齐），视觉距离仍为示意放大
        const lon = realMoonLonRad(state.simDays);
        const inc = 5.14 * D2R;
        b.group.position.set(
          Math.cos(lon) * MOON_VISUAL_DIST,
          Math.sin(lon) * MOON_VISUAL_DIST * Math.sin(inc),
          -Math.sin(lon) * MOON_VISUAL_DIST * Math.cos(inc)
        );
        applySpin(b, TAU * state.simDays * 24 / b.data.rotationHours);
        b.aumag = 0.00257;
        return;
      }
      if (b.isMoonExtra) {
        const ang = TAU * state.simDays / b.data.periodDays;
        b.group.position.set(Math.cos(ang) * b.data.distScene, 0, -Math.sin(ang) * b.data.distScene);
        applySpin(b, TAU * state.simDays * 24 / b.data.rotationHours);
        b.aumag = b.parentBody ? b.parentBody.aumag : 0;
        return;
      }
      b.elems = helioPos(b.data, state.simDays, _tmp);
      mapAU(_tmp.x, _tmp.y, _tmp.z, _v3);
      b.group.position.copy(_v3);
      b.aumag = Math.sqrt(_tmp.x * _tmp.x + _tmp.y * _tmp.y + _tmp.z * _tmp.z);
      if (b.data.key === 'jupiter') { jupiterEcl.x = _tmp.x; jupiterEcl.y = _tmp.y; jupiterEcl.z = _tmp.z; }
      applySpin(b, TAU * state.simDays * 24 / b.data.rotationHours);
      if (b.cloudMesh) b.cloudMesh.rotation.y = b.mesh.rotation.y * 1.12;
    });
    cometBodies.forEach(function (b) { updateComet(b); });
    // v8.0：67P 双瓣模型特写自转
    if (window.__duckSpin && window.__duckSpin.visible) {
      window.__duckSpin.rotation.y += dt * 0.5;
      window.__duckSpin.rotation.z += dt * 0.18;
    }
    updateBelt();
    updateTrojans();
    updateKuiper();
    updateProbes();
    updateAreaWedge();
  } else {
    updateExo();
  }

  updateTween(dt);

  if (state.follow && !tween) {
    state.follow.group.getWorldPosition(worldPos);
    const delta = worldPos.clone().sub(controls.target);
    camera.position.add(delta);
    controls.target.copy(worldPos);
  }
  controls.update();
  updateHover();
  applyPulse();

  activeList().forEach(function (b) {
    if (b.highlight && b.highlight.visible) {
      const s = (b.highlightBase || 1) * (1 + 0.1 * Math.sin(clock.elapsedTime * 4));
      b.highlight.scale.set(s, s, 1);
    }
  });

  // 日期 HUD（系外系统显示相对天数）
  if (state.sys === 'solar') {
    const d = simDate();
    $('sim-date').textContent = d.getUTCFullYear() + ' ' + t8('ui.year', '年') + ' ' + (d.getUTCMonth() + 1) + ' ' + t8('ui.month', '月') + ' ' +
      d.getUTCDate() + ' ' + t8('ui.day', '日') + ' ' + pad2(d.getUTCHours()) + ':' + pad2(d.getUTCMinutes());
  } else {
    const sys = EXOSYSTEMS.find(function (s) { return s.key === state.sys; });
    $('sim-date').textContent = sys.starName + ' · ' + t8('ui.dayN', '第 ') + Math.max(0, Math.floor(state.simDays - state.sysStartDays)) + ' ' + t8('ui.days', '天');
  }
  updateLiveDistance();
  updateLabels();

  for (let i = 0; i < tickHooks.length; i++) tickHooks[i](dt);
}

/* 渲染一帧 */
function renderFrame(dt) {
  if (state.bloom && composer) composer.render(dt || 0.016);
  else renderer.render(scene, camera);
  for (let i = 0; i < afterHooks.length; i++) afterHooks[i](dt);
}

window.addEventListener('resize', function () {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  if (composer) composer.setSize(window.innerWidth, window.innerHeight);
});

/* ================= 启动 ================= */
loadPrefs();
setSpeed(state.speed);
const tourParam = applyUrlParams();
syncDateInput();
updatePlayBtn();
animate();
if (tourParam) {
  const viewBtn = { transit: 'btn-transit', meteors: 'btn-meteors', starlife: 'btn-starlife', compare: 'btn-compare', eclipse: 'btn-eclipse', size: 'btn-size', science: 'btn-science', help: 'btn-help', tours: 'btn-tours', badges: 'btn-badges', sky: 'btn-sky', moon: 'btn-moon', cal: 'btn-cal', quiz: 'btn-quiz' }[tourParam];
  if (viewBtn) setTimeout(function () { $(viewBtn).click(); }, 1500);
}
// 隐藏加载屏（后台标签中 rAF 不触发，用定时器确保收尾）
setTimeout(function () {
  const ls = document.getElementById('loading-screen');
  if (ls) ls.classList.add('done');
}, 600);
