/* ============================================================
 * moonphase.js —— v6.0 月相望远镜
 * 由模拟时刻的日月黄经差计算真实月相/月龄/照亮比例，
 * 明暗界线椭圆弧精确绘制 + 月面地名 + 成因几何小图
 * ============================================================ */
'use strict';

window.MoonLab = (function () {
  const $ = function (id) { return document.getElementById(id); };
  let ctx = null, W = 720, H = 430, timer = null;

  function t8(path, fb) { return (window.I18N && I18N.t(path)) || fb; }

  /* 模拟月球的地心黄经（真实理论，定义见 solar-core.js） */
  function moonLon(days) {
    return realMoonLonRad(days);
  }
  function sunLonOf(days) {
    helioPos(PLANETS[2], days, { x: 0, y: 0, z: 0 });
    const e = { x: 0, y: 0, z: 0 };
    helioPos(PLANETS[2], days, e);
    return Math.atan2(-e.y, -e.x);
  }

  function phaseInfo() {
    const days = SolarApp.days();
    const elong = moonLon(days) - sunLonOf(days); // 距角（有符号）
    const eAbs = Math.abs(elong) * 180 / Math.PI; // 0..180
    const illum = (1 - Math.cos(elong)) / 2;      // 照亮比例
    const waxing = ((elong % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) < Math.PI;
    const age = eAbs / 360 * 29.53;
    const names = [
      [1.85, '新月', 'New Moon'], [48, '娥眉月', 'Waxing crescent'], [93, '上弦月', 'First quarter'],
      [137, '盈凸月', 'Waxing gibbous'], [183, '满月', 'Full Moon'], [222, '亏凸月', 'Waning gibbous'],
      [267, '下弦月', 'Last quarter'], [312, '残月', 'Waning crescent'], [360, '新月', 'New Moon']
    ];
    let name = names[names.length - 1][1], nameEn = names[names.length - 1][2];
    for (let i = 0; i < names.length; i++) {
      if (eAbs < names[i][0]) { name = names[i][1]; nameEn = names[i][2]; break; }
    }
    return { elong: elong, eAbs: eAbs, illum: illum, waxing: waxing, age: age, name: name, nameEn: nameEn };
  }

  function drawMoon(cx, cy, r, ph) {
    const k = Math.cos(ph.elong); // 终止线椭圆半宽系数（-1..1）
    const litLeft = !ph.waxing;   // 亏月照亮在左
    // 1) 夜底
    ctx.fillStyle = '#0b0f1a';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.283); ctx.fill();
    // 2) 亮区路径 = lit 半圆弧 + 终止线椭圆回程（对全部相位自洽）
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2, litLeft);
    ctx.ellipse(cx, cy, Math.abs(k) * r, r, 0, Math.PI / 2, -Math.PI / 2, litLeft ? (k < 0) : (k > 0));
    ctx.closePath();
    const lg = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
    lg.addColorStop(0, '#f2efe6');
    lg.addColorStop(1, '#c2beb0');
    ctx.fillStyle = lg;
    ctx.fill();
    // 3) 月海与第谷射纹（source-atop：只画在亮区之上）
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    const maria = [[-0.30, 0.48, 0.30], [-0.62, 0.08, 0.34], [0.38, 0.12, 0.26], [0.68, 0.30, 0.13], [0.45, -0.15, 0.22], [0.22, -0.32, 0.18]];
    ctx.fillStyle = 'rgba(96,100,115,0.5)';
    maria.forEach(function (m) {
      ctx.beginPath(); ctx.ellipse(cx + m[0] * r, cy - m[1] * r, m[2] * r, m[2] * r * 0.75, 0.4, 0, 6.283); ctx.fill();
    });
    ctx.strokeStyle = 'rgba(255,255,250,0.28)';
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * 6.283;
      ctx.beginPath();
      ctx.moveTo(cx - 0.12 * r, cy + 0.72 * r);
      ctx.lineTo(cx - 0.12 * r + Math.cos(a) * 0.34 * r, cy + 0.72 * r + Math.sin(a) * 0.34 * r);
      ctx.stroke();
    }
    ctx.restore();
    // 4) 轮廓
    ctx.strokeStyle = 'rgba(180,190,220,0.5)';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.283); ctx.stroke();

    // 地名（仅照亮侧）
    ctx.font = '11.5px sans-serif';
    MOON_FEATURES.forEach(function (f) {
      const fx = cx + f.x * r, fy = cy - f.y * r;
      const onLit = litLeft ? f.x < -Math.abs(k) * 0.9 : f.x > Math.abs(k) * 0.9;
      ctx.fillStyle = onLit ? 'rgba(230,235,250,0.92)' : 'rgba(150,160,185,0.40)';
      ctx.beginPath(); ctx.arc(fx, fy, 1.6, 0, 6.283); ctx.fill();
      ctx.fillText(f.n, fx + 5, fy + 4);
    });
  }

  function drawGeometry(ph) {
    // 成因小图：太阳—地球—月球夹角
    const gx = W - 130, gy = 86;
    ctx.fillStyle = '#8fa0b8'; ctx.font = '12px sans-serif';
    ctx.fillText(t8('moon.geo', '成因：阳光永远照亮朝向太阳的半面'), gx - 96, 26);
    // 太阳（右）
    const sg = ctx.createRadialGradient(gx + 92, gy, 4, gx + 92, gy, 34);
    sg.addColorStop(0, '#ffd97a'); sg.addColorStop(1, 'rgba(255,180,60,0)');
    ctx.fillStyle = sg; ctx.fillRect(gx + 58, gy - 34, 68, 68);
    // 地球（中）
    ctx.fillStyle = '#5fa8f0';
    ctx.beginPath(); ctx.arc(gx, gy, 12, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#c4d2ea'; ctx.fillText(t8('moon.earth', '地球'), gx - 10, gy + 30);
    // 月球轨道
    ctx.strokeStyle = 'rgba(140,170,220,0.35)';
    ctx.beginPath(); ctx.arc(gx, gy, 46, 0, 6.283); ctx.stroke();
    // 月球（按距角放置）
    const a = -ph.elong;
    const mx = gx + Math.cos(a) * 46, my = gy - Math.sin(a) * 46 * 0.35;
    ctx.fillStyle = '#cfcfcf';
    ctx.beginPath(); ctx.arc(mx, my, 6, 0, 6.283); ctx.fill();
    // 明暗（亮面朝向太阳一侧）
    ctx.fillStyle = 'rgba(8,10,20,0.85)';
    ctx.beginPath(); ctx.arc(mx, my, 6, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#e8e6df';
    ctx.beginPath();
    ctx.arc(mx, my, 6, -Math.PI / 2, Math.PI / 2, false); // 朝太阳（右侧）半面亮
    ctx.fill();
  }

  function draw() {
    if (!ctx) return;
    const ph = phaseInfo();
    ctx.fillStyle = '#02030a';
    ctx.fillRect(0, 0, W, H);
    // 星点
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (let i = 0; i < 50; i++) ctx.fillRect((i * 127.3) % W, (i * 71.7) % H, 1.2, 1.2);

    drawMoon(W * 0.30, H * 0.47, 128, ph);
    drawGeometry(ph);

    // 信息
    const en = window.I18N && I18N.lang === 'en';
    ctx.fillStyle = '#ffe9b8'; ctx.font = 'bold 17px sans-serif';
    ctx.fillText(en ? ph.nameEn + ' · ' + (ph.illum * 100).toFixed(0) + '% lit' :
      ph.name + ' · 照亮 ' + (ph.illum * 100).toFixed(0) + '%', 40, 60);
    ctx.fillStyle = '#c4d2ea'; ctx.font = '13px sans-serif';
    ctx.fillText(t8('moon.age', '月龄 ') + ph.age.toFixed(1) + t8('moon.days', ' 天') +
      ' · ' + t8('moon.elong', '距角 ') + ph.eAbs.toFixed(0) + '°', 40, 86);
    ctx.fillStyle = '#8fa0b8'; ctx.font = '12px sans-serif';
    ctx.fillText(t8('moon.law', '月相 = 月球绕地球转、被阳光照亮的半面朝向我们的角度不同'), 40, 112);
    ctx.fillText(t8('moon.sync', '📅 拖动日期，观赏 29.5 天一轮的完整月相变化（模拟月球周期真实，与真实农历日期存在相位差）'), 40, 132);
    // 侧栏与月亮之间的装饰线
    ctx.strokeStyle = 'rgba(120,150,210,0.2)';
    ctx.beginPath(); ctx.moveTo(52, H - 66); ctx.lineTo(W - 52, H - 66); ctx.stroke();
    ctx.fillStyle = '#5a6a88'; ctx.font = '11.5px sans-serif';
    ctx.fillText(t8('moon.lock', '月面始终以同一面朝向地球——右侧小图是俯视北黄极的几何关系'), 52, H - 44);
  }

  function start() {
    if (!ctx) {
      ctx = $('moon-canvas').getContext('2d');
      W = $('moon-canvas').width; H = $('moon-canvas').height;
    }
    if (!timer) timer = setInterval(draw, 2000);
    draw();
  }
  function stop() { if (timer) { clearInterval(timer); timer = null; } }

  setInterval(function () {
    const m = $('modal-moon');
    if (!m) return;
    if (m.classList.contains('hidden')) { if (timer) stop(); }
    else if (!timer) start();
  }, 500);

  return { start: start, stop: stop, phaseInfo: phaseInfo };
})();
