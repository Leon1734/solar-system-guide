/* ============================================================
 * tours.js —— v2.0 漫游课程引擎 + 测验 + 成就徽章
 * 依赖：data.js 的 TOURS、main.js 的 SolarApp API
 * ============================================================ */
'use strict';

var TourEngine = (function () {
  const A = () => window.SolarApp;
  let tour = null, idx = 0, waitStartDays = null, waitNeed = 0, autoAdvance = false;
  let quizIdx = 0, quizScore = 0, quizMode = false;
  let speakOn = false;
  let autoPlay = false, autoTimer = null; // v5.0 自动播放
  try { speakOn = localStorage.getItem('solar_tour_sound') === '1'; } catch (e) { }

  const BADGE_KEY = 'solar_badges_v2';
  function badges() {
    try { return JSON.parse(localStorage.getItem(BADGE_KEY) || '[]'); } catch (e) { return []; }
  }
  function saveBadge(id) {
    const b = badges();
    if (b.indexOf(id) < 0) { b.push(id); try { localStorage.setItem(BADGE_KEY, JSON.stringify(b)); } catch (e) { } }
  }

  /* ---------- 语音 ---------- */
  function speak(text, onend) {
    if (!speakOn || !window.speechSynthesis) { if (onend) onend(); return; }
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text.replace(/[🏖️🧭📐☿🌍🪐☄️🏔️✦←→]/g, ''));
      u.lang = EN() ? 'en-US' : 'zh-CN'; u.rate = 1.0;
      if (onend) {
        u.onend = onend;
        u.onerror = onend;
      }
      speechSynthesis.speak(u);
    } catch (e) { if (onend) onend(); }
  }
  function stopSpeak() {
    if (window.speechSynthesis) { try { speechSynthesis.cancel(); } catch (e) { } }
  }

  /* ---------- UI ---------- */
  const $ = function (id) { return document.getElementById(id); };
  const EN = function () { return window.I18N && I18N.lang === 'en'; };
  function stepOv() {
    const ov = window.I18N ? I18N.tourOverlay(tour.id) : null;
    return ov ? ov.steps[idx] : tour.steps[idx];
  }
  function quizOv() {
    const ov = window.I18N ? I18N.tourOverlay(tour.id) : null;
    return ov ? ov.quiz : tour.quiz;
  }
  function tourTitle() {
    const ov = window.I18N ? I18N.tourOverlay(tour.id) : null;
    return ov ? ov.title : tour.title;
  }

  function showCard() {
    $('tour-card').classList.remove('hidden');
    $('fact-ticker').classList.add('hidden');
    A().setTickerPaused(true);
  }
  function hideCard() {
    $('tour-card').classList.add('hidden');
    $('fact-ticker').classList.remove('hidden');
    A().setTickerPaused(false);
  }

  function renderStep() {
    const s = stepOv();
    waitStartDays = null; autoAdvance = false;
    $('tour-step-count').textContent = (idx + 1) + ' / ' + tour.steps.length;
    $('tour-title').textContent = tour.icon + ' ' + tourTitle() + ' · ' + s.t;
    $('tour-text').textContent = s.text;
    $('btn-tour-prev').disabled = idx === 0;
    $('btn-tour-prev').textContent = EN() ? '⏮ Prev' : '⏮ 上一步';
    $('btn-tour-next').textContent = idx === tour.steps.length - 1
      ? (EN() ? 'Start quiz ✓' : '开始测验 ✓')
      : (EN() ? 'Next ▶' : '下一步 ▶');
    $('tour-wait').classList.add('hidden');
    renderDots();
    speak(s.t + '。' + s.text);
    applyStep(s);
    scheduleAuto();
  }

  /* ---------- v5.0 自动播放（语音读完或 8 秒后自动进入下一步） ---------- */
  function clearAuto() {
    if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
  }
  function scheduleAuto() {
    clearAuto();
    if (!autoPlay || quizMode || !tour) return;
    let fired = false;
    const go = function () {
      if (fired || !autoPlay || !tour || quizMode) return;
      fired = true;
      next();
    };
    const s = stepOv();
    if (speakOn && window.speechSynthesis) {
      speak(s.t + '。' + s.text, go);
      autoTimer = setTimeout(go, 16000); // 语音引擎异常兜底
    } else {
      autoTimer = setTimeout(go, 8000);
    }
  }

  function renderDots() {
    const box = $('tour-dots');
    box.innerHTML = '';
    tour.steps.forEach(function (_, i) {
      const d = document.createElement('span');
      d.className = 'dot' + (i === idx ? ' on' : (i < idx ? ' done' : ''));
      box.appendChild(d);
    });
  }

  function applyStep(s) {
    if (s.mode) A().setMode(s.mode);
    if (s.date) A().setDate(s.date);
    if (typeof s.speed === 'number') A().setSpeed(s.speed);
    if (s.cam) {
      if (s.cam.origin) A().gotoOrigin(s.cam.pos || [0, 150, 280]);
      else if (s.cam.key) A().goto(s.cam.key, s.cam.dist, s.cam.dur || 2.4);
    }
    if (s.pulse) A().pulse(s.pulse);
    if (typeof s.waitDays === 'number' && s.waitDays > 0) {
      waitStartDays = A().days();
      waitNeed = s.waitDays;
      autoAdvance = true;
      $('tour-wait').classList.remove('hidden');
    }
  }

  function next() {
    if (quizMode) return;
    clearAuto();
    if (idx < tour.steps.length - 1) { idx++; renderStep(); }
    else startQuiz();
  }
  function prev() {
    if (quizMode || idx === 0) return;
    clearAuto();
    idx--; renderStep();
  }

  /* ---------- 测验 ---------- */
  function startQuiz() {
    quizMode = true; quizIdx = 0; quizScore = 0;
    $('tour-progress-area').classList.add('hidden');
    renderQuiz();
  }
  function renderQuiz() {
    const q = quizOv()[quizIdx];
    const en = EN();
    $('tour-title').textContent = tour.icon + ' ' + (en ? 'Quiz ' : '小测验 ') + (quizIdx + 1) + '/' + quizOv().length + ' · ' + (en ? 'earn your badge!' : '答对拿徽章！');
    $('tour-text').classList.add('hidden');
    $('tour-wait').classList.add('hidden');
    const box = $('tour-quiz');
    box.classList.remove('hidden');
    box.innerHTML = '<div class="quiz-q">' + q.q + '</div>' +
      q.options.map(function (o, i) {
        return '<button class="quiz-opt" data-i="' + i + '">' + String.fromCharCode(65 + i) + '. ' + o + '</button>';
      }).join('');
    box.querySelectorAll('.quiz-opt').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const pick = +this.dataset.i;
        const right = pick === q.answer;
        if (right) quizScore++;
        box.querySelectorAll('.quiz-opt').forEach(function (b2, i2) {
          b2.disabled = true;
          if (i2 === q.answer) b2.classList.add('right');
          else if (i2 === pick) b2.classList.add('wrong');
        });
        const fb = document.createElement('div');
        fb.className = 'quiz-feedback ' + (right ? 'ok' : 'no');
        fb.textContent = (right
          ? (en ? '✅ Correct! ' : '✅ 答对了！')
          : (en ? '❌ Not quite — the answer is ' + String.fromCharCode(65 + q.answer) + '. ' : '❌ 再想想～正确答案是 ' + String.fromCharCode(65 + q.answer) + '。')) + ' ' + q.explain;
        box.appendChild(fb);
        const nb = document.createElement('button');
        nb.className = 'quiz-next';
        nb.textContent = quizIdx < quizOv().length - 1 ? (en ? 'Next ▶' : '下一题 ▶') : (en ? 'View result 🏆' : '查看成绩 🏆');
        nb.addEventListener('click', function () {
          quizIdx++;
          if (quizIdx < quizOv().length) renderQuiz();
          else finishQuiz();
        });
        box.appendChild(nb);
      });
    });
  }
  function finishQuiz() {
    const total = quizOv().length;
    const pass = quizScore / total >= 0.7;
    if (pass) saveBadge(tour.badge.id);
    const en = EN();
    const badgeName = window.I18N ? I18N.badgeName(tour.badge.id, tour.badge.icon + ' ' + tour.badge.name) : tour.badge.icon + ' ' + tour.badge.name;
    $('tour-quiz').innerHTML =
      '<div class="quiz-result">' +
      '<div class="score">' + quizScore + ' / ' + total + '</div>' +
      (pass
        ? '<div class="badge-earn">' + (en ? '🎉 Badge earned: ' : '🎉 获得「') + badgeName + (en ? '' : '」徽章！') + '</div>'
        : '<div class="badge-miss">' + (en ? 'So close! Replay the lesson to earn "' : '差一点点！再走一遍课程就能拿到「') + tour.badge.name + (en ? '"' : '」徽章') + '</div>') +
      '<button class="quiz-next" id="quiz-finish">' + (en ? 'Finish ✦' : '完成课程 ✦') + '</button>' +
      '</div>';
    $('quiz-finish').addEventListener('click', exit);
  }

  /* ---------- 生命周期 ---------- */
  function start(id) {
    tour = TOURS.find(function (t) { return t.id === id; });
    if (!tour) return;
    idx = 0; quizMode = false;
    closeAllModals();
    showCard();
    renderStep();
  }
  function exit() {
    stopSpeak();
    clearAuto();
    autoPlay = false;
    tour = null; quizMode = false;
    $('tour-quiz').classList.add('hidden');
    $('tour-quiz').innerHTML = '';
    $('tour-text').classList.remove('hidden');
    $('tour-progress-area').classList.remove('hidden');
    hideCard();
    A().setSpeed(20);
    A().setTickerPaused(false);
    renderTourMenu();
    renderBadges();
  }

  /* ---------- 菜单 / 徽章 ---------- */
  function closeAllModals() {
    document.querySelectorAll('.modal').forEach(function (m) { m.classList.add('hidden'); });
  }
  function renderTourMenu() {
    const got = badges();
    $('tour-list').innerHTML = TOURS.map(function (t) {
      const ov = window.I18N ? I18N.tourOverlay(t.id) : null;
      const title = ov ? ov.title : t.title;
      const desc = ov ? ov.desc : t.desc;
      const bn = window.I18N ? I18N.badgeName(t.badge.id, t.badge.icon + ' ' + t.badge.name) : t.badge.icon + ' ' + t.badge.name;
      const earned = got.indexOf(t.badge.id) >= 0;
      return '<button class="tour-item" data-id="' + t.id + '">' +
        '<span class="ti-icon">' + t.icon + '</span>' +
        '<span class="ti-body"><span class="ti-title">' + title + (earned ? ' <em class="earned">' + (EN() ? '🏅 passed' : '🏅已通过') + '</em>' : '') + '</span>' +
        '<span class="ti-desc">' + desc + ' · ' + (EN() ? 'badge: ' : '奖励「') + bn + (EN() ? '' : '」') + '</span></span>' +
        '</button>';
    }).join('');
    $('tour-list').querySelectorAll('.tour-item').forEach(function (b) {
      b.addEventListener('click', function () { start(this.dataset.id); });
    });
  }
  function renderBadges() {
    const got = badges();
    const en = EN();
    $('badge-grid').innerHTML = TOURS.map(function (t) {
      const earned = got.indexOf(t.badge.id) >= 0;
      const bn = window.I18N ? I18N.badgeName(t.badge.id, t.badge.name) : t.badge.name;
      return '<div class="badge' + (earned ? ' earned' : '') + '"><div class="b-icon">' + t.badge.icon + '</div>' +
        '<div class="b-name">' + bn + '</div>' +
        '<div class="b-state">' + (earned ? (en ? 'earned' : '已获得') : (en ? 'locked' : '未解锁')) + '</div></div>';
    }).join('') +
      '<div class="badge-summary">' + (en ? 'Badges collected: ' : '已收集 ') + got.length + ' / ' + TOURS.length +
      (got.length === TOURS.length ? (en ? ' — a true Solar System explorer! 🌌' : ' 枚徽章——你已是真正的太阳系探险家！🌌') : (en ? '' : ' 枚徽章')) + '</div>';
  }

  /* ---------- 每帧钩子：自动推进 ---------- */
  function tick() {
    if (!tour || quizMode) return;
    if (autoAdvance && waitStartDays !== null) {
      const gone = A().days() - waitStartDays;
      const pct = Math.max(0, Math.min(1, gone / waitNeed));
      $('tour-wait-bar').style.width = (pct * 100).toFixed(1) + '%';
      if (gone >= waitNeed) {
        autoAdvance = false;
        const s = tour.steps[idx];
        if (typeof s.speedAfter === 'number') A().setSpeed(s.speedAfter);
        next();
      }
    }
  }

  /* ---------- 绑定 ---------- */
  function bind() {
    $('btn-tour-next').addEventListener('click', next);
    $('btn-tour-prev').addEventListener('click', prev);
    $('btn-tour-exit').addEventListener('click', exit);
    $('btn-tour-sound').addEventListener('click', function () {
      speakOn = !speakOn;
      try { localStorage.setItem('solar_tour_sound', speakOn ? '1' : '0'); } catch (e) { }
      this.textContent = speakOn ? '🔊' : '🔇';
      this.title = speakOn ? '关闭语音朗读' : '开启语音朗读';
      if (!speakOn) stopSpeak();
      else if (tour && !quizMode) speak($('tour-text').textContent);
      if (autoPlay) scheduleAuto(); // 语音开关影响自动播放节奏
    });
    $('btn-tour-sound').textContent = speakOn ? '🔊' : '🔇';
    // v5.0 自动播放开关
    $('btn-tour-auto').addEventListener('click', function () {
      autoPlay = !autoPlay;
      this.classList.toggle('active', autoPlay);
      if (autoPlay) scheduleAuto(); else clearAuto();
    });
    // 键盘 ←/→ 在课程中切步骤
    window.addEventListener('keydown', function (e) {
      if (!tour) return;
      if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
      if (e.key === 'ArrowRight' && !e.shiftKey && !autoAdvance) { e.stopImmediatePropagation(); next(); }
    }, true);
    // SolarApp 由 main.js 延迟初始化，轮询等待就绪
    (function waitApp() {
      if (window.SolarApp) SolarApp.onTick(tick);
      else setTimeout(waitApp, 120);
    })();
    // 语言切换时刷新课程界面
    window.addEventListener('solar-lang', function () {
      renderTourMenu();
      renderBadges();
      if (tour && !quizMode) renderStep();
    });
    renderTourMenu();
    renderBadges();
  }

  return {
    start: start,
    exit: exit,
    active: function () { return !!tour; },
    bind: bind
  };
})();

window.TourEngine = TourEngine;
