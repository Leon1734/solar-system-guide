/* ============================================================
 * gravity.js —— v9.0 引力弹弓实验室
 * 简化 patched-conics：相对行星的速度矢量经转弯角 δ 旋转，
 * 对比日心系 v进/v出 与 Δv 增益；三档行星 + 双向掠过 + 关卡目标
 * ============================================================ */
'use strict';

window.GravityLab = (function () {
  const $ = function (id) { return document.getElementById(id); };
  let ctx = null, W = 860, H = 380, timer = null, last = 0;
  let planetKey = 'jupiter', b = 1.0, side = 'back';
  let probeT = null; // 发射动画 0..1

  const PLANETS = {
    jupiter: { n: '木星', en: 'Jupiter', K: 1.2, P: 1.00, r: 26, color: '#d8a56c' },
    saturn: { n: '土星', en: 'Saturn', K: 0.70, P: 0.72, r: 22, color: '#e3c893' },
    earth: { n: '地球', en: 'Earth', K: 0.15, P: 0.30, r: 12, color: '#3f7fd4' },
    venus: { n: '金星', en: 'Venus', K: 0.10, P: 0.28, r: 11, color: '#e8c46b' },
    mercury: { n: '水星', en: 'Mercury', K: 0.04, P: 0.10, r: 8, color: '#b5a48f' }
  };

  /* 关卡目标 */
  const MISSIONS = [
    { text: '🎯 任务一：后方掠过木星（接近距离 ≤ 1.5），让 Δv ≥ +60% —— 学会"荡秋千"加速', check: function (s) { return planetKey === 'jupiter' && side === 'back' && b <= 1.5 && s.gainPct >= 60; },
      done: '✅ 任务一完成！v∞ 方向被转了 100°，速度蹭蹭上涨——这就是旅行者 1/2 号离开太阳系的方式。' },
    { text: '🎯 任务二：改为前方掠过（任何距离），让 Δv 变为负——学会"刹车"，导航不只靠加速', check: function (s) { return side === 'front' && s.dv < -0.01; },
      done: '✅ 任务二完成！减速同样是导航艺术——旅行者 2 号正是借土星"刹车"拐向天王星。' },
    { text: '🎯 任务三：换地球做引力弹弓（后方，b ≤ 1.2）——体验小行星的"微弱一推"', check: function (s) { return planetKey === 'earth' && side === 'back' && b <= 1.2 && s.gainPct > 0; },
      done: '✅ 任务三完成！地球弹弓只能给百分之几的助推，但"卡西尼""罗塞塔"都靠它省下数十吨燃料。全部任务完成，你就是引力导航员！' }
  ];
  let missionIdx = 0;

  function t8(path, fb) { return (window.I18N && I18N.t(path)) || fb; }
  const D2R = Math.PI / 180;

  /* 纯物理（可被测试调用）：v∞=1 归一，接近角 A=60°，
   * 转弯角 δ=2·atan(K/b²)，后方=朝顺行方向旋转（增益），前方=反向（损耗） */
  function sim(bv, sideArg, key) {
    const P = PLANETS[key] || PLANETS.jupiter;
    const turn = 2 * Math.atan(P.K / (bv * bv));
    const A = 60 * D2R;
    const uin = { x: Math.sin(A), y: -Math.cos(A) }; // 相对速度 v∞=1
    const vin = { x: uin.x, y: P.P + uin.y };
    const s = sideArg === 'back' ? 1 : -1;
    const cosT = Math.cos(s * turn), sinT = Math.sin(s * turn);
    const uout = { x: uin.x * cosT - uin.y * sinT, y: uin.x * sinT + uin.y * cosT };
    const vout = { x: uout.x, y: P.P + uout.y };
    const vinMag = Math.hypot(vin.x, vin.y), voutMag = Math.hypot(vout.x, vout.y);
    return {
      turnDeg: turn / D2R,
      vin: vinMag, vout: voutMag,
      dv: voutMag - vinMag,
      gainPct: (voutMag - vinMag) / vinMag * 100,
      uin: uin, uout: uout, P: P.P
    };
  }

  function drawArrow(x0, y0, x1, y1, color, label, width) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width || 2.2;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    const ang = Math.atan2(y1 - y0, x1 - x0);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - 10 * Math.cos(ang - 0.4), y1 - 10 * Math.sin(ang - 0.4));
    ctx.lineTo(x1 - 10 * Math.cos(ang + 0.4), y1 - 10 * Math.sin(ang + 0.4));
    ctx.closePath(); ctx.fill();
    if (label) { ctx.font = '11px sans-serif'; ctx.fillText(label, x1 + 6, y1 + 4); }
    ctx.lineWidth = 1;
  }

  function draw() {
    if (!ctx) return;
    const P = PLANETS[planetKey];
    const sres = sim(b, side, planetKey);
    ctx.fillStyle = '#02030a';
    ctx.fillRect(0, 0, W, H);
    // 星点
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    for (let i = 0; i < 50; i++) ctx.fillRect((i * 127.3) % W, (i * 71.7) % H, 1.2, 1.2);

    /* ---- 左：行星参考系（双曲飞掠） ---- */
    const cx = 215, cy = H / 2 + 8;
    ctx.fillStyle = '#8fa0b8'; ctx.font = 'bold 12.5px sans-serif';
    ctx.fillText(t8('gr.left', '行星参考系：v∞ 被引力"掰弯"一个转角'), 24, 26);
    // 行星
    const gp = ctx.createRadialGradient(cx - P.r * 0.3, cy - P.r * 0.3, 2, cx, cy, P.r);
    gp.addColorStop(0, '#fff'); gp.addColorStop(0.5, P.color); gp.addColorStop(1, 'rgba(0,0,0,0.4)');
    ctx.fillStyle = gp;
    ctx.beginPath(); ctx.arc(cx, cy, P.r, 0, 6.283); ctx.fill();
    // 影响范围圈
    ctx.strokeStyle = 'rgba(216,165,108,0.3)';
    ctx.setLineDash([4, 6]);
    ctx.beginPath(); ctx.arc(cx, cy, P.r * 3.2, 0, 6.283); ctx.stroke();
    ctx.setLineDash([]);
    // 轨迹：入直线 → 绕行贝塞尔 → 出直线
    const uin = sres.uin, uout = sres.uout;
    const L = 150;
    const p0 = { x: cx - uin.x * L, y: cy - uin.y * L };
    const p2 = { x: cx + uout.x * L, y: cy + uout.y * L };
    const bis = { x: uin.x + uout.x, y: uin.y + uout.y };
    const bisLen = Math.hypot(bis.x, bis.y) || 1;
    const ctrl = { x: cx + (bis.x / bisLen) * -38, y: cy + (bis.y / bisLen) * -38 };
    ctx.strokeStyle = 'rgba(111,195,255,0.85)';
    ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(p0.x, p0.y);
    ctx.quadraticCurveTo(ctrl.x, ctrl.y, p2.x, p2.y);
    ctx.stroke();
    ctx.lineWidth = 1;
    // 探测器动画点
    if (probeT !== null) {
      const t = probeT, mt = 1 - t;
      const px = mt * mt * p0.x + 2 * mt * t * ctrl.x + t * t * p2.x;
      const py = mt * mt * p0.y + 2 * mt * t * ctrl.y + t * t * p2.y;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(px, py, 4, 0, 6.283); ctx.fill();
    }
    // v∞ 入/出箭头
    drawArrow(p0.x, p0.y, p0.x + uin.x * 46, p0.y + uin.y * 46, '#9fd0ff', 'v∞ 入');
    drawArrow(p2.x, p2.y, p2.x + uout.x * 46, p2.y + uout.y * 46, '#ffd97a', 'v∞ 出');
    // 转角标注
    ctx.fillStyle = '#8fa0b8'; ctx.font = '11px sans-serif';
    ctx.fillText('δ = ' + sres.turnDeg.toFixed(0) + '°', cx + 12, cy - P.r - 8);

    /* ---- 右：日心参考系（增益对比） ---- */
    const ox = 600, oy = H / 2 + 20;
    ctx.fillStyle = '#8fa0b8'; ctx.font = 'bold 12.5px sans-serif';
    ctx.fillText(t8('gr.right', '日心参考系：行星速度 + 相对速度'), 470, 26);
    // 行星速度 Vp（竖直向上）
    drawArrow(ox, oy, ox, oy - P.P * 62, P.color, 'V' + P.n, 2.6);
    // 探测器进入/离开（日心）
    const vin = { x: uin.x, y: P.P + uin.y };
    const vout = { x: uout.x, y: P.P + uout.y };
    const SC = 62;
    drawArrow(ox, oy, ox + vin.x * SC * 0.8, oy - vin.y * SC, '#6fc3ff', 'v 进');
    drawArrow(ox, oy, ox + vout.x * SC * 0.9, oy - vout.y * SC, '#ff9d5c', 'v 出', 2.8);
    // Δv 能量条
    const bx = 470, by = H - 66, bw = 360;
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(bx, by, bw, 14);
    const gain = sres.gainPct;
    // 刻度：-100%..+150%
    const zeroX = bx + bw * (100 / 250);
    const gx = zeroX + (gain / 250) * bw;
    ctx.strokeStyle = 'rgba(140,170,220,0.4)';
    ctx.beginPath(); ctx.moveTo(zeroX, by - 4); ctx.lineTo(zeroX, by + 18); ctx.stroke();
    ctx.fillStyle = gain >= 0 ? '#6fdc8c' : '#e07a7a';
    ctx.fillRect(Math.min(zeroX, gx), by, Math.abs(gx - zeroX), 14);
    ctx.fillStyle = '#cfe0ff'; ctx.font = '12px sans-serif';
    ctx.fillText((gain >= 0 ? 'Δv +' : 'Δv ') + gain.toFixed(0) + '%', bx + bw + 8, by + 12);
    ctx.fillStyle = '#5a6a88'; ctx.font = '10.5px sans-serif';
    ctx.fillText('-100%', bx - 6, by + 28);
    ctx.fillText('+150%', bx + bw - 22, by + 28);

    /* ---- 底部结论 ---- */
    ctx.fillStyle = '#cfe0ff'; ctx.font = '13px sans-serif';
    const concl = sres.dv > 0.005
      ? t8('gr.gain', '后方掠过：探测器"偷"了行星一丝动量，行星被减速了 10⁻²⁵ 量级——完全测不出。')
      : sres.dv < -0.005
        ? t8('gr.loss', '前方掠过：把动量还给行星，探测器被"刹车"——减速也是导航。')
        : t8('gr.zero', '擦得太远，引力几乎没帮上忙——把接近距离调小试试。');
    ctx.fillText(concl, 24, H - 14);
  }

  function checkMission() {
    const sres = sim(b, side, planetKey);
    if (missionIdx < MISSIONS.length && MISSIONS[missionIdx].check(sres)) {
      const en = window.I18N && I18N.lang === 'en';
      $('g-result').textContent = MISSIONS[missionIdx].done;
      $('g-result').style.color = '#9fe8a8';
      missionIdx++;
    }
    if (missionIdx < MISSIONS.length) {
      $('g-mission').textContent = window.I18N && I18N.lang === 'en'
        ? MISSIONS_EN[missionIdx]
        : MISSIONS[missionIdx].text;
    } else {
      $('g-mission').textContent = t8('gr.allDone', '🏆 全部任务完成——引力导航员认证！');
      $('g-mission').style.color = '#ffd97a';
    }
  }
  const MISSIONS_EN = [
    '🎯 Mission 1: pass BEHIND Jupiter (b ≤ 1.5) for Δv ≥ +60% — learn the swing-by',
    '🎯 Mission 2: pass IN FRONT for negative Δv — braking is navigation too',
    '🎯 Mission 3: Earth flyby (behind, b ≤ 1.2) — feel the gentle nudge'
  ];

  function frame() {
    if (!timer) return;
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (probeT !== null) {
      probeT += dt / 2.2;
      if (probeT > 1) probeT = null;
    }
    draw();
  }

  function bind() {
    document.querySelectorAll('.g-planet').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.g-planet').forEach(function (b2) { b2.classList.remove('active'); });
        this.classList.add('active');
        planetKey = this.dataset.p;
      });
    });
    document.querySelectorAll('.g-side').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.g-side').forEach(function (b2) { b2.classList.remove('active'); });
        this.classList.add('active');
        side = this.dataset.s;
      });
    });
    $('g-b').addEventListener('input', function () {
      b = +this.value;
      probeT = null;
    });
    $('g-launch').addEventListener('click', function () {
      probeT = 0;
      if (window.Sfx) window.Sfx.launch();
      if (free.active) checkFree();
      else if (chain.active) checkChain();
      else checkMission();
    });
    // v11.0 伟大远航接力链（v20 增加 VVEJ 伽利略远征）
    $('g-chain').addEventListener('click', function () {
      chainSet = CHAIN_VOYAGER;
      chain.active = true; free.active = false;
      $('g-free').classList.remove('active');
      $('g-chain2').classList.remove('active');
      this.classList.add('active');
      chain.stage = 0; chain.mult = 1.0;
      applyChainStage();
      toast(t8('gr.chainOn', '🔗 接力链挑战开始——复现旅行者号的伟大远航！'));
      checkChainUI();
    });
    $('g-chain2').addEventListener('click', function () {
      chainSet = CHAIN_VVEJ;
      chain.active = true; free.active = false;
      $('g-free').classList.remove('active');
      $('g-chain').classList.remove('active');
      this.classList.add('active');
      chain.stage = 0; chain.mult = 1.0;
      applyChainStage();
      toast(t8('gr.vvejOn', '🛰 VVEJ 远征开始——金星→金星→地球→木星，复现伽利略号的迂回航线！'));
      checkChainUI();
    });
    // v13 自由接力：任意行星/方向累积速度倍率
    $('g-free').addEventListener('click', function () {
      free.active = !free.active;
      if (free.active) {
        chain.active = false;
        $('g-chain').classList.remove('active'); $('g-chain2').classList.remove('active');
      }
      this.classList.toggle('active', free.active);
      if (free.active) {
        free.mult = 1.0; free.reached = false;
        toast(t8('gr.freeOn', '🎯 自由接力：任意顺序借力，累计速度倍率达到 ×2.0 即达第三宇宙速度！'));
      }
      checkChainUI();
    });
  }

  /* v13.0 自由接力：任意行星/方向，每次发射按 v出/v入 累积倍率；v17 里程碑+路线 */
  const free = { active: false, mult: 1.0, reached: false, route: [], milestones: {} };
  const FREE_MILESTONES = [
    { at: 1.5, zh: '×1.5 — 火星转移轨道级别！', en: '×1.5 — Mars-transfer class!' },
    { at: 2.0, zh: '×2.0 — 已达第三宇宙速度（逃逸）！', en: '×2.0 — solar escape achieved!' }
  ];
  function checkFree() {
    const sres = sim(b, side, planetKey);
    const m = sres.vout / sres.vin;
    free.mult *= m;
    free.route.push(PLANETS[planetKey].n);
    const enough = free.mult >= 2.0;
    $('g-result').textContent = (m >= 1 ? '✅ ' : '⚠️ ') +
      t8('gr.freeGain', '本次 ') + '×' + m.toFixed(2) + ' → ' + t8('gr.chainSpeed', '累计 ×') + free.mult.toFixed(2) +
      (enough ? (window.I18N && I18N.lang === 'en' ? ' — escape speed achieved!' : ' —— 已达第三宇宙速度（逃逸）！') : '');
    $('g-result').style.color = m >= 1 ? '#9fe8a8' : '#e0a0a0';
    FREE_MILESTONES.forEach(function (ms) {
      if (free.mult >= ms.at && !free.milestones[ms.at]) {
        free.milestones[ms.at] = true;
        if (window.Sfx) window.Sfx.success();
        toast(window.I18N && I18N.lang === 'en' ? ms.en : ms.zh);
      }
    });
    checkChainUI();
  }

  /* v11.0 接力链：地球出发 → 木星加速 → 土星冲刺 → 飞出太阳系 */
  /* v20.0 双远征：旅行者号三段链 + 伽利略号 VVEJ 四段链（need 为单段倍率） */
  const CHAIN_VOYAGER = [
    { key: 'earth', need: 1.03, text: '地球出发：后掠地球，让速度倍率 ≥ ×1.03（挣脱引力怀抱）', done: '第 1 站完成！虽然只有百分之几，火星转移轨道已到手。' },
    { key: 'jupiter', need: 1.40, text: '第 2 站木星：后掠木星（b ≤ 1.0），速度倍率 ≥ ×1.40', done: '第 2 站完成！木星把你甩向土星轨道——这就是旅行者的路线。' },
    { key: 'saturn', need: 1.55, text: '第 3 站土星：后掠土星（b ≤ 1.2），倍率 ≥ ×1.55 即超越太阳系逃逸速度', done: '🏆 伟大远航完成！你已复现旅行者号的壮举——下一站：星际空间。' }
  ];
  const CHAIN_VVEJ = [
    { key: 'venus', need: 1.10, text: '第 1 站金星：后掠金星（b ≈ 0.6），本段倍率 ≥ ×1.10', done: '第 1 站完成！金星把你压向更低的轨道——1989 年伽利略号正是这样起航。' },
    { key: 'venus', need: 1.18, text: '第 2 站金星：再来一次！后掠金星（b ≈ 0.5），本段倍率 ≥ ×1.18', done: '第 2 站完成！两次金星借力到手——VVEJ 的第一个 V 已经翻倍。' },
    { key: 'earth', need: 1.15, text: '第 3 站地球：后掠地球（b ≈ 0.5），本段倍率 ≥ ×1.15——决定性的一脚', done: '第 3 站完成！地球弹弓把你甩向外太阳系（VEEG 三级跳完成）。' },
    { key: 'jupiter', need: 1.40, text: '第 4 站木星：后掠木星（b ≤ 1.2），本段倍率 ≥ ×1.40 即刻入轨', done: '🏆 VVEJ 远征完成！你复现了伽利略号 6 年的迂回航线——1995 年它正是这样抵达木星。' }
  ];
  let chainSet = CHAIN_VOYAGER;
  const chain = { active: false, stage: 0, mult: 1.0 };

  function applyChainStage() {
    if (chain.stage >= chainSet.length) return;
    const st = chainSet[chain.stage];
    planetKey = st.key;
    side = 'back';
    document.querySelectorAll('.g-planet').forEach(function (b2) {
      b2.classList.toggle('active', b2.dataset.p === st.key);
    });
    document.querySelectorAll('.g-side').forEach(function (b2) {
      b2.classList.toggle('active', b2.dataset.s === 'back');
    });
  }
  function checkChain() {
    if (!chain.active || chain.stage >= chainSet.length) return;
    const st = chainSet[chain.stage];
    const sres = sim(b, side, planetKey);
    const stageMult = sres.vout / sres.vin;
    if (planetKey !== st.key || side !== 'back' || stageMult < st.need) {
      $('g-result').textContent = t8('gr.chainFail', '❌ 速度不足（×' + (chain.mult * stageMult).toFixed(2) + '）——调小接近距离 b，保持后方掠过再试。');
      $('g-result').style.color = '#e0a0a0';
      return;
    }
    chain.mult *= stageMult;
    $('g-result').textContent = '✅ ' + st.done + '（累计 ×' + chain.mult.toFixed(2) + '）';
    $('g-result').style.color = '#9fe8a8';
    if (window.Sfx) window.Sfx.success();
    chain.stage++;
    if (chain.stage < chainSet.length) applyChainStage();
    checkChainUI();
  }
  function checkChainUI() {
    const el = $('g-chain-status');
    if (!el) return;
    if (free.active) {
      el.textContent = '🎯 ' + t8('gr.freeStatus', '自由接力 · 累计 ×') + free.mult.toFixed(2) +
        (free.mult >= 2.0 ? ' ✅' : ' → ' + t8('gr.freeGoal', '目标 ×2.0')) +
        (free.route.length ? ' · ' + free.route.join('→') : '');
      return;
    }
    if (!chain.active) { el.textContent = ''; return; }
    if (chain.stage >= chainSet.length) {
      el.textContent = '🏆 ' + (chainSet === CHAIN_VVEJ ?
        t8('gr.vvejDone', 'VVEJ 远征完成！累计速度倍率 ×') :
        t8('gr.chainDone', '伟大远航完成！累计速度倍率 ×')) + chain.mult.toFixed(2);
      return;
    }
    const st = chainSet[chain.stage];
    el.textContent = '🔗 ' + t8('gr.chainStage', '第 ') + (chain.stage + 1) + '/' + chainSet.length + t8('gr.chainStation', '站') +
      ' · ' + t8('gr.chainSpeed', '累计 ×') + chain.mult.toFixed(2) + (EN() ? ' → need ×' + st.need : ' → 需 ×' + st.need);
  }
  function EN() { return window.I18N && I18N.lang === 'en'; }

  function start() {
    if (!ctx) {
      ctx = $('gravity-canvas').getContext('2d');
      W = $('gravity-canvas').width; H = $('gravity-canvas').height;
      bind();
    }
    if (location.search.indexOf('novx') >= 0) { draw(); return; }
    if (!timer) { last = performance.now(); timer = setInterval(frame, 33); }
    draw();
  }
  function stop() { if (timer) { clearInterval(timer); timer = null; } }

  setInterval(function () {
    const m = $('modal-gravity');
    if (!m) return;
    if (m.classList.contains('hidden')) { if (timer) stop(); }
    else if (!timer) start();
  }, 500);

  return { start: start, stop: stop, sim: sim, resetChain: function () { chain.stage = 0; chain.mult = 1.0; checkChainUI(); } };
})();
