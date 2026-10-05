/* ============================================================
 * moon3d.js —— v20.0 真 3D 月相剧场
 * 独立小型 WebGL 场景叠加在月相望远镜左窗：
 *   · 程序化月面贴图（TEX.moon 基底 + 月海/第谷射纹，与 2D 地名同坐标系）
 *   · 太阳方向光由日月黄经差实时驱动（相机系推导：s = (sin e, 0, -cos e)）
 *   · 地照（地球反照的微蓝补光，暗面新月前后可见）
 *   · 光学天平动（经度 ±7.9° / 纬度 ±5.1°，Meeus 近似）
 *   · 缓慢相机漂移，让球体有立体视差
 * WebGL 不可用时 moonphase.js 自动回退 2D 绘制。
 * ============================================================ */
'use strict';

window.Moon3D = (function () {
  const $ = function (id) { return document.getElementById(id); };
  let ok = false, renderer = null, scene = null, camera = null;
  let mesh = null, sunLight = null, tAcc = 0, timer = null;
  let yawOff = 0, pitchOff = 0; // 拖拽偏移（弧度）
  let dragging = false, lastX = 0, lastY = 0;

  const D2R = Math.PI / 180;

  /* ---------- v21.0 拖拽：在 2D 画布窗内按住拖动即可旋转月球，双击复位 ---------- */
  function bindDrag(canvas2d) {
    if (canvas2d.__moon3dDrag) return;
    canvas2d.__moon3dDrag = true;
    canvas2d.style.cursor = 'grab';
    canvas2d.addEventListener('pointerdown', function (e) {
      const rc = canvas2d.getBoundingClientRect();
      const sc = canvas2d.width / rc.width;
      const mx = (e.clientX - rc.left) * sc, my = (e.clientY - rc.top) * sc;
      const w = window.MoonLab && MoonLab.MOON_WINDOW;
      if (!w) return;
      const dx = mx - w.x, dy = my - w.y;
      if (dx * dx + dy * dy > w.r * w.r) return; // 只在月球窗内生效
      dragging = true; lastX = e.clientX; lastY = e.clientY;
      canvas2d.style.cursor = 'grabbing';
      try { canvas2d.setPointerCapture(e.pointerId); } catch (err) { }
    });
    canvas2d.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      yawOff += (e.clientX - lastX) * 0.008;
      pitchOff += (e.clientY - lastY) * 0.008;
      pitchOff = Math.max(-1.2, Math.min(1.2, pitchOff));
      lastX = e.clientX; lastY = e.clientY;
    });
    const end = function () { dragging = false; canvas2d.style.cursor = 'grab'; };
    canvas2d.addEventListener('pointerup', end);
    canvas2d.addEventListener('pointercancel', end);
    canvas2d.addEventListener('dblclick', function () { yawOff = 0; pitchOff = 0; });
  }

  /* ---------- 程序化月面贴图：TEX.moon 陨石坑基底 + 真实位置月海 ---------- */
  function buildMoonTexture() {
    const src = TEX.moon; // solar-core 已构建的坑洞底图（canvas）
    const W = 1024, H = 512;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    g.drawImage(src, 0, 0, W, H);
    // 近侧中央经线在 u=0.25（three 球体 u=0.25 → +Z 朝相机）
    // 月面经纬 → 图像坐标（东经为正、北纬为正，与 MOON_FEATURES 地名同约定）
    const px = function (lon, lat) {
      return [(0.25 + lon / 360) * W, (0.5 - lat / 180) * H];
    };
    const blob = function (lon, lat, rDeg, alpha) {
      const p = px(lon, lat), r = rDeg / 360 * W;
      const gd = g.createRadialGradient(p[0], p[1], r * 0.1, p[0], p[1], r);
      gd.addColorStop(0, 'rgba(84,88,102,' + alpha + ')');
      gd.addColorStop(0.75, 'rgba(90,95,110,' + alpha * 0.8 + ')');
      gd.addColorStop(1, 'rgba(90,95,110,0)');
      g.fillStyle = gd;
      g.beginPath(); g.arc(p[0], p[1], r, 0, 6.283); g.fill();
    };
    // 月海（真实月面坐标，东经正）
    blob(-16, 33, 21, 0.60);   // 雨海
    blob(-57, 20, 28, 0.52);   // 风暴洋
    blob(31, 8, 16, 0.55);     // 静海
    blob(59, 17, 8, 0.62);     // 危海
    blob(51, -8, 12, 0.50);    // 丰富海
    blob(34, -15, 10, 0.50);   // 酒海
    blob(-39, -24, 9, 0.48);   // 湿海
    blob(-17, 46, 9, 0.45);    // 冷海
    // 第谷射纹（亮色细线自第谷环形山放射）
    const ty = px(-11, -43);
    g.strokeStyle = 'rgba(235,232,224,0.20)';
    g.lineWidth = 2.2;
    for (let i = 0; i < 14; i++) {
      const a = i / 14 * 6.283 + 0.31;
      g.beginPath();
      g.moveTo(ty[0], ty[1]);
      g.lineTo(ty[0] + Math.cos(a) * 66, ty[1] + Math.sin(a) * 60);
      g.stroke();
    }
    g.lineWidth = 1;
    const tex = new THREE.CanvasTexture(cv);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  function init(canvas) {
    if (ok) return true;
    if (typeof THREE === 'undefined' || typeof TEX === 'undefined') return false;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    } catch (e) { return false; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputEncoding = THREE.sRGBEncoding;

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 0, 3.3);
    camera.lookAt(0, 0, 0);

    mesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, 64, 48),
      new THREE.MeshStandardMaterial({ map: buildMoonTexture(), roughness: 1, metalness: 0 })
    );
    scene.add(mesh);

    // 太阳方向光（每帧按日月距角更新方向）
    sunLight = new THREE.DirectionalLight(0xfff3de, 3.6);
    scene.add(sunLight);
    // 地照：地球反照的微蓝补光（自相机方向照亮月暗面）
    const earthShine = new THREE.DirectionalLight(0x5a78c8, 0.13);
    earthShine.position.set(0, 0, 10);
    scene.add(earthShine);
    // 极弱环境光，避免暗面纯黑
    scene.add(new THREE.AmbientLight(0x2a3352, 0.14));
    ok = true;
    return true;
  }

  /* 光学天平动（近似）：经度 ±7.9° 周期近点月，纬度 ±5.1° 周期交点月 */
  function libration(days) {
    const Mm = (134.963 + 13.064993 * days) * D2R;
    const F = (93.272 + 13.229350 * days) * D2R;
    return { lon: 7.9 * Math.sin(Mm) * D2R, lat: 5.1 * Math.sin(F) * D2R };
  }

  function render(days) {
    if (!ok) return;
    let e = 0;
    if (window.MoonLab) {
      e = MoonLab.phaseInfo().elong; // 有符号距角（新月 0 → 满月 ±π）
    }
    // 相机系太阳方向 s = (sin e, 0, -cos e)，再加 ~17° 倾角呈现经典斜终止线
    const sx = Math.sin(e), sz = -Math.cos(e), tilt = -0.30;
    sunLight.position.set(sx * Math.cos(tilt) * 10, sx * Math.sin(tilt) * 10, sz * 10);
    // 天平动 + 固定轴倾（视觉立体感）+ 拖拽偏移
    const lib = libration(days);
    mesh.rotation.set(lib.lat + pitchOff, -lib.lon + yawOff, -0.06);
    // 缓慢相机漂移（半径 0.05 → 屏幕上约 ±6px 视差）
    tAcc += 0.05;
    camera.position.set(0.05 * Math.sin(tAcc * 0.13), 0.04 * Math.cos(tAcc * 0.10), 3.3);
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
  }

  function start(canvas, getDays) {
    if (!ok && !init(canvas)) { window.__moon3dOk = false; return; }
    window.__moon3dOk = true;
    const c2d = $('moon-canvas');
    if (c2d) bindDrag(c2d); // v21.0 拖拽事件绑在 2D 上层画布（接收指针的层）
    if (!timer) timer = setInterval(function () { render(getDays()); }, 50);
    render(getDays());
  }
  function stop() { if (timer) { clearInterval(timer); timer = null; } }

  /* 模态框开关轮询（与 MoonLab 同款模式：后台标签 rAF 不触发，须用 setInterval） */
  setInterval(function () {
    const m = $('modal-moon');
    if (!m) return;
    const cv = $('moon3d-canvas');
    if (m.classList.contains('hidden')) { stop(); }
    else if (cv && !timer) {
      start(cv, function () { return window.SolarApp ? SolarApp.days() : 0; });
    }
  }, 500);

  return { start: start, stop: stop, isActive: function () { return ok; }, libration: libration };
})();
