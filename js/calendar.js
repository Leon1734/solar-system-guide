/* ============================================================
 * calendar.js —— v6.0 天文日历 + 时间轴刷子
 * B1: 30+ 关键天象点击跳转（日期 + 运镜 + 解说）
 * B2: ±100 年对数时间轴，刻度即天象锚点
 * ============================================================ */
'use strict';

(function () {
  const $ = function (id) { return document.getElementById(id); };

  function t8(path, fb) { return (window.I18N && I18N.t(path)) || fb; }
  function nowDays() { return (Date.now() - Date.UTC(2000, 0, 1, 12)) / 86400000; }
  function dayOf(s) { return (new Date(s + 'T12:00:00Z') - Date.UTC(2000, 0, 1, 12)) / 86400000; }

  /* ---------- B1 日历列表 ---------- */
  function renderList(filter) {
    const box = $('cal-list');
    const en = window.I18N && I18N.lang === 'en';
    const items = ASTRO_EVENTS
      .filter(function (ev) { return !filter || ev.d.indexOf(filter) === 0; })
      .map(function (ev) {
        return '<button class="cal-item" data-d="' + ev.d + '">' +
          '<span class="ci-date">' + ev.d + '</span>' +
          '<span class="ci-body"><span class="ci-name">' + (en && ev.en ? ev.en : ev.n) + '</span>' +
          '<span class="ci-desc">' + ev.t + '</span></span></button>';
      }).join('');
    box.innerHTML = items || '<p class="ci-none">' + t8('cal.none', '该年份无收录天象，试试其他年份') + '</p>';
    box.querySelectorAll('.cal-item').forEach(function (b) {
      b.addEventListener('click', function () { jumpTo(this.dataset.d); });
    });
  }

  function jumpTo(dateStr) {
    const ev = ASTRO_EVENTS.find(function (e) { return e.d === dateStr; });
    if (!ev) return;
    const A = window.SolarApp;
    if (A.state.sys !== 'solar') A.setSystem('solar');
    A.setDate(ev.d);
    A.setPaused(false);
    if (ev.cam && ev.cam.follow) A.goto(ev.cam.follow, undefined, 2.6);
    else if (ev.cam && ev.cam.origin) A.gotoOrigin(ev.cam.origin, 2.4);
    // 解说卡
    const card = $('cal-detail');
    const en = window.I18N && I18N.lang === 'en';
    card.classList.remove('hidden');
    card.innerHTML = '<b>📅 ' + ev.d + ' · ' + (en && ev.en ? ev.en : ev.n) + '</b><p>' + ev.t + '</p>';
    if (window.TourEngine && TourEngine.active()) TourEngine.exit();
  }

  function initCalendar() {
    renderList('');
    $('cal-search').addEventListener('input', function () {
      renderList(this.value.trim());
    });
    $('btn-cal').addEventListener('click', function () {
      setTimeout(function () { renderList($('cal-search').value.trim()); }, 30);
    });
  }

  /* ---------- B2 时间轴刷子 ---------- */
  let tlTimer = null;
  function sliderToDays(v) { // v: -1000..1000 → 对数 ±100 年
    const yr = Math.sign(v) * Math.pow(Math.abs(v) / 1000, 2) * 100;
    return nowDays() + yr * 365.25;
  }
  function daysToSlider(days) {
    const yr = (days - nowDays()) / 365.25;
    const c = Math.max(-100, Math.min(100, yr));
    return Math.sign(c) * Math.pow(Math.abs(c) / 100, 0.5) * 1000;
  }

  function buildTimeline() {
    const wrap = $('timeline');
    const slider = $('tl-slider');
    const span = $('tl-span');
    // 天象刻度
    const ticks = $('tl-ticks');
    ticks.innerHTML = '';
    const now = nowDays();
    ASTRO_EVENTS.forEach(function (ev) {
      const d = dayOf(ev.d);
      if (Math.abs(d - now) > 100 * 365.25) return;
      const sl = daysToSlider(d);
      const dot = document.createElement('span');
      dot.className = 'tl-tick';
      dot.style.left = ((sl + 1000) / 2000 * 100) + '%';
      dot.title = ev.d + ' ' + ev.n;
      dot.addEventListener('click', function () { jumpTo(ev.d); });
      ticks.appendChild(dot);
    });
    slider.addEventListener('input', function () {
      const days = sliderToDays(+this.value);
      SolarApp.setDate(days);
      const yr = (days - nowDays()) / 365.25;
      span.textContent = (yr >= 0 ? '+' : '') + yr.toFixed(1) + ' ' + t8('ui.years', '年');
      if (window.TourEngine && TourEngine.active()) TourEngine.exit();
    });
    // 拖动结束同步日期框
    slider.addEventListener('change', function () { syncDateInput(); });
  }

  function toggleTimeline(force) {
    const wrap = $('timeline');
    const on = force !== undefined ? force : wrap.classList.contains('hidden');
    wrap.classList.toggle('hidden', !on);
    $('btn-timeline').classList.toggle('active', on);
    if (on && !tlTimer) {
      // 打开时同步滑杆到当前时刻，并随模拟时间缓慢跟随
      const slider = $('tl-slider');
      const sync = function () {
        if (!SolarApp) return;
        if (document.activeElement !== slider) slider.value = daysToSlider(SolarApp.days());
        const yr = (SolarApp.days() - nowDays()) / 365.25;
        $('tl-span').textContent = (yr >= 0 ? '+' : '') + yr.toFixed(1) + ' ' + t8('ui.years', '年');
      };
      sync();
      tlTimer = setInterval(sync, 500);
    } else if (!on && tlTimer) {
      clearInterval(tlTimer); tlTimer = null;
    }
  }

  function bindAll() {
    initCalendar();
    buildTimeline();
    $('btn-timeline').addEventListener('click', function () { toggleTimeline(); });
    window.addEventListener('solar-lang', function () {
      renderList($('cal-search') ? $('cal-search').value.trim() : '');
      if (!$('timeline').classList.contains('hidden')) buildTimeline();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindAll);
  } else {
    bindAll();
  }
})();
