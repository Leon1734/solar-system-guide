/* ============================================================
 * tools.js —— v2.0 工具集
 *  1. 行星对比（双选条形图）
 *  2. 日食月食沙盘（可拖拽互动）
 *  3. 相位观察窗（从地球视角的画中画渲染）
 * 依赖：data.js / main.js(SolarApp)
 * ============================================================ */
'use strict';

(function () {
  const A = () => window.SolarApp;
  const $ = function (id) { return document.getElementById(id); };
  const tt = function (path, fb) { return (window.I18N && I18N.t(path)) || fb; };
  const EN = function () { return window.I18N && I18N.lang === 'en'; };

  /* ================== 1. 行星对比 ================== */
  function compareEntries() {
    const list = [{ key: 'sun', name: '太阳', data: SUN_DATA, isSun: true }]
      .concat(PLANETS.map(function (p) { return { key: p.key, name: p.name, data: p, isSun: false }; }))
      .concat(DWARFS.map(function (p) { return { key: p.key, name: p.name, data: p, isSun: false }; }))
      .concat([{ key: 'moon', name: '月球', data: MOON_DATA, isMoon: true }]);
    return list;
  }

  function fillSelect(sel, def) {
    compareEntries().forEach(function (e) {
      const o = document.createElement('option');
      o.value = e.key; o.textContent = e.name;
      sel.appendChild(o);
    });
    sel.value = def;
  }

  function drawCompare() {
    const a = compareEntries().find(function (e) { return e.key === $('cmp-a').value; });
    const b = compareEntries().find(function (e) { return e.key === $('cmp-b').value; });
    if (!a || !b) return;
    const cv = $('compare-canvas');
    const ctx = cv.getContext('2d');
    const W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#dfe6f2'; ctx.font = 'bold 16px sans-serif';
    ctx.fillText('⚖️ ' + a.name + '  vs  ' + b.name, 20, 30);

    // 指标行：[名称, 值a, 值b, 格式, 是否对数]
    const rows = [
      [tt('tools.cmpDia', '直径 (km)'), a.data.radiusKm, b.data.radiusKm, function (v) { return Math.round(v).toLocaleString('zh-CN') + ' km'; }, true],
      [tt('tools.cmpMass', '质量 (地球=1)'), massOf(a.data), massOf(b.data), function (v) { return fmtExp(v); }, true],
      [tt('tools.cmpDist', '平均日距 (AU)'), a.isSun || a.isMoon ? 0 : a.data.distanceAU, b.isSun || b.isMoon ? 0 : b.data.distanceAU, function (v) { return v ? v.toFixed(2) + ' AU' : '—'; }, true],
      [tt('tools.cmpPeriod', '公转周期'), periodOf(a), periodOf(b), function (v) { return v ? (v < 700 ? v.toFixed(1) + (EN() ? ' d' : ' 天') : (v / 365.25).toFixed(1) + (EN() ? ' yr' : ' 年')) : '—'; }, true],
      [tt('tools.cmpSpin', '自转周期 (小时)'), Math.abs(a.data.rotationHours), Math.abs(b.data.rotationHours), function (v) { return v < 48 ? v.toFixed(1) + (EN() ? ' h' : ' 小时') : (v / 24).toFixed(1) + (EN() ? ' d' : ' 天'); }, true]
    ];

    const x0 = 170, barW = W - x0 - 30;
    const colA = '#6fc3ff', colB = '#ffc85e';
    rows.forEach(function (r, ri) {
      const y = 70 + ri * 62;
      ctx.fillStyle = '#93a4c3'; ctx.font = '13px sans-serif';
      ctx.fillText(r[0], 20, y + 4);
      const va = r[1], vb = r[2];
      if (!va && !vb) {
        ctx.fillStyle = '#5a6a88'; ctx.fillText(tt('tools.cmpNA', '不适用'), x0, y + 4);
        return;
      }
      const la = va > 0 ? (r[4] ? Math.log10(va) : va) : 0;
      const lb = vb > 0 ? (r[4] ? Math.log10(vb) : vb) : 0;
      const maxL = Math.max(la, lb, 1e-9);
      // 条 A
      drawBar(ctx, x0, y - 12, barW * (la / maxL), 16, colA, r[3](va || 0), '#0a1224');
      drawBar(ctx, x0, y + 10, barW * (lb / maxL), 16, colB, r[3](vb || 0), '#0a1224');
    });
    // 图例
    ctx.fillStyle = colA; ctx.fillRect(20, H - 26, 14, 10);
    ctx.fillStyle = '#c4d2ea'; ctx.font = '12px sans-serif'; ctx.fillText(a.name, 40, H - 17);
    ctx.fillStyle = colB; ctx.fillRect(120, H - 26, 14, 10);
    ctx.fillStyle = '#c4d2ea'; ctx.fillText(b.name, 140, H - 17);
    ctx.fillStyle = '#5a6a88';
    ctx.fillText(tt('tools.cmpLog', '（长度为对数比例：每格 10 倍，仅作数量级对比）'), 220, H - 17);
  }
  function drawBar(ctx, x, y, w, h, color, label, bg) {
    ctx.fillStyle = bg || 'rgba(255,255,255,0.06)';
    ctx.fillRect(x, y, Math.max(w, 2), h);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, Math.max(w, 2), h);
    ctx.fillStyle = '#e8eefb'; ctx.font = '11.5px sans-serif';
    if (w > 90) ctx.fillText(label, x + 8, y + h - 4);
    else ctx.fillText(label, x + Math.max(w, 2) + 8, y + h - 4);
  }
  function massOf(d) {
    const m = {
      sun: 333000, mercury: 0.055, venus: 0.815, earth: 1, mars: 0.107,
      jupiter: 317.8, saturn: 95.2, uranus: 14.5, neptune: 17.1,
      pluto: 0.0022, ceres: 0.00016, eris: 0.0028, moon: 0.0123, halley: 3.7e-11
    };
    return m[d.key] || 0;
  }
  function periodOf(e) {
    if (e.isSun) return 0;
    if (e.isMoon) return 27.32;
    return e.data.periodDays;
  }
  function fmtExp(v) {
    if (v === 0) return '—';
    if (v >= 0.001 && v < 10000) return v.toPrecision(3);
    const e = Math.floor(Math.log10(v));
    return (v / Math.pow(10, e)).toFixed(2) + '×10^' + e;
  }

  /* ================== 2. 日食沙盘 ================== */
  const eclipse = { angle: 2.4, dragging: false, playing: false, days: 0 };

  function drawEclipse() {
    const cv = $('eclipse-canvas');
    const ctx = cv.getContext('2d');
    const W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);

    const sunX = 110, sunY = H / 2, sunR = 46;
    const earthX = W - 150, earthY = H / 2, earthR = 15;
    const moonR = 6.5;
    const orbitR = 120;

    // 太阳
    const g = ctx.createRadialGradient(sunX, sunY, 5, sunX, sunY, sunR * 1.6);
    g.addColorStop(0, '#fff7d6'); g.addColorStop(0.6, '#ffc23e'); g.addColorStop(1, 'rgba(255,150,40,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(sunX, sunY, sunR * 1.6, 0, Math.PI * 2); ctx.fill();

    // 地球轨道示意线（太阳->地球连线）
    ctx.strokeStyle = 'rgba(120,150,210,0.25)'; ctx.setLineDash([4, 6]);
    ctx.beginPath(); ctx.moveTo(sunX + sunR, sunY); ctx.lineTo(earthX - earthR - orbitR - 14, earthY); ctx.stroke();
    ctx.setLineDash([]);

    // 地球
    const ge = ctx.createRadialGradient(earthX - 5, earthY - 5, 2, earthX, earthY, earthR);
    ge.addColorStop(0, '#8fc3ff'); ge.addColorStop(1, '#1d4f8a');
    ctx.fillStyle = ge;
    ctx.beginPath(); ctx.arc(earthX, earthY, earthR, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#93a4c3'; ctx.font = '12px sans-serif';
    ctx.fillText('地球', earthX - 12, earthY + earthR + 16);

    // 月球轨道（圆）
    ctx.strokeStyle = 'rgba(140,170,220,0.3)';
    ctx.beginPath(); ctx.arc(earthX, earthY, orbitR, 0, Math.PI * 2); ctx.stroke();

    // 月球位置（angle=0 指向太阳）
    const mx = earthX - Math.cos(eclipse.angle) * orbitR;
    const my = earthY - Math.sin(eclipse.angle) * orbitR * 0.4; // 压扁呈现倾角感
    // 本影锥（当月球在日地之间）
    const alignDeg = Math.abs(((eclipse.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2));
    const nearNew = Math.min(alignDeg, Math.PI * 2 - alignDeg) < 0.12;
    if (nearNew) {
      const ux0 = mx, uy0 = my;
      const dx = earthX - mx, dy = earthY - my;
      const L = Math.hypot(dx, dy);
      ctx.fillStyle = 'rgba(10,15,30,0.85)';
      ctx.beginPath();
      ctx.moveTo(ux0 - moonR, uy0 - moonR * 0.2);
      ctx.lineTo(ux0 + moonR, uy0 - moonR * 0.2);
      ctx.lineTo(ux0 + dx * 0.92 + 1.5, uy0 + dy * 0.92);
      ctx.lineTo(ux0 + dx * 0.92 - 1.5, uy0 + dy * 0.92);
      ctx.closePath(); ctx.fill();
      // 地球上的影子斑点
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.beginPath(); ctx.arc(earthX - 3, earthY - 2, 4, 0, Math.PI * 2); ctx.fill();
    }
    // 月球
    const nearFull = Math.abs(alignDeg - Math.PI) < 0.12;
    ctx.fillStyle = nearNew ? '#111' : '#cfcfcf';
    ctx.beginPath(); ctx.arc(mx, my, moonR, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#e8eefb'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(mx, my, moonR + 4, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 1;

    // 状态文字
    let status, color;
    if (nearNew) { status = tt('tools.eclNew', '🌑 新月 · 与日地连线重合 —— 日食！（月球影子落在地球上）'); color = '#ff9d5c'; }
    else if (nearFull) { status = tt('tools.eclFull', '🌕 满月 · 地球位于日月之间 —— 可能发生月食'); color = '#9db8ff'; }
    else if (alignDeg < Math.PI / 2) { status = tt('tools.eclWax', '🌒 峨眉月 —— 月球接近太阳一侧，影子朝向地球方向'); color = '#c4d2ea'; }
    else { status = tt('tools.eclGib', '🌗 凸月 —— 月球远离太阳一侧'); color = '#c4d2ea'; }
    ctx.fillStyle = color; ctx.font = 'bold 14px sans-serif';
    ctx.fillText(status, 150, 32);

    ctx.fillStyle = '#5a6a88'; ctx.font = '12px sans-serif';
    ctx.fillText(tt('tools.eclHint', '👆 拖动月球改变相位 · 或按 ▶ 自动运行（一个朔望月 29.53 天）'), 150, 54);
    ctx.fillText(tt('tools.eclSimp', '简化模型：真实日食还要求月球位于白道与黄道的交点附近'), 150, H - 42);

    // 未来日食表
    ctx.fillStyle = '#93a4c3'; ctx.font = 'bold 13px sans-serif';
    ctx.fillText(tt('tools.eclUpcoming', '📅 未来几年的日食'), 150, H - 22);
    ctx.font = '11.5px sans-serif'; ctx.fillStyle = '#8fa0b8';
    let ex = 150;
    UPCOMING_ECLIPSES.forEach(function (e) {
      const s = e[0] + ' ' + e[1];
      ctx.fillStyle = e[1] === '日全食' ? '#ffd97a' : '#9db8ff';
      ctx.fillText(s, ex, H - 6);
      ex += ctx.measureText(s).width + 22;
    });
  }

  function initEclipse() {
    const cv = $('eclipse-canvas');
    const rectOf = () => cv.getBoundingClientRect();
    const toLocal = function (e) {
      const r = rectOf();
      const scale = cv.width / r.width;
      return { x: (e.clientX - r.left) * scale, y: (e.clientY - r.top) * scale };
    };
    const moonPos = function () {
      return {
        x: cv.width - 150 - Math.cos(eclipse.angle) * 120,
        y: cv.height / 2 - Math.sin(eclipse.angle) * 48
      };
    };
    let hook = null;
    cv.addEventListener('pointerdown', function (e) {
      const p = toLocal(e), m = moonPos();
      if (Math.hypot(p.x - m.x, p.y - m.y) < 28) {
        eclipse.dragging = true; eclipse.playing = false;
        cv.setPointerCapture(e.pointerId);
      }
    });
    cv.addEventListener('pointermove', function (e) {
      const p = toLocal(e);
      if (eclipse.dragging) {
        const ex = cv.width - 150, ey = cv.height / 2;
        eclipse.angle = Math.atan2(-(p.y - ey) / 0.4, -(p.x - ex));
        drawEclipse();
      } else {
        const m = moonPos();
        cv.style.cursor = Math.hypot(p.x - m.x, p.y - m.y) < 28 ? 'grab' : 'default';
      }
    });
    cv.addEventListener('pointerup', function () { eclipse.dragging = false; });
    $('btn-eclipse-play').addEventListener('click', function () {
      eclipse.playing = !eclipse.playing;
      this.textContent = eclipse.playing ? '⏸ 暂停' : '▶ 自动运行';
    });
    // 打开面板时启动帧循环（每次重绘按需）
    hook = function () {
      if ($('modal-eclipse').classList.contains('hidden')) return;
      if (eclipse.playing && !eclipse.dragging) {
        eclipse.days += 0.35;
        eclipse.angle = eclipse.days * Math.PI * 2 / 29.53 + 2.4;
        drawEclipse();
      }
    };
    // SolarApp 由 main.js 延迟初始化，轮询等待就绪后注册每帧钩子
    (function waitApp() {
      if (window.SolarApp) SolarApp.onTick(hook);
      else setTimeout(waitApp, 120);
    })();
    drawEclipse();
  }

  /* ================== 3. 相位观察窗 ================== */
  const Phase = { active: false, cam: null, size: { w: 300, h: 220 } };

  function initPhase() {
    Phase.cam = new THREE.PerspectiveCamera(40, Phase.size.w / Phase.size.h, 0.05, 200000);
    $('btn-phase').addEventListener('click', function () {
      Phase.active = !Phase.active;
      this.classList.toggle('active', Phase.active);
      $('phase-caption').classList.toggle('hidden', !Phase.active);
      if (Phase.active && !window.SolarApp.selected()) {
        SolarApp.toast('先选中一个天体（如金星），再看这里的地球视角');
      }
    });
    // SolarApp 由 main.js 延迟初始化，轮询等待就绪后注册渲染后钩子
    (function waitApp() {
      if (window.SolarApp) SolarApp.onAfterRender(renderPhase);
      else setTimeout(waitApp, 120);
    })();
  }

  function renderPhase() {
    const A2 = window.SolarApp;
    if (!Phase.active) return;
    const sel = A2.selected();
    const earth = A2.byKey('earth'), sun = A2.byKey('sun');
    if (!sel || sel === earth || !earth || !sun) {
      $('phase-caption').textContent = tt('tools.phasePick', '相位观察 · 请点选一个天体（地球以外）');
      return;
    }
    const app = A2.renderer;
    const sp = new THREE.Vector3(), ep = new THREE.Vector3(), tp = new THREE.Vector3();
    sun.group.getWorldPosition(sp);
    earth.group.getWorldPosition(ep);
    sel.group.getWorldPosition(tp);
    // 相位角（太阳-目标-地球）
    const vTS = sp.clone().sub(tp), vTE = ep.clone().sub(tp);
    const cosA = vTS.dot(vTE) / (vTS.length() * vTE.length() || 1e-9);
    const illum = (1 + cosA) / 2 * 100;
    // 视角相机：从地球稍向目标偏移处看
    const dir = tp.clone().sub(ep).normalize();
    Phase.cam.position.copy(ep).addScaledVector(dir, 3.2);
    Phase.cam.up.set(0, 1, 0);
    Phase.cam.lookAt(tp);
    // 视场角随视大小调整
    const dist = tp.distanceTo(ep);
    const r = (sel.visualR || 1.5);
    const ang = 2 * Math.atan(r / Math.max(dist, 1e-6));
    Phase.cam.fov = Math.max(0.6, Math.min(50, ang * 180 / Math.PI * 4));
    Phase.cam.updateProjectionMatrix();

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const x = 12, y = 170;
    const prevViewport = app.getSize(new THREE.Vector2());
    app.autoClear = false;
    app.setScissorTest(true);
    app.setViewport(x, y, Phase.size.w, Phase.size.h);
    app.setScissor(x, y, Phase.size.w, Phase.size.h);
    app.render(A2.scene, Phase.cam);
    app.setScissorTest(false);
    app.setViewport(0, 0, prevViewport.x, prevViewport.y);
    app.autoClear = true;

    const name = sel.data.name;
    const capT = tt('tools.phaseCaption', '🌓 从地球看 {name} · 被照亮 {pct}%')
      .replace('{name}', name).replace('{pct}', illum.toFixed(0));
    $('phase-caption').innerHTML = capT +
      (sel.data.key === 'venus' ? tt('tools.phaseGalileo', ' · 伽利略正是靠金星的圆缺证明了它绕太阳转！') : '');
  }

  /* ================== 绑定 ================== */
  function bindAll() {
    fillSelect($('cmp-a'), 'earth');
    fillSelect($('cmp-b'), 'mars');
    $('cmp-a').addEventListener('change', drawCompare);
    $('cmp-b').addEventListener('change', drawCompare);
    $('btn-compare').addEventListener('click', function () {
      setTimeout(drawCompare, 30);
    });
    initEclipse();
    initPhase();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindAll);
  } else {
    bindAll();
  }
})();
