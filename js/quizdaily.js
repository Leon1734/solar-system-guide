/* ============================================================
 * quizdaily.js —— v6.0 每日一题与积分
 * 题池 = 7 门课程测验 + 扩展题库；答对累计"天文积分"（本地持久化）
 * ============================================================ */
'use strict';

window.QuizDaily = (function () {
  const $ = function (id) { return document.getElementById(id); };
  const KEY = 'solar_points_v1';
  let current = null;

  function t8(path, fb) { return (window.I18N && I18N.t(path)) || fb; }
  function points() {
    try { return +localStorage.getItem(KEY) || 0; } catch (e) { return 0; }
  }
  function addPoint() {
    try { localStorage.setItem(KEY, String(points() + 1)); } catch (e) { }
  }
  function pool() {
    const arr = [];
    TOURS.forEach(function (t) { t.quiz.forEach(function (q) { arr.push(q); }); });
    return arr.concat(EXTRA_QUIZ);
  }
  function renderPoints() {
    $('qd-points').textContent = '⭐ ' + points();
  }

  function nextQuestion() {
    const p = pool();
    current = p[Math.floor(Math.random() * p.length)];
    const en = window.I18N && I18N.lang === 'en';
    renderPoints();
    const box = $('qd-box');
    box.innerHTML = '<div class="quiz-q">' + (en && current.qEn ? current.qEn : current.q) + '</div>' +
      current.options.map(function (o, i) {
        return '<button class="quiz-opt" data-i="' + i + '">' + String.fromCharCode(65 + i) + '. ' + o + '</button>';
      }).join('');
    box.querySelectorAll('.quiz-opt').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const pick = +this.dataset.i;
        const right = pick === current.answer;
        if (right) addPoint();
        box.querySelectorAll('.quiz-opt').forEach(function (b2, i2) {
          b2.disabled = true;
          if (i2 === current.answer) b2.classList.add('right');
          else if (i2 === pick) b2.classList.add('wrong');
        });
        const fb = document.createElement('div');
        fb.className = 'quiz-feedback ' + (right ? 'ok' : 'no');
        fb.textContent = (right ? (en ? '⭐ +1 · Correct! ' : '⭐ 积分 +1 · 答对了！')
          : (en ? '❌ The answer is ' + String.fromCharCode(65 + current.answer) + '. ' : '❌ 正确答案是 ' + String.fromCharCode(65 + current.answer) + '。')) + ' ' + current.explain;
        box.appendChild(fb);
        renderPoints();
        const nb = document.createElement('button');
        nb.className = 'quiz-next';
        nb.textContent = t8('qd.next', '下一题 ▶');
        nb.addEventListener('click', nextQuestion);
        box.appendChild(nb);
      });
    });
  }

  function start() {
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

  return { start: start };
})();
