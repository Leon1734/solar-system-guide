/* ============================================================
 * cosmos.js —— v23.0 宇宙缩放之旅
 * 继续拉远滚轮跨越四级：太阳系 → 银河系 → 本星系群 → 可观测宇宙
 * 每级程序化粒子场景挂在远离原点的独立高度，互不干扰；
 * 相机重锚 + 黑幕过渡实现"无限缩放"感；标记物可点击出科普卡。
 * 依赖 solar-core 顶层词法：THREE/scene/camera/controls/state/T_DOT/T_GLOW/toast
 * ============================================================ */
'use strict';

window.CosmosLab = (function () {
  const $ = function (id) { return document.getElementById(id); };
  function t8(path, fb) { return (window.I18N && I18N.t(path)) || fb; }
  function EN() { return window.I18N && I18N.lang === 'en'; }

  const Y1 = 40000, Y2 = 76000, Y3 = 112000; // 三级挂载高度
  let level = 0, built = false, groups = [], markerSets = [[], [], []];
  let labelBox = null, fadeBox = null, cardBox = null, badgeBox = null;
  let savedCam = null, savedTgt = null, busy = false, pulseT = 0;

  /* ---------- 粒子工具 ---------- */
  function gauss() { return (Math.random() + Math.random() + Math.random() - 1.5) / 1.5; }
  function pointsCloud(pos, col, size, opacity) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const m = new THREE.PointsMaterial({
      size: size, map: T_DOT, vertexColors: true, transparent: true,
      opacity: opacity, sizeAttenuation: false, depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    return new THREE.Points(g, m);
  }
  function markerSprite(color, scale) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: T_GLOW, color: color, transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    sp.scale.set(scale, scale, 1);
    return sp;
  }
  /* 每级自带远景星幕（相机远离原点后仍有星空） */
  function starShell(radius, count) {
    const pos = [], col = [];
    for (let i = 0; i < count; i++) {
      const u = Math.random() * 2 - 1, ph = Math.random() * 6.283, r = radius * (0.85 + Math.random() * 0.15);
      const s = Math.sqrt(1 - u * u);
      pos.push(r * s * Math.cos(ph), r * u, r * s * Math.sin(ph));
      const t = Math.random();
      col.push(0.75 + t * 0.25, 0.78 + t * 0.2, 1.0);
    }
    return pointsCloud(pos, col, 2.2, 0.85);
  }
  /* 对数螺旋旋涡星系（银河系/仙女座/M33 共用生成器） */
  function spiralGalaxy(radius, N, tint) {
    const pos = [], col = [];
    const core = new THREE.Color(0xffe4c0), arm = new THREE.Color(tint || 0xa8b8ff), hii = new THREE.Color(0xff9fb8);
    for (let i = 0; i < N; i++) {
      const k = Math.random();
      let x, y, z, c;
      if (k < 0.22) { // 核心球状晕
        const r = radius * 0.16 * Math.pow(Math.random(), 1.6);
        const u = Math.random() * 2 - 1, ph = Math.random() * 6.283, s = Math.sqrt(1 - u * u);
        x = r * s * Math.cos(ph); y = r * u * 0.75; z = r * s * Math.sin(ph);
        c = core;
      } else if (k < 0.97) { // 双臂
        const arm = i % 2, t = Math.pow(Math.random(), 0.72);
        const th = t * 10.5 + arm * Math.PI + gauss() * (0.55 - 0.32 * t);
        const r = radius * (0.07 + 0.93 * t);
        x = r * Math.cos(th); z = r * Math.sin(th);
        y = gauss() * radius * 0.022 * (1.25 - t);
        c = t < 0.3 ? core.clone().lerp(arm, t / 0.3) : arm;
      } else { // HII 亮斑
        const arm = i % 2, t = 0.25 + Math.random() * 0.6;
        const th = t * 10.5 + arm * Math.PI + gauss() * 0.3;
        const r = radius * t;
        x = r * Math.cos(th); z = r * Math.sin(th); y = gauss() * radius * 0.015;
        c = hii;
      }
      pos.push(x, y, z);
      col.push(c.r, c.g, c.b);
    }
    const grp = new THREE.Group();
    grp.add(pointsCloud(pos, col, 2.8, 1.0));
    // 雾状光晕提升表面亮度
    const hazeCols = [0xffe0b8, 0xaebdff];
    for (let h = 0; h < 3; h++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: T_MILKY, color: hazeCols[h % 2], transparent: true,
        opacity: 0.22 - h * 0.04, blending: THREE.AdditiveBlending, depthWrite: false
      }));
      sp.scale.set(radius * (1.5 - h * 0.35), radius * (1.5 - h * 0.35) * 0.5, 1);
      grp.add(sp);
    }
    return grp;
  }
  /* 不规则矮星系（麦哲伦云） */
  function irregularGalaxy(radius, N, color) {
    const pos = [], col = [];
    const c = new THREE.Color(color);
    for (let i = 0; i < N; i++) {
      pos.push(gauss() * radius, gauss() * radius * 0.55, gauss() * radius);
      col.push(c.r, c.g, c.b);
    }
    return pointsCloud(pos, col, 2.4, 0.9);
  }
  /* 宇宙网纤维：沿随机折线撒点，节点处富集 */
  function cosmicWeb(radius) {
    const pos = [], col = [];
    const palette = [0xc8d8ff, 0xffe0c0, 0xffd0d8, 0xc0ffe8];
    const filaments = 9;
    for (let f = 0; f < filaments; f++) {
      let p = new THREE.Vector3(gauss() * radius, gauss() * radius * 0.6, gauss() * radius);
      const dir = new THREE.Vector3(gauss(), gauss() * 0.4, gauss()).normalize();
      const steps = 6 + Math.floor(Math.random() * 5);
      for (let s2 = 0; s2 < steps; s2++) {
        const segLen = radius * (0.16 + Math.random() * 0.2);
        const rich = s2 === 0 ? 260 : 90; // 节点（星系团）更密
        for (let i = 0; i < rich; i++) {
          const spread = s2 === 0 ? 26 : 9;
          pos.push(p.x + gauss() * spread, p.y + gauss() * spread * 0.6, p.z + gauss() * spread);
          const c = new THREE.Color(palette[Math.floor(Math.random() * palette.length)]);
          col.push(c.r, c.g, c.b);
        }
        dir.add(new THREE.Vector3(gauss(), gauss() * 0.5, gauss()).multiplyScalar(0.5)).normalize();
        p = p.clone().add(dir.clone().multiplyScalar(segLen));
      }
    }
    return pointsCloud(pos, col, 2.8, 0.9);
  }

  /* ---------- DOM UI ---------- */
  function ensureUI() {
    if (labelBox) return;
    labelBox = document.createElement('div');
    labelBox.id = 'cosmos-labels';
    document.body.appendChild(labelBox);
    fadeBox = document.createElement('div');
    fadeBox.id = 'cosmos-fade';
    document.body.appendChild(fadeBox);
    badgeBox = document.createElement('div');
    badgeBox.id = 'cosmos-badge';
    badgeBox.style.display = 'none';
    document.body.appendChild(badgeBox);
    const back = document.createElement('button');
    back.id = 'cosmos-back';
    back.style.display = 'none';
    back.addEventListener('click', function () { goLevel(0); });
    document.body.appendChild(back);
    cardBox = document.createElement('div');
    cardBox.id = 'cosmos-card';
    cardBox.classList.add('hidden');
    document.body.appendChild(cardBox);
  }
  const TITLES = [
    '', // 太阳系（主 HUD 已有）
    ['🌌 银河系 · 你在这里', '继续滚动滚轮拉远 → 本星系群'],
    ['🔗 本星系群', '继续拉远 → 宇宙网 · 或向内滚动返回'],
    ['🕸 可观测宇宙', '已到缩放之巅 · 向内滚动逐级返回']
  ];
  function updateChrome() {
    if (!badgeBox) return;
    const on = level > 0;
    badgeBox.style.display = on ? '' : 'none';
    $('cosmos-back').style.display = on ? '' : 'none';
    $('cosmos-back').textContent = '↩ ' + t8('cosmos.back', '回到太阳系');
    if (on) {
      badgeBox.innerHTML = '<b>' + TITLES[level][0] + '</b><span>' + TITLES[level][1] + '</span>';
    }
    if (!on) hideAllLabels();
    labelsRoot.style.display = on ? 'none' : '';
  }
  function hideLabelsTemp() { labelsRoot.style.display = 'none'; }

  /* ---------- 三级场景 ---------- */
  function addMarker(g, markerSets, li, pos, color, scale, info) {
    const sp = markerSprite(color, scale);
    sp.position.copy(pos);
    sp.userData.info = info;
    g.add(sp);
    markerSets[li - 1].push(sp);
    // DOM 标签
    const el = document.createElement('div');
    el.className = 'cosmos-label';
    el.textContent = (info.icon || '') + ' ' + (EN() && info.en ? info.en : info.n);
    el.addEventListener('click', function () { showCard(info); });
    labelBox.appendChild(el);
    sp.userData.el = el;
    return sp;
  }
  function buildL1() {
    const g = new THREE.Group(); g.position.set(0, Y1, 0); g.visible = false;
    g.add(starShell(3200, 2600));
    g.add(spiralGalaxy(380, 14000, 0xd2daff));
    // 太阳位置（猎户臂，约 0.62 半径处）
    const sunPos = new THREE.Vector3(96, 3, 158);
    addMarker(g, markerSets, 1, sunPos, 0xffd88a, 9, {
      n: '太阳系 · 你在这里', en: 'Solar System · You are here', icon: '🏠',
      t: '太阳位于猎户臂——银河系的一条小旋臂，距银河中心约 2.6 万光年，绕行一圈约 2.3 亿年（一个"银河年"）。'
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(10, 12, 48),
      new THREE.MeshBasicMaterial({ color: 0xffd88a, transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.copy(sunPos);
    g.add(ring); g.userData.ring = ring;
    addMarker(g, markerSets, 1, new THREE.Vector3(0, 0, 0), 0xffb46a, 14, {
      n: '人马座 A* · 超大质量黑洞', en: 'Sagittarius A* · Supermassive Black Hole', icon: '⚫',
      t: '银河系中心藏着 430 万倍太阳质量的黑洞——2019 年起事件视界望远镜为它拍了照。整个银河系都绕着它旋转。'
    });
    scene.add(g); return g;
  }
  function buildL2() {
    const g = new THREE.Group(); g.position.set(0, Y2, 0); g.visible = false;
    g.add(starShell(3200, 2600));
    // 银河系（缩小）
    const mw = spiralGalaxy(180, 5200, 0xc0ccff);
    mw.position.set(-120, 0, 60); g.add(mw);
    addMarker(g, markerSets, 2, new THREE.Vector3(-120, 0, 60), 0xffd88a, 8, {
      n: '银河系', en: 'Milky Way', icon: '🌌',
      t: '直径约 10 万光年的棒旋星系，含 1000~4000 亿颗恒星。本星系群第二大，仅次于仙女座星系。'
    });
    // 仙女座 M31（更大，倾斜）
    const m31 = spiralGalaxy(260, 6500, 0xc8d0ff);
    m31.rotation.set(0.9, 0.3, 0.4);
    m31.position.set(260, 10, -180); g.add(m31);
    addMarker(g, markerSets, 2, new THREE.Vector3(260, 10, -180), 0xd8e0ff, 10, {
      n: '仙女座星系 M31', en: 'Andromeda Galaxy · M31', icon: '🌀',
      t: '254 万光年外的旋涡星系，约 1 万亿颗恒星。正以 110 km/s 接近我们——约 45 亿年后与银河系相撞并合。'
    });
    // 三角座 M33
    const m33 = spiralGalaxy(90, 2200, 0xb8c8e8);
    m33.rotation.set(0.4, 0, 0.8);
    m33.position.set(150, -30, 230); g.add(m33);
    addMarker(g, markerSets, 2, new THREE.Vector3(150, -30, 230), 0xc8d8f0, 6, {
      n: '三角座星系 M33', en: 'Triangulum Galaxy · M33', icon: '✨',
      t: '本星系群第三大星系，约 300 万光年外——可能是仙女座的卫星星系。'
    });
    // 麦哲伦云
    const lmc = irregularGalaxy(34, 900, 0xe8e8ff);
    lmc.position.set(-40, -40, 210); g.add(lmc);
    addMarker(g, markerSets, 2, new THREE.Vector3(-40, -40, 210), 0xe8e8ff, 5, {
      n: '大麦哲伦云', en: 'Large Magellanic Cloud', icon: '☁️',
      t: '银河系最大的卫星星系，16 万光年外——1987A 超新星就爆发在这里。'
    });
    const smc = irregularGalaxy(22, 550, 0xd8e0f0);
    smc.position.set(-10, -70, 250); g.add(smc);
    addMarker(g, markerSets, 2, new THREE.Vector3(-10, -70, 250), 0xd8e0f0, 4, {
      n: '小麦哲伦云', en: 'Small Magellanic Cloud', icon: '☁️',
      t: '20 万光年外的矮星系，与大理哲伦云由星系桥相连，都在缓缓坠向银河系。'
    });
    scene.add(g); return g;
  }
  function buildL3() {
    const g = new THREE.Group(); g.position.set(0, Y3, 0); g.visible = false;
    g.add(starShell(3600, 3000));
    g.add(cosmicWeb(820));
    addMarker(g, markerSets, 3, new THREE.Vector3(0, 0, 0), 0xffc8a0, 13, {
      n: '拉尼亚凯亚超星系团', en: 'Laniakea Supercluster', icon: '🕸',
      t: '我们的家园超星系团：10 万个星系跨 5 亿光年，全都流向"巨引源"。银河系只是边缘一粒微尘。'
    });
    addMarker(g, markerSets, 3, new THREE.Vector3(300, 60, -240), 0xa8e0ff, 10, {
      n: '类星体 · 宇宙灯塔', en: 'Quasar · Cosmic Lighthouse', icon: '💡',
      t: '星系核心的超级黑洞疯狂吞食物质时发出的光，比整个星系亮千倍——最远的类星体来自宇宙大爆炸后 7 亿年。'
    });
    addMarker(g, markerSets, 3, new THREE.Vector3(-320, -40, 200), 0xff9fa8, 9, {
      n: '暗物质纤维', en: 'Dark Matter Filament', icon: '🧵',
      t: '星系并非均匀分布，而是挂在看不见的暗物质"蛛网"上——纤维交汇处才点亮星系团。'
    });
    scene.add(g); return g;
  }

  function build() {
    if (built) return;
    groups = [buildL1(), buildL2(), buildL3()];
    built = true;
  }

  /* ---------- 科普卡 ---------- */
  function showCard(info) {
    if (!cardBox) return;
    cardBox.innerHTML = '<button class="cc-close">✕</button>' +
      '<h3>' + (info.icon || '') + ' ' + (EN() && info.en ? info.en : info.n) + '</h3>' +
      '<p>' + (EN() ? (info.tEn || info.t) : info.t) + '</p>';
    cardBox.classList.remove('hidden');
    cardBox.querySelector('.cc-close').addEventListener('click', function () { cardBox.classList.add('hidden'); });
  }

  /* v24.0 清场：切换级别/回太阳系时隐藏全部标记标签与科普卡（修残留） */
  function hideAllLabels() {
    markerSets.forEach(function (set) {
      set.forEach(function (sp) { if (sp.userData.el) sp.userData.el.style.display = 'none'; });
    });
    if (cardBox) cardBox.classList.add('hidden');
  }

  /* ---------- 级别切换 ---------- */
  function anchorFor(n) {
    if (n === 1) return { tgt: [0, Y1, 0], pos: [0, Y1 + 150, 430] };
    if (n === 2) return { tgt: [0, Y2, 0], pos: [0, Y2 + 280, 800] };
    if (n === 3) return { tgt: [0, Y3, 0], pos: [0, Y3 + 320, 940] };
    return { tgt: [0, 0, 0], pos: [0, 150, 280] };
  }
  function goLevel(n) {
    if (busy || n === level || n < 0 || n > 3) return;
    ensureUI(); build();
    hideAllLabels();
    busy = true;
    fadeBox.style.display = '';
    void fadeBox.offsetWidth; // 强制 reflow 保证过渡生效
    fadeBox.classList.add('on');
    if (window.Sfx) { try { window.Sfx.launch(); } catch (e) { } }
    setTimeout(function () {
      if (level === 0 && n > 0) { // 离家存档
        savedCam = camera.position.clone(); savedTgt = controls.target.clone();
      }
      groups.forEach(function (g, i) { g.visible = (i === n - 1); });
      level = n;
      if (n === 0) {
        camera.position.copy(savedCam || new THREE.Vector3(0, 150, 280));
        controls.target.copy(savedTgt || new THREE.Vector3(0, 0, 0));
      } else {
        const a = anchorFor(n);
        controls.target.set(a.tgt[0], a.tgt[1], a.tgt[2]);
        camera.position.set(a.pos[0], a.pos[1], a.pos[2]);
      }
      controls.update();
      updateChrome();
      fadeBox.classList.remove('on');
      setTimeout(function () { if (!busy) fadeBox.style.display = 'none'; }, 240);
      busy = false;
      if (n > 0) toast(TITLES[n][0]);
    }, 170);
  }
  function enter() {
    if (state.sys !== 'solar') { toast(t8('cosmos.noExo', '请先切回太阳系再开启宇宙之旅')); return; }
    goLevel(1);
  }
  function exit() { goLevel(0); }

  /* ---------- 交互：滚轮升降级 + 点击标记 ---------- */
  function bindInput() {
    const dom = renderer.domElement;
    dom.addEventListener('wheel', function (e) {
      if (busy || state.sys !== 'solar') return;
      camera.getWorldPosition(camTmp);
      const dist = camTmp.distanceTo(controls.target);
      if (level === 0) {
        if (e.deltaY > 0 && dist > controls.maxDistance - 90) { e.preventDefault(); enter(); }
      } else {
        if (e.deltaY > 0 && dist > controls.maxDistance - 90 && level < 3) { e.preventDefault(); goLevel(level + 1); }
        else if (e.deltaY < 0 && dist < 110) { e.preventDefault(); goLevel(level - 1); }
      }
    }, { passive: false });
    // 点击标记（短按判定与主拾取一致）
    let dx = 0, dy = 0, dt = 0;
    dom.addEventListener('pointerdown', function (e) { dx = e.clientX; dy = e.clientY; dt = Date.now(); });
    dom.addEventListener('pointerup', function (e) {
      if (level === 0 || busy) return;
      if (Math.hypot(e.clientX - dx, e.clientY - dy) > 6 || Date.now() - dt > 600) return;
      const ray = new THREE.Raycaster();
      const nd = new THREE.Vector2(
        (e.clientX / window.innerWidth) * 2 - 1,
        -(e.clientY / window.innerHeight) * 2 + 1);
      ray.setFromCamera(nd, camera);
      const hits = ray.intersectObjects(markerSets[level - 1], false);
      if (hits.length) showCard(hits[0].object.userData.info);
      else if (cardBox) cardBox.classList.add('hidden');
    });
  }

  /* ---------- 每帧：标签投影 + 脉冲环 ---------- */
  let labelTick = 0;
  function onTick(dt) {
    if (level === 0 || !built || busy) return;
    pulseT += dt || 0.016;
    const g = groups[level - 1];
    if (g && g.userData.ring) {
      const s = 1 + 0.25 * Math.sin(pulseT * 2.2);
      g.userData.ring.scale.set(s, s, 1);
      g.userData.ring.material.opacity = 0.45 + 0.25 * Math.sin(pulseT * 2.2);
    }
    labelTick = (labelTick + 1) % 2; // 隔帧投影，够流畅
    if (labelTick) return;
    markerSets[level - 1].forEach(function (sp) {
      const el = sp.userData.el;
      if (!el) return;
      const v = sp.position.clone();
      g.localToWorld(v);
      v.project(camera);
      if (v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1) { el.style.display = 'none'; return; }
      el.style.display = '';
      el.style.left = ((v.x * 0.5 + 0.5) * window.innerWidth) + 'px';
      el.style.top = ((-v.y * 0.5 + 0.5) * window.innerHeight) + 'px';
    });
  }

  function init() {
    if (window.__cosmosReady) return;
    window.__cosmosReady = true;
    bindInput();
    SolarApp.onTick(onTick);
  }
  // 延迟自举（SolarApp 在 solar-main 才定义）
  setTimeout(function () { if (window.SolarApp) init(); }, 1200);

  return { enter: enter, exit: exit, goLevel: goLevel, isCosmic: function () { return level > 0; }, level: function () { return level; } };
})();
