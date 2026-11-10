/* ============================================================
 * quizdaily.js —— v6.0 每日一题与积分 / v30.0 错题本
 * 题池 = 10 门课程测验 + 扩展题库；答对累计"天文积分"
 * v30：答错自动入册（localStorage 去重），错题重练答对即销账
 * ============================================================ */
'use strict';

window.QuizDaily = (function () {
  const $ = function (id) { return document.getElementById(id); };
  const KEY = 'solar_points_v1';
  const WB_KEY = 'solar_wrongbook_v1';
  let current = null;
  let mode = 'random'; // v30.0 'random' 随机出题 | 'wrong' 错题重练

  function t8(path, fb) { return (window.I18N && I18N.t(path)) || fb; }
  function EN() { return window.I18N && I18N.lang === 'en'; }
  function points() {
    try { return +localStorage.getItem(KEY) || 0; } catch (e) { return 0; }
  }
  function addPoint() {
    try { localStorage.setItem(KEY, String(points() + 1)); } catch (e) { }
  }
  /* ---------- v30.0 错题本（核心三函数，可测试） ---------- */
  function wrongBook() {
    try { return JSON.parse(localStorage.getItem(WB_KEY) || '[]') || []; } catch (e) { return []; }
  }
  function saveWB(list) {
    try { localStorage.setItem(WB_KEY, JSON.stringify(list.slice(0, 60))); } catch (e) { }
  }
  /* 答错入册：按题干去重，记录正确答案与误选项 */
  function addWrong(q, pickIdx) {
    if (!q) return;
    const list = wrongBook().filter(function (w) { return w.q !== q.q; });
    list.unshift({
      q: q.q, answer: q.answer, picked: pickIdx,
      options: q.options, explain: q.explain, at: Date.now()
    });
    saveWB(list);
  }
  /* 销账：重练答对移除 */
  function removeWrong(qText) {
    saveWB(wrongBook().filter(function (w) { return w.q !== qText; }));
  }
  function renderPoints() {
    $('qd-points').textContent = '⭐ ' + points();
    const t = $('qd-wb-count');
    if (t) t.textContent = '📖 ' + t8('qd.wbTab', '错题重练') + ' (' + wrongBook().length + ')';
  }
  function pool() {
    const arr = [];
    TOURS.forEach(function (t) { t.quiz.forEach(function (q) { arr.push(q); }); });
    return arr.concat(EXTRA_QUIZ);
  }

  /* ---------- 模式切换条 ---------- */
  function renderTabs() {
    const bar = $('qd-tabs');
    if (!bar) return;
    const n = wrongBook().length;
    bar.innerHTML =
      '<button class="qd-tab' + (mode === 'random' ? ' on' : '') + '" id="qd-tab-random">🎲 ' + t8('qd.randomTab', '随机出题') + '</button>' +
      '<button class="qd-tab' + (mode === 'wrong' ? ' on' : '') + '" id="qd-tab-wrong" ' + (n ? '' : 'disabled') + '>📖 ' +
      t8('qd.wbTab', '错题重练') + ' (' + n + ')</button>' +
      (n && mode === 'wrong' ? '<button class="qd-tab warn" id="qd-tab-clear">🗑 ' + t8('qd.wbClear', '清空') + '</button>' : '');
    $('qd-tab-random').addEventListener('click', function () { mode = 'random'; renderTabs(); nextQuestion(); });
    const w = $('qd-tab-wrong');
    if (w) w.addEventListener('click', function () { mode = 'wrong'; renderTabs(); nextQuestion(); });
    const cl = $('qd-tab-clear');
    if (cl) cl.addEventListener('click', function () {
      saveWB([]);
      toast(t8('qd.wbCleared', '🗑 错题本已清空——满血复活！'));
      renderTabs(); nextQuestion();
    });
  }

  function renderQuestion(q, fromWB) {
    current = q;
    const en = EN();
    renderPoints();
    const box = $('qd-box');
    box.innerHTML = (fromWB ? '<div class="quiz-src">' + t8('qd.fromWB', '📖 错题重练——答对即销账') + '</div>' : '') +
      '<div class="quiz-q">' + (en && q.qEn ? q.qEn : q.q) + '</div>' +
      q.options.map(function (o, i) {
        return '<button class="quiz-opt" data-i="' + i + '">' + String.fromCharCode(65 + i) + '. ' + o + '</button>';
      }).join('');
    box.querySelectorAll('.quiz-opt').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const pick = +this.dataset.i;
        const right = pick === q.answer;
        if (right) {
          addPoint();
          if (fromWB) removeWrong(q.q); // v30.0 销账
        } else {
          addWrong(q, pick);            // v30.0 入册
        }
        box.querySelectorAll('.quiz-opt').forEach(function (b2, i2) {
          b2.disabled = true;
          if (i2 === q.answer) b2.classList.add('right');
          else if (i2 === pick) b2.classList.add('wrong');
        });
        const fb = document.createElement('div');
        fb.className = 'quiz-feedback ' + (right ? 'ok' : 'no');
        fb.textContent = (right ? (en ? '⭐ +1 · Correct! ' : '⭐ 积分 +1 · 答对了！')
          : (en ? '❌ The answer is ' + String.fromCharCode(65 + q.answer) + '. ' : '❌ 正确答案是 ' + String.fromCharCode(65 + q.answer) + '。')) + ' ' + q.explain;
        box.appendChild(fb);
        renderPoints();
        renderTabs();
        const nb = document.createElement('button');
        nb.className = 'quiz-next';
        nb.textContent = t8('qd.next', '下一题 ▶');
        nb.addEventListener('click', nextQuestion);
        box.appendChild(nb);
      });
    });
  }

  function nextQuestion() {
    if (mode === 'wrong') {
      const wb = wrongBook();
      if (!wb.length) { mode = 'random'; renderTabs(); nextQuestion(); return; }
      renderQuestion(wb[Math.floor(Math.random() * wb.length)], true);
      return;
    }
    const p = pool();
    renderQuestion(p[Math.floor(Math.random() * p.length)], false);
  }

  function start() {
    renderTabs();
    nextQuestion();
  }

  function bind() {
    $('btn-quiz').addEventListener('click', function () { setTimeout(start, 30); });
    window.addEventListener('solar-lang', function () {
      if (!$('modal-quiz').classList.contains('hidden')) start();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }

  return { start: start, wrongBook: wrongBook, addWrong: addWrong, removeWrong: removeWrong };
})();
