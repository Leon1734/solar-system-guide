/* ============================================================
 * transit.js —— v4.0 凌星法实验室
 * 拖拽行星凌过恒星面，右侧实时绘制光变曲线；
 * 可调行星半径 / 周期 / 恒星类型 / 轨道倾角（撞击参数 b）
 * ============================================================ */
'use strict';

window.TransitLab = (function () {
  const $ = function (id) { return document.getElementById(id); };
  let ctx = null, W = 860, H = 380, timer = null, last = 0;
  let playing = true, phase = 0.25; // 0..1 一个周期内的相位（0.25=凌星中点附近）
  const STARS = {
    sun: { label: 'G 型（太阳）', rSun: 1.0, mSun: 1.0, color: '#ffd97a' },
    k: { label: 'K 型（0.7 R☉）', rSun: 0.7, mSun: 0.75, color: '#ffb066' },
    m: { label: 'M 型（0.12 R☉）', rSun: 0.12, mSun: 0.15, color: '#ff7a52' }
  };
  const P = { rp: 1.0, period: 365, star: 'sun', b: 0.0 }; // rp: 地球半径单位
  let dragging = false;

  function t8(path, fb) { return (window.I18N && I18N.t(path)) || fb; }

  /* 物理量计算（恒星设为太阳质量/半径的缩放） */
  function physics() {
    const st = STARS[P.star];
    const k = P.rp * 6371 / (st.rSun * 696340);          // Rp/R*
    const depth = k * k;                                  // 凌星深度
    const aAU = Math.cbrt(st.mSun) * Math.pow(P.period / 365.25, 2 / 3); // 开普勒三定律
    const aOverR = aAU * 149597870 / (st.rSun * 696340);
    const bEff = Math.min(P.b, 1 + k);
    const trig = Math.sqrt(Math.max(0, (1 + k) * (1 + k) - bEff * bEff));
    const durDays = (P.period / Math.PI) * Math.asin(Math.min(1, trig / aOverR)) * 2;
    const noTransit = P.b >= 1 + k;
    return { k: k, depth: depth, durH: durDays * 24, noTransit: noTransit, aAU: aAU };
  }

  function draw() {
    if (!ctx) return;
    const st = STARS[P.star];
    const RstarPx = Math.max(14, 95 * st.rSun);
    const cx = 205, cy = H / 2 + 6;
    const ph = physics();
    ctx.fillStyle = '#02030a';
    ctx.fillRect(0, 0, W, H);
    // 星空
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (let i = 0; i < 40; i++) {
      const sx = (i * 97.3) % 380, sy = (i * 61.7) % H;
      ctx.fillRect(sx, sy, 1, 1);
    }
    // 恒星（临边昏化）
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, RstarPx);
    g.addColorStop(0, '#fff8dc');
    g.addColorStop(0.72, st.color);
    g.addColorStop(1, 'rgba(255,140,40,0.35)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, RstarPx, 0, 6.283); ctx.fill();

    // 行星位置（凌星轨道：水平穿过，撞击参数 b 决定偏离中心的垂直距离）
    const rpPx = Math.max(1.6, P.rp * 6371 / 696340 * RstarPx);
    // 相位 0..1：以凌星中点为 0.5，行程与 a/R* 相关（这里取可视弧长）
    const span = Math.min(1.0, 2.6 / Math.sqrt(ph.aAU / 3) / Math.sqrt(st.mSun) + 0.12);
    const xOff = (phase - 0.5) * 2 * RstarPx * (1.35 + 0.9 * Math.min(2, ph.aAU / 60));
    const yOff = P.b * RstarPx;
    const px = cx + xOff, py = cy + yOff;
    // 轨道线
    ctx.strokeStyle = 'rgba(140,170,220,0.28)';
    ctx.setLineDash([3, 5]);
    ctx.beginPath(); ctx.moveTo(cx - 195, cy + yOff); ctx.lineTo(cx + 185, cy + yOff); ctx.stroke();
    ctx.setLineDash([]);
    // 行星（夜半球朝向恒星简化为暗面）
    ctx.fillStyle = '#3a4a63';
    ctx.beginPath(); ctx.arc(px, py, rpPx, 0, 6.283); ctx.fill();
    ctx.strokeStyle = 'rgba(200,220,255,0.8)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(px, py, rpPx, 0, 6.283); ctx.stroke();
    ctx.lineWidth = 1;

    // —— 右侧：光变曲线 ——
    const gx0 = 430, gx1 = W - 24, gy0 = 60, gy1 = H - 58;
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.fillRect(gx0, gy0, gx1 - gx0, gy1 - gy0);
    const shown = ph.noTransit ? 0 : ph.depth;
    const yF = function (f) { return gy1 - (f - 1 + shown * 1.35) / (shown * 1.35 + 0.0004) * (gy1 - gy0); };
    // 参考线 100%
    ctx.strokeStyle = 'rgba(120,150,210,0.25)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(gx0, yF(1)); ctx.lineTo(gx1, yF(1)); ctx.stroke();
    ctx.setLineDash([]);
    // 曲线：在 x∈[-3dur, +3dur] 内有凹陷
    ctx.strokeStyle = '#6fc3ff';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    const dtot = ph.noTransit ? 0.0001 : ph.durH / 24; // 天
    const window = dtot * 3.2 + P.period * 0.02;
    let first = true;
    for (let sx = gx0; sx <= gx1; sx += 1.5) {
      const tt = (sx - gx0) / (gx1 - gx0) - 0.5; // -0.5..0.5
      const tc = tt * window * 2;                 // 距中点 天
      let f = 1;
      if (!ph.noTransit && Math.abs(tc) < dtot * 1.5) {
        // 梯形近似：入/出凌各 8% 时长
        const edge = dtot * 0.08;
        const u = Math.abs(tc);
        f = 1 - (u < dtot / 2 - edge ? 1 : u > dtot / 2 ? 0 : (dtot / 2 + edge - u) / (2 * edge)) * ph.depth;
      }
      const yy = yF(f);
      if (first) { ctx.moveTo(sx, yy); first = false; } else ctx.lineTo(sx, yy);
    }
    ctx.stroke();
    ctx.lineWidth = 1;
    // 轴标签
    ctx.fillStyle = '#8fa0b8'; ctx.font = '11px sans-serif';
    ctx.fillText(t8('tr.flux', '相对亮度'), gx0 + 6, gy0 + 14);
    ctx.fillText('1 − ' + (shown * 100).toFixed(shown < 0.001 ? 3 : 2) + '%', gx0 + 6, gy0 + 30);
    ctx.fillText(t8('tr.time', '时间 →'), gx1 - 46, gy1 + 16);

    // 状态条
    ctx.font = '13px sans-serif';
    if (ph.noTransit) {
      ctx.fillStyle = '#e08585';
      ctx.fillText(t8('tr.noTransit', '❌ 倾角过大：从地球看行星永远不凌星——这就是为什么凌星法只能发现轨道恰好侧对的行星！'), 24, H - 16);
    } else {
      ctx.fillStyle = '#9fd8a8';
      ctx.fillText(t8('tr.depthLbl', '深度 ') + (ph.depth * 100).toFixed(ph.depth < 0.001 ? 4 : 2) + '% · ' +
        t8('tr.durLbl', '持续 ') + (ph.durH < 1 ? ph.durH * 60 : ph.durH).toFixed(0) + (ph.durH < 1 ? t8('tr.min', ' 分钟') : ' ' + t8('info.hours', '小时')) +
        ' · ' + t8('tr.auLbl', '轨道半径 ') + ph.aAU.toFixed(3) + ' AU · ' + t8('tr.need3', '需观测 3 次凌星确认周期'), 24, H - 16);
      if (ph.depth < 0.0002) {
        ctx.fillStyle = '#e0c885';
        ctx.fillText('💡 ' + t8('tr.earthHard', '地球凌日只有 0.008% —— 开普勒级精度才能捕捉！这就是类地行星难找的原因'), 24, H - 34);
      }
    }
    // 标题
    ctx.fillStyle = '#cfe0ff'; ctx.font = 'bold 13px sans-serif';
    ctx.fillText(t8('tr.viewLbl', '从地球看（示意）'), 24, 26);
    ctx.fillText(t8('tr.curveLbl', '光变曲线（凌星时恒星变暗）'), gx0, 40);
  }

  function bindControls() {
    const rp = $('tr-rp'), pd = $('tr-period'), bb = $('tr-b');
    function sync() {
      P.rp = Math.pow(10, +rp.value);
      P.period = Math.pow(10, +pd.value);
      P.b = +bb.value;
      $('tr-rp-v').textContent = P.rp.toFixed(P.rp < 3 ? 1 : 0) + ' R⊕';
      $('tr-period-v').textContent = P.period.toFixed(0) + ' d';
      $('tr-b-v').textContent = P.b.toFixed(2);
    }
    rp.addEventListener('input', sync); pd.addEventListener('input', sync); bb.addEventListener('input', sync);
    sync();
    document.querySelectorAll('.tr-star').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.tr-star').forEach(function (b2) { b2.classList.remove('active'); });
        this.classList.add('active');
        P.star = this.dataset.star;
      });
    });
    document.querySelectorAll('.tr-preset').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const pre = { earth: [1, 365, 'sun', 0], hj: [12, 3.5, 'sun', 0.05], te: [0.92, 6.1, 'm', 0.1] }[this.dataset.pre];
        P.rp = pre[0]; P.period = pre[1]; P.star = pre[2]; P.b = pre[3];
        rp.value = Math.log10(P.rp); pd.value = Math.log10(P.period); bb.value = P.b;
        sync();
        document.querySelectorAll('.tr-star').forEach(function (b2) { b2.classList.toggle('active', b2.dataset.star === P.star); });
        phase = 0.42; playing = true;
        $('tr-play').textContent = t8('star.auto', '⏸ 暂停');
      });
    });
    $('tr-play').addEventListener('click', function () {
      playing = !playing;
      this.textContent = playing ? t8('star.auto', '⏸ 暂停') : t8('star.autoOff', '▶ 播放');
    });
    // 拖拽行星手动凌星
    const cv = $('transit-canvas');
    cv.addEventListener('pointerdown', function (e) {
      const r = cv.getBoundingClientRect(), s = W / r.width;
      const x = (e.clientX - r.left) * s, y = (e.clientY - r.top) * s;
      const st = STARS[P.star];
      const RstarPx = Math.max(14, 95 * st.rSun);
      const ph2 = physics();
      const rpPx = Math.max(1.6, P.rp * 6371 / 696340 * RstarPx);
      const span = 2 * RstarPx * (1.35 + 0.9 * Math.min(2, ph2.aAU / 60));
      const cx = 205, cy = H / 2 + 6;
      const px = cx + (phase - 0.5) * 2 * span, py = cy + P.b * RstarPx;
      if (Math.hypot(x - px, y - py) < Math.max(12, rpPx * 2)) {
        dragging = true; playing = false;
        $('tr-play').textContent = t8('star.autoOff', '▶ 播放');
        cv.setPointerCapture(e.pointerId);
      }
    });
    cv.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      const r = cv.getBoundingClientRect(), s = W / r.width;
      const x = (e.clientX - r.left) * s, y = (e.clientY - r.top) * s;
      const st = STARS[P.star];
      const RstarPx = Math.max(14, 95 * st.rSun);
      const ph2 = physics();
      const span = 2 * RstarPx * (1.35 + 0.9 * Math.min(2, ph2.aAU / 60));
      phase = Math.max(0, Math.min(1, (x - 205) / span + 0.5));
      // 垂直拖动调 b
      bb.value = Math.max(0, Math.min(1.2, (y - (H / 2 + 6)) / RstarPx));
      P.b = +bb.value; $('tr-b-v').textContent = P.b.toFixed(2);
    });
    cv.addEventListener('pointerup', function () { dragging = false; });
  }

  function frame() {
    if (!timer) return;
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.06);
    last = now;
    const ph = physics();
    if (playing && !dragging) {
      // 周期越短视觉越快（对数压缩）
      phase += dt * (0.55 / Math.max(0.12, Math.pow(P.period / 365, 0.4)));
      if (phase > 1) phase -= 1;
    }
    draw();
  }

  function start() {
    if (!ctx) {
      const cv = $('transit-canvas');
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

  setInterval(function () {
    const m = $('modal-transit');
    if (!m) return;
    if (m.classList.contains('hidden')) { if (timer) stop(); }
    else if (!timer) start();
  }, 400);

  return { start: start, stop: stop };
})();
