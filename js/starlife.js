/* ============================================================
 * starlife.js —— v3.0 恒星的一生（太阳演化剧场）
 * 独立 2D Canvas 动画模态框：星云 → 原恒星 → 主序星 →
 * 红巨星 → 行星状星云 → 白矮星
 * 依赖：data.js 的 STAR_LIFE 文案
 * ============================================================ */
'use strict';

(function () {
  const $ = function (id) { return document.getElementById(id); };
  let stage = 0, tIn = 0, playing = true, timer = null, last = 0;
  let W = 760, H = 380, ctx = null;
  let dust = null, disk = null, shell = null, stars = null;

  const STAGE_SECONDS = 7; // 每阶段自动停留时长

  /* 预生成粒子（种子化，稳定可复现） */
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function initParticles() {
    const rand = mulberry32(2024);
    dust = [];
    for (let i = 0; i < 260; i++) {
      const a = rand() * Math.PI * 2;
      const d = 0.15 + Math.pow(rand(), 0.7) * 0.85;
      dust.push({
        a: a, d: d, r: 0.8 + rand() * 2.6, sp: 0.02 + rand() * 0.05,
        hue: 200 + rand() * 60, al: 0.25 + rand() * 0.55
      });
    }
    disk = [];
    for (let i = 0; i < 170; i++) {
      disk.push({ a: rand() * Math.PI * 2, d: 0.34 + rand() * 0.34, r: 0.7 + rand() * 1.6, sp: 0.25 + rand() * 0.5, al: 0.2 + rand() * 0.6 });
    }
    shell = [];
    for (let i = 0; i < 220; i++) {
      shell.push({ a: rand() * Math.PI * 2, d: 0.12 + rand() * 0.06, sp: 0.05 + rand() * 0.09, hue: rand() < 0.5 ? 190 : 320, r: 0.6 + rand() * 1.8, al: 0.3 + rand() * 0.5 });
    }
    stars = [];
    for (let i = 0; i < 90; i++) stars.push({ x: rand(), y: rand(), r: rand() * 1.1, tw: rand() * 6.28 });
  }

  /* ---------- 各阶段绘制 ---------- */
  function bg(alpha) {
    ctx.fillStyle = 'rgba(2,3,10,' + (alpha == null ? 1 : alpha) + ')';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    stars.forEach(function (s) {
      ctx.globalAlpha = 0.35 + 0.35 * Math.sin(tIn * 2 + s.tw);
      ctx.beginPath(); ctx.arc(s.x * W, s.y * H, s.r, 0, 6.283); ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  function drawNebula(t) {
    bg();
    const cx = W * 0.5, cy = H * 0.52;
    // 收缩中的云团
    const shrink = 1 - 0.25 * t;
    dust.forEach(function (p) {
      const d = p.d * shrink * H * 0.62;
      const a = p.a + t * p.sp * 3;
      const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 0.72;
      ctx.globalAlpha = p.al * (0.5 + 0.5 * Math.sin(t * 4 + p.a * 5));
      ctx.fillStyle = 'hsl(' + p.hue + ',60%,72%)';
      ctx.beginPath(); ctx.arc(x, y, p.r, 0, 6.283); ctx.fill();
    });
    ctx.globalAlpha = 1;
    // 中心微光
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 60 + 10 * Math.sin(t * 3));
    g.addColorStop(0, 'rgba(180,200,255,0.25)');
    g.addColorStop(1, 'rgba(180,200,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function drawProtostar(t) {
    bg();
    const cx = W * 0.5, cy = H * 0.52;
    // 吸积盘
    disk.forEach(function (p) {
      const a = p.a + t * p.sp * 5;
      const d = p.d * H * 0.75 * (1 + 0.06 * Math.sin(t * 2 + p.a * 3));
      const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 0.28;
      ctx.globalAlpha = p.al * 0.8;
      ctx.fillStyle = p.d < 0.5 ? '#ffd9a0' : '#a8c8ff';
      ctx.beginPath(); ctx.arc(x, y, p.r, 0, 6.283); ctx.fill();
    });
    ctx.globalAlpha = 1;
    // 两极喷流
    [[0, -1], [0, 1]].forEach(function (dir) {
      const len = H * 0.34 * (0.8 + 0.2 * Math.sin(t * 5));
      const g = ctx.createLinearGradient(cx, cy, cx + dir[0] * len, cy + dir[1] * len);
      g.addColorStop(0, 'rgba(180,220,255,0.5)');
      g.addColorStop(1, 'rgba(180,220,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(cx - 10, cy + dir[1] * 20);
      ctx.lineTo(cx + 10, cy + dir[1] * 20);
      ctx.lineTo(cx + 26 + dir[0] * 10, cy + dir[1] * len);
      ctx.lineTo(cx - 26 + dir[0] * 10, cy + dir[1] * len);
      ctx.closePath(); ctx.fill();
    });
    // 原恒星核
    const g2 = ctx.createRadialGradient(cx, cy, 0, cx, cy, 26 + 3 * Math.sin(t * 6));
    g2.addColorStop(0, '#ffffff');
    g2.addColorStop(0.5, '#ffe9b8');
    g2.addColorStop(1, 'rgba(255,180,90,0)');
    ctx.fillStyle = g2;
    ctx.beginPath(); ctx.arc(cx, cy, 30, 0, 6.283); ctx.fill();
  }

  function drawMain(t) {
    bg();
    const cx = W * 0.5, cy = H * 0.5, R = 46;
    // 地球轨道
    ctx.strokeStyle = 'rgba(111,195,255,0.5)';
    ctx.beginPath(); ctx.ellipse(cx, cy, 168, 66, 0, 0, 6.283); ctx.stroke();
    // 地球
    const ea = t * 1.2;
    const ex = cx + Math.cos(ea) * 168, ey = cy + Math.sin(ea) * 66;
    ctx.fillStyle = '#5fa8f0';
    ctx.beginPath(); ctx.arc(ex, ey, 4.5, 0, 6.283); ctx.fill();
    ctx.fillStyle = 'rgba(140,190,255,0.9)';
    ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('地球', ex, ey - 10);
    // 太阳
    const pulse = 1 + 0.03 * Math.sin(t * 6.3);
    const g = ctx.createRadialGradient(cx - R * 0.2, cy - R * 0.2, R * 0.1, cx, cy, R * pulse);
    g.addColorStop(0, '#fff8dc');
    g.addColorStop(0.6, '#ffce54');
    g.addColorStop(1, 'rgba(255,140,30,0.15)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, R * pulse, 0, 6.283); ctx.fill();
    // 光晕
    const g2 = ctx.createRadialGradient(cx, cy, R, cx, cy, R * 2.6);
    g2.addColorStop(0, 'rgba(255,200,90,0.28)');
    g2.addColorStop(1, 'rgba(255,200,90,0)');
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,233,184,0.9)';
    ctx.fillText(t8('starlife.mainNote', '氢聚变 · 稳定燃烧 100 亿年'), cx, cy + R + 40);
    ctx.textAlign = 'left';
  }

  function drawGiant(t) {
    bg();
    const cx = W * 0.5, cy = H * 0.55;
    const R = (H * 0.42) * (0.94 + 0.06 * Math.sin(t * 2.2));
    // 被吞没的内行星轨道（画在巨星表面内）
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    [0.22, 0.35, 0.5].forEach(function (f) {
      ctx.beginPath(); ctx.ellipse(cx, cy, R * f, R * f * 0.4, 0, 0, 6.283); ctx.stroke();
    });
    const g = ctx.createRadialGradient(cx - R * 0.25, cy - R * 0.25, R * 0.1, cx, cy, R);
    g.addColorStop(0, '#ffd9a0');
    g.addColorStop(0.45, '#ff8f4c');
    g.addColorStop(0.85, '#c0392b');
    g.addColorStop(1, 'rgba(140,30,20,0.4)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.283); ctx.fill();
    // 对流斑驳
    ctx.globalAlpha = 0.25;
    for (let i = 0; i < 8; i++) {
      const a = t * 0.4 + i * 0.9;
      const x = cx + Math.cos(a) * R * 0.55, y = cy + Math.sin(a * 1.3) * R * 0.5;
      ctx.fillStyle = '#8e2f1f';
      ctx.beginPath(); ctx.arc(x, y, R * 0.09, 0, 6.283); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(255,220,180,0.92)';
    ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(t8('starlife.giantNote', '水星、金星已被吞没 · 地球表面化为熔岩'), cx, H - 24);
    ctx.textAlign = 'left';
  }

  function drawNebula2(t) {
    bg();
    const cx = W * 0.5, cy = H * 0.52;
    const spread = 0.5 + t * 1.6;
    shell.forEach(function (p) {
      const d = p.d * spread * H;
      const x = cx + Math.cos(p.a) * d, y = cy + Math.sin(p.a) * d * 0.8;
      ctx.globalAlpha = p.al * Math.max(0, 1 - t * 0.75);
      ctx.fillStyle = 'hsl(' + p.hue + ',70%,74%)';
      ctx.beginPath(); ctx.arc(x, y, p.r * (1 + t), 0, 6.283); ctx.fill();
    });
    ctx.globalAlpha = 1;
    // 中央白矮星
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 14);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.4, '#cfe4ff');
    g.addColorStop(1, 'rgba(160,200,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, 16, 0, 6.283); ctx.fill();
    ctx.fillStyle = 'rgba(200,220,255,0.85)';
    ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(t8('starlife.shellNote', '外层气体壳扩散中——将成为下一代恒星的原材料'), cx, H - 24);
    ctx.textAlign = 'left';
  }

  function drawDwarf(t) {
    bg();
    const cx = W * 0.5, cy = H * 0.5;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 12 + 1.5 * Math.sin(t * 2));
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.35, '#b8d4ff');
    g.addColorStop(1, 'rgba(120,160,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, 14, 0, 6.283); ctx.fill();
    ctx.fillStyle = 'rgba(170,195,235,0.85)';
    ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(t8('starlife.dwarfNote', '地球大小的残骸 · 用数十亿年慢慢冷却'), cx, cy + 52);
    ctx.textAlign = 'left';
  }

  const PAINTERS = [drawNebula, drawProtostar, drawMain, drawGiant, drawNebula2, drawDwarf];

  /* ---------- 主循环（setInterval 驱动：后台标签中 rAF 会被节流停摆） ---------- */
  function frame() {
    if (!timer) return;
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (playing) {
      tIn += dt / STAGE_SECONDS;
      if (tIn >= 1) {
        tIn = 0;
        if (stage < PAINTERS.length - 1) setStage(stage + 1);
        else setStage(0);
      }
    }
    PAINTERS[stage](tIn);
    updateBar();
  }
  function updateBar() {
    const bar = document.getElementById('sl-bar');
    if (bar) bar.style.width = (tIn * 100).toFixed(1) + '%';
  }
  function t8(path, fb) { return (window.I18N && I18N.t(path)) || fb; }
  function stageOv(key) { return window.I18N ? I18N.starlifeStage(key) : null; }
  function renderStageText() {
    const s = STAR_LIFE[stage];
    const ov = stageOv(s.key);
    document.getElementById('sl-name').textContent = ov ? ov.name : s.icon + ' ' + s.name;
    document.getElementById('sl-age').textContent = ov ? ov.age : s.age;
    document.getElementById('sl-desc').textContent = ov ? ov.desc : s.desc;
    document.getElementById('sl-detail').textContent = '· ' + (ov ? ov.detail : s.detail);
    document.querySelectorAll('#sl-dots .dot').forEach(function (d, i) {
      d.className = 'dot' + (i === stage ? ' on' : (i < stage ? ' done' : ''));
    });
  }
  function setStage(i) {
    stage = (i + PAINTERS.length) % PAINTERS.length;
    tIn = 0;
    renderStageText();
  }

  function start() {
    if (!ctx) {
      const cv = document.getElementById('starlife-canvas');
      ctx = cv.getContext('2d');
      W = cv.width; H = cv.height;
      initParticles();
      document.getElementById('sl-prev').addEventListener('click', function () { setStage(stage - 1); });
      document.getElementById('sl-next').addEventListener('click', function () { setStage(stage + 1); });
      document.getElementById('sl-play').addEventListener('click', function () {
        playing = !playing;
        this.textContent = playing ? t8('starlife.auto', '⏸ 暂停') : t8('starlife.autoOff', '▶ 自动播放');
      });
      // 生成阶段进度点
      const dotsBox = document.getElementById('sl-dots');
      dotsBox.innerHTML = '';
      STAR_LIFE.forEach(function () {
        const d = document.createElement('span');
        d.className = 'dot';
        dotsBox.appendChild(d);
      });
      // 语言切换时刷新文案
      window.addEventListener('solar-lang', function () {
        if (ctx) renderStageText();
      });
    }
    setStage(stage);
    playing = true;
    document.getElementById('sl-play').textContent = t8('starlife.auto', '⏸ 暂停');
    last = performance.now();
    if (location.search.indexOf('novx') >= 0) { PAINTERS[stage](0); return; } // 无头截图：单帧
    if (!timer) timer = setInterval(frame, 33);
  }
  function stop() {
    if (timer) { clearInterval(timer); timer = null; }
  }

  /* 模态框关闭时自动停帧（轮询检测，避免侵入 main.js） */
  setInterval(function () {
    const m = document.getElementById('modal-starlife');
    if (!m) return;
    if (m.classList.contains('hidden')) { if (timer) stop(); }
    else if (!timer) start();
  }, 400);

  window.StarLife = { start: start, stop: stop };
})();
