/* ============================================================
 * meteors.js —— v4.0 流星雨沙盘
 * 俯视图：地球绕日公转，穿过彗星遗留的尘埃带时流星爆发；
 * 右侧"夜空"视图演示辐射点与 ZHR
 * ============================================================ */
'use strict';

window.MeteorLab = (function () {
  const $ = function (id) { return document.getElementById(id); };
  let ctx = null, W = 860, H = 380, timer = null, last = 0;
  let playing = true, dayOfYear = 224; // 1 月 1 日为 0
  let showerKey = 'perseids';
  let streaks = [];

  const SHOWERS = METEOR_SHOWERS; // v7.0 数据提升至 data.js（含辐射点星座联动字段）

  function t8(path, fb) { return (window.I18N && I18N.t(path)) || fb; }
  function shower() { return SHOWERS.find(function (s) { return s.key === showerKey; }); }
  function fmtDate(d) {
    const months = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let m = 0, dd = Math.floor(d);
    while (dd >= months[m]) { dd -= months[m]; m++; }
    return (m + 1) + ' 月 ' + (dd + 1) + ' 日';
  }

  /* 当前活跃度 0..1（按距峰值天数的高斯衰减） */
  function activity() {
    const s = shower();
    let dd = Math.abs(dayOfYear - s.peak);
    dd = Math.min(dd, 365 - dd);
    if (dd > s.window) return 0;
    return Math.exp(-(dd * dd) / (s.window * 0.35 * s.window * 0.35));
  }

  function draw() {
    if (!ctx) return;
    const s = shower();
    const act = activity();
    ctx.fillStyle = '#02030a';
    ctx.fillRect(0, 0, W, H);

    /* ---- 左：俯视太阳系 ---- */
    const cx = 195, cy = H / 2, R = 118;
    // 太阳
    const gs = ctx.createRadialGradient(cx, cy, 2, cx, cy, 26);
    gs.addColorStop(0, '#fff4c2'); gs.addColorStop(1, 'rgba(255,160,40,0)');
    ctx.fillStyle = gs;
    ctx.beginPath(); ctx.arc(cx, cy, 26, 0, 6.283); ctx.fill();
    // 地球轨道
    ctx.strokeStyle = 'rgba(111,195,255,0.4)';
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.283); ctx.stroke();
    // 彗星轨道（简化椭圆：在交点处穿过地球轨道，视觉倾角 orbitTilt 压扁）
    const nodeLon = s.peak / 365.25 * 6.283 - Math.PI / 2 + s.nodeDir;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(nodeLon);
    ctx.strokeStyle = 'rgba(255,180,120,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(R * 0.35, 0, R * 1.55, R * 1.55 * s.orbitTilt * 0.5, 0, 0, 6.283);
    ctx.stroke();
    ctx.lineWidth = 1;
    // 尘埃带（交点附近的加粗模糊段）
    ctx.strokeStyle = 'rgba(255,200,140,0.22)';
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.ellipse(R * 0.35, 0, R * 1.55, R * 1.55 * s.orbitTilt * 0.5, 0, -0.45, 0.45);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.restore();
    // 交点标记
    const nx = cx + Math.cos(nodeLon) * R, ny = cy + Math.sin(nodeLon) * R;
    ctx.strokeStyle = 'rgba(255,200,140,0.8)';
    ctx.beginPath(); ctx.arc(nx, ny, 6, 0, 6.283); ctx.stroke();
    // 地球
    const eLon = dayOfYear / 365.25 * 6.283 - Math.PI / 2;
    const ex = cx + Math.cos(eLon) * R, ey = cy + Math.sin(eLon) * R;
    ctx.fillStyle = '#5fa8f0';
    ctx.beginPath(); ctx.arc(ex, ey, 6.5, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#8fa0b8'; ctx.font = '11px sans-serif';
    ctx.fillText('🌍', ex - 6, ey - 12);
    ctx.fillStyle = '#93a4c3'; ctx.font = '12px sans-serif';
    ctx.fillText(t8('me.topview', '俯视：地球穿过彗星尘埃带'), 40, 26);
    ctx.fillStyle = act > 0.05 ? '#ffd97a' : '#5a6a88';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(fmtDate(dayOfYear), 40, 46);

    /* ---- 右：夜空 + 辐射点 ---- */
    const sx0 = 400, sy0 = 34, sw = W - sx0 - 24, sh = H - 100;
    ctx.fillStyle = 'rgba(10,16,36,0.8)';
    ctx.fillRect(sx0, sy0, sw, sh);
    // 星点
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (let i = 0; i < 60; i++) {
      ctx.fillRect(sx0 + (i * 137.5) % sw, sy0 + (i * 89.7) % sh, 1.4, 1.4);
    }
    // 辐射点
    const rx = sx0 + sw * 0.68, ry = sy0 + sh * 0.42;
    ctx.strokeStyle = 'rgba(255,217,122,0.9)';
    ctx.beginPath(); ctx.arc(rx, ry, 13, 0, 6.283); ctx.stroke();
    ctx.fillStyle = '#ffd97a'; ctx.font = '11px sans-serif';
    ctx.fillText(t8('me.radiant', '辐射点 · ') + s.radiant, rx - 30, ry - 20);
    // 流星（活跃时从辐射点呈放射状）
    if (act > 0.04) {
      if (Math.random() < act * 0.55) {
        const a = Math.random() * 6.283, len = 26 + Math.random() * 55;
        streaks.push({ x: rx, y: ry, dx: Math.cos(a) * len, dy: Math.sin(a) * len, life: 1 });
      }
    }
    ctx.lineWidth = 1.6;
    streaks = streaks.filter(function (st) {
      st.life -= 0.028;
      if (st.life <= 0) return false;
      ctx.strokeStyle = 'rgba(190,230,255,' + (st.life * 0.9).toFixed(2) + ')';
      ctx.beginPath();
      ctx.moveTo(st.x + st.dx * (1 - st.life), st.y + st.dy * (1 - st.life));
      ctx.lineTo(st.x + st.dx, st.y + st.dy);
      ctx.stroke();
      return true;
    });
    ctx.lineWidth = 1;

    // 状态行
    ctx.font = 'bold 14px sans-serif';
    if (act > 0.04) {
      ctx.fillStyle = '#9fe8a8';
      ctx.fillText('✨ ' + t8('me.active', '正在活跃！') + ' ZHR ≈ ' + Math.round(s.zhr * (0.5 + act * 0.5)), sx0, H - 44);
    } else {
      ctx.fillStyle = '#8fa0b8';
      ctx.fillText(t8('me.inactive', '尚未穿过尘埃带——拖动时间到峰值日'), sx0, H - 44);
    }
    ctx.fillStyle = '#c4d2ea'; ctx.font = '12px sans-serif';
    ctx.fillText(t8('me.parent', '母彗星：') + s.parent + ' · ' + t8('me.peak', '峰值 ') + fmtDate(s.peak) + ' · ZHR ' + s.zhr, sx0, H - 22);
    ctx.fillStyle = '#5a6a88';
    ctx.fillText(t8('me.grain', '流星体其实只有沙粒大小——发光是因为以 30~70 km/s 撞入大气'), 40, H - 22);
  }

  function bindControls() {
    document.querySelectorAll('.me-shower').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.me-shower').forEach(function (b2) { b2.classList.remove('active'); });
        this.classList.add('active');
        showerKey = this.dataset.shower;
      });
    });
    const slider = $('me-day');
    slider.addEventListener('input', function () {
      dayOfYear = +this.value;
      $('me-day-v').textContent = fmtDate(dayOfYear);
    });
    slider.value = dayOfYear;
    $('me-day-v').textContent = fmtDate(dayOfYear);
    $('me-play').addEventListener('click', function () {
      playing = !playing;
      this.textContent = playing ? t8('star.auto', '⏸ 暂停') : t8('star.autoOff', '▶ 播放');
    });
    $('me-peak').addEventListener('click', function () {
      dayOfYear = shower().peak;
      slider.value = dayOfYear;
      $('me-day-v').textContent = fmtDate(dayOfYear);
    });
  }

  function frame() {
    if (!timer) return;
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.06);
    last = now;
    if (playing) {
      dayOfYear = (dayOfYear + dt * 9) % 365; // ~40 秒一年
      $('me-day').value = dayOfYear;
      $('me-day-v').textContent = fmtDate(dayOfYear);
    }
    draw();
  }

  function start() {
    if (!ctx) {
      const cv = $('meteors-canvas');
      ctx = cv.getContext('2d');
      W = cv.width; H = cv.height;
      bindControls();
    }
    last = performance.now();
    if (!timer) {
      if (location.search.indexOf('novx') >= 0) { draw(); return; } // 无头截图：单帧
      timer = setInterval(frame, 33);
    }
  }
  function stop() { if (timer) { clearInterval(timer); timer = null; } }

  /* v7.0：外部联动选中某场流星雨（今晚天空面板跳转用） */
  function select(key) {
    showerKey = key;
    document.querySelectorAll('.me-shower').forEach(function (b2) {
      b2.classList.toggle('active', b2.dataset.shower === key);
    });
    draw();
  }

  setInterval(function () {
    const m = $('modal-meteors');
    if (!m) return;
    if (m.classList.contains('hidden')) { if (timer) stop(); }
    else if (!timer) start();
  }, 400);

  return { start: start, stop: stop, select: select };
})();
