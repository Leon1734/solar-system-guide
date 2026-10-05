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

  /* ---------- B1 日历列表（v11 冲日 + v12 大距/月相预言机） ---------- */
  let oppCache = null;
  function dateStrOf(days) {
    const dt = new Date(Date.UTC(2000, 0, 1, 12) + days * 86400000);
    return dt.getUTCFullYear() + '-' + String(dt.getUTCMonth() + 1).padStart(2, '0') + '-' + String(dt.getUTCDate()).padStart(2, '0');
  }
  /* v21.0 时刻（世界时 UT，与日期列一致）；冲日/大距/月相事件附带小时 */
  function hmOf(days) {
    const dt = new Date(Date.UTC(2000, 0, 1, 12) + days * 86400000);
    return String(dt.getUTCHours()).padStart(2, '0') + ':' + String(dt.getUTCMinutes()).padStart(2, '0');
  }
  /* v21.0 本地可观测性：读天空面板的观测点（solar_obs_v1），判事件时刻目标高度/太阳高度 */
  const _calT = { x: 0, y: 0, z: 0 };
  function obsOf() {
    try {
      const s = JSON.parse(localStorage.getItem('solar_obs_v1') || 'null');
      if (s && isFinite(s.lat) && isFinite(s.lon)) return s;
    } catch (e) { }
    return { lat: 39.90, lon: 116.40, label: '北京' };
  }
  function eclToHorizLocal(lon, lat, days, ob) {
    const D2R = Math.PI / 180, eps = 23.4393 * D2R;
    const sinD = Math.sin(lat) * Math.cos(eps) + Math.cos(lat) * Math.sin(eps) * Math.sin(lon);
    const dec = Math.asin(Math.max(-1, Math.min(1, sinD)));
    const ra = Math.atan2(Math.sin(lon) * Math.cos(eps) - Math.tan(lat) * Math.sin(eps), Math.cos(lon));
    let gmst = (280.46061837 + 360.98564736629 * days) % 360;
    if (gmst < 0) gmst += 360;
    let H = (gmst + ob.lon) * D2R - ra;
    H = ((H % 6.2832) + 6.2832) % 6.2832; if (H > Math.PI) H -= 6.2832;
    const phi = ob.lat * D2R;
    const sinAlt = Math.sin(dec) * Math.sin(phi) + Math.cos(dec) * Math.cos(phi) * Math.cos(H);
    return Math.asin(Math.max(-1, Math.min(1, sinAlt))) / D2R; // 高度角（度）
  }
  function sunEclLonOf(days) {
    helioPos(PLANETS[2], days, _calT);
    return Math.atan2(-_calT.y, -_calT.x);
  }
  function planetEclLonLat(key, days) {
    const p = PLANETS.find(function (q) { return q.key === key; });
    if (!p) return null;
    helioPos(p, days, _calT);
    const px = _calT.x, py = _calT.y, pz = _calT.z;
    helioPos(PLANETS[2], days, _calT);
    const gx = px - _calT.x, gy = py - _calT.y, gz = pz - _calT.z;
    const r = Math.hypot(gx, gy, gz);
    return { lon: Math.atan2(gy, gx), lat: Math.asin(gz / r) };
  }
  /* 返回 'ok' 本地可见 / 'day' 白天 / 'low' 地平线下 / null 无观测意义 */
  function observabilityOf(o, days) {
    const ob = obsOf();
    let starEcl = null;
    if (o.p.indexOf('star-') === 0) {
      const s = BRIGHT_ECLIPTIC_STARS.find(function (q) { return o.p === 'star-' + q.key; });
      if (!s) return null;
      const R = Math.PI / 180;
      starEcl = { lon: s.ecl[0] * R, lat: s.ecl[1] * R };
    } else if (o.p === 'pleiades') {
      const R = Math.PI / 180;
      starEcl = { lon: 59.95 * R, lat: 4.06 * R };
    } else {
      starEcl = planetEclLonLat(o.p, days);
    }
    if (!starEcl) return null;
    const altT = eclToHorizLocal(starEcl.lon, starEcl.lat, days, ob);
    if (altT < 0) return 'low';
    const altS = eclToHorizLocal(sunEclLonOf(days), 0, days, ob);
    if (altS > -6) return 'day';
    return 'ok';
  }
  /* v21.0 可见性徽标文案 */
  function visNote(vis) {
    if (vis === 'ok') return '👁 ' + t8('cal.visOk', '本地可见（观测点夜空地平线上）');
    if (vis === 'day') return '☀️ ' + t8('cal.visDay', '事件时刻目标在地平线上，但为白天');
    if (vis === 'low') return '🔽 ' + t8('cal.visLow', '事件时刻目标在观测点地平线下');
    return '';
  }
  function computedEvents() {
    if (oppCache) return oppCache;
    const now = nowDays();
    const out = [];
    // 冲日（外行星，±30 年窗口）
    findOppositions(now - 400, now + 30 * 365.25).forEach(function (o) {
      out.push({
        d: dateStrOf(o.days), computed: true, key: o.key, days: o.days, icon: '🪐',
        hm: hmOf(o.days),
        n: o.name, en: o.en,
        t: t8('cal.oppDesc', '行星、地球和太阳排成一线——整夜可见，距离最近、视面最大。') +
          ' ' + t8('cal.ut', '时刻') + ' ' + hmOf(o.days) + ' UT'
      });
    });
    // 大距（内行星水/金，±3 年）
    findElongations(now - 200, now + 3 * 365.25).forEach(function (e) {
      const east = e.type === 'east';
      out.push({
        d: dateStrOf(e.days), computed: true, key: e.key, days: e.days, icon: east ? '🌆' : '🌅',
        hm: hmOf(e.days),
        n: e.name + (east ? '东大距' : '西大距') + ' · ' + e.deg.toFixed(0) + '°',
        en: e.en + ' greatest ' + (east ? 'eastern' : 'western') + ' elongation · ' + e.deg.toFixed(0) + '°',
        t: (east
          ? t8('cal.elongE', '太阳东侧距角最大——黄昏后在西方低空寻找，内行星最佳观测期。')
          : t8('cal.elongW', '太阳西侧距角最大——黎明前在东方低空寻找，内行星最佳观测期。')) +
          ' ' + t8('cal.ut', '时刻') + ' ' + hmOf(e.days) + ' UT'
      });
    });
    // 月相（未来 13 个月 + 近 1 月）
    findMoonPhases(now - 30, now + 400).forEach(function (m) {
      const isNew = m.type === 'new';
      out.push({
        d: dateStrOf(m.days), computed: true, key: 'moon', days: m.days, icon: isNew ? '🌑' : '🌕',
        n: isNew ? '新月' : '满月', en: isNew ? 'New Moon' : 'Full Moon',
        t: isNew
          ? t8('cal.newMoon', '日月同黄经——月相望远镜看到 0% 的月亮；若恰好对齐交点即发生日食。')
          : t8('cal.fullMoon', '整夜可见的圆月——月相望远镜 100%；农历十五前后。')
      });
    });
    // v13 行星互合（±6 年，<1.5°）
    findPlanetConjunctions(now - 6 * 365.25, now + 6 * 365.25).forEach(function (c) {
      out.push({
        d: dateStrOf(c.days), computed: true, key: c.p1.key, days: c.days, icon: '✨', conj: true,
        n: c.p1.name + '合' + c.p2.name + ' · ' + c.sepDeg.toFixed(1) + '°',
        en: c.p1.en + '–' + c.p2.en + ' conjunction · ' + c.sepDeg.toFixed(1) + '°',
        t: t8('cal.conjP', '两颗行星在天空近到同框——肉眼就是一个"双星"，双筒望远镜能看到行星圆面同现。')
      });
    });
    // v19 月掩星精确事件（<0.95° 视地区可见掩食；0.95~1.2° 为极近）
    findLunarOccultations(now - 100, now + 400).forEach(function (o) {
      const vis = observabilityOf(o, o.days);
      out.push({
        d: dateStrOf(o.days), computed: true, key: o.p, days: o.days,
        icon: o.occult ? '🌠' : '✨', conj: true, vis: vis,
        n: (o.occult ? '月掩' : '月伴') + o.name + ' · ' + o.sepDeg.toFixed(2) + '°',
        en: (o.occult ? 'Lunar occultation of ' : 'Moon near ') + o.name + ' · ' + o.sepDeg.toFixed(2) + '°',
        t: (o.occult
          ? t8('cal.occultNow', '月掩级事件——部分观测地可见行星被月缘掩入/复现（月球视差因观测地而异）。小望远镜可见"掩始/复现"。')
          : t8('cal.conjNear2', '极近相合——行星贴着月缘掠过，肉眼可见"星月相依"。')) + ' ' + visNote(vis)
      });
    });
    // v20 月掩亮星（黄道 ±7° 一等星/昴星团）
    findStarOccultations(now - 100, now + 400).forEach(function (o) {
      const vis = observabilityOf(o, o.days);
      out.push({
        d: dateStrOf(o.days), computed: true, key: o.p, days: o.days,
        icon: o.occult ? '🌟' : '✨', conj: true, vis: vis,
        n: (o.occult ? '月掩' : '月伴') + o.name + ' · ' + o.sepDeg.toFixed(2) + '°',
        en: (o.occult ? 'Lunar occultation of ' : 'Moon near ') + o.en + ' · ' + o.sepDeg.toFixed(2) + '°',
        t: (o.occult
          ? t8('cal.occultStar', '月掩亮星——恒星被月缘掩入/复现，小望远镜可见"星点消失又重现"。' + o.con + '方向，' + o.mag.toFixed(1) + ' 等星。')
          : t8('cal.nearStar', '月亮贴着这颗亮星掠过，肉眼即可见"星月相依"。')) + ' ' + visNote(vis)
      });
    });
    // v17 月掩/极近行星 + 月掩昴星团——v19 findLunarOccultations 已覆盖此类事件，跳过避免重复
    // （原 findMoonCloseApproaches 循环整体移除）
    oppCache = out.sort(function (a, b) { return a.days - b.days; });
    return oppCache;
  }
  function allEvents() {
    const curated = ASTRO_EVENTS.slice();
    const computed = computedEvents().filter(function (o) {
      // 与手写条目去重：冲日按同行星 ±25 天；合现象按 ±15 天（避免与"木土大合"等手写条目重复）
      if (o.icon === '🪐') {
        return !curated.some(function (ev) {
          return ev.key === o.key && Math.abs(dayOf(ev.d) - o.days) < 25;
        });
      }
      if (o.conj) {
        return !curated.some(function (ev) { return Math.abs(dayOf(ev.d) - o.days) < 15; });
      }
      return true;
    });
    return curated.concat(computed).sort(function (a, b) { return a.d < b.d ? -1 : 1; });
  }

  /* v13 B：未来 90 天速报条 */
  function renderAlmanac() {
    const box = $('cal-almanac');
    if (!box) return;
    const now = nowDays();
    const en = window.I18N && I18N.lang === 'en';
    const upcoming = allEvents()
      .map(function (ev) { return { ev: ev, dd: ev.days !== undefined ? ev.days : dayOf(ev.d) }; })
      .filter(function (x) { return x.dd >= now - 1 && x.dd <= now + 90; })
      .sort(function (a, b) { return a.dd - b.dd; })
      .slice(0, 6);
    if (!upcoming.length) { box.innerHTML = ''; return; }
    box.innerHTML = '<div class="alm-title">🔭 ' + t8('cal.almanac', '未来 90 天速报') + '</div>' +
      '<div class="alm-list">' + upcoming.map(function (x) {
        const ev = x.ev;
        const days = Math.round(x.dd - now);
        const when = days <= 0 ? t8('cal.today', '就在今天') : (en ? 'in ' + days + ' d' : days + ' 天后');
        return '<button class="alm-item" data-d="' + ev.d + '">' +
          '<span class="alm-when">' + ev.d.slice(5) + (ev.hm ? ' ' + ev.hm : '') + '</span>' +
          '<span class="alm-name">' + (ev.icon || '') + ' ' + (en && ev.en ? ev.en : ev.n) + '</span>' +
          '<span class="alm-days">' + when + '</span></button>';
      }).join('') + '</div>';
    box.querySelectorAll('.alm-item').forEach(function (b) {
      b.addEventListener('click', function () { jumpTo(this.dataset.d); });
    });
  }
  function renderList(filter) {
    const box = $('cal-list');
    const en = window.I18N && I18N.lang === 'en';
    const favs = watchlist();
    const items = allEvents()
      .filter(function (ev) { return !filter || ev.d.indexOf(filter) === 0; })
      .map(function (ev) {
        const badge = ev.icon ? ev.icon + ' ' : (ev.cn ? '📜 ' : '');
        const fav = favs.indexOf(ev.d) >= 0;
        const vis = ev.vis === 'ok' ? '<span class="ci-vis ok">👁</span>'
          : ev.vis === 'day' ? '<span class="ci-vis day">☀️</span>'
          : ev.vis === 'low' ? '<span class="ci-vis low">🔽</span>' : '';
        return '<button class="cal-item' + (ev.computed ? ' computed' : '') + (fav ? ' faved' : '') + '" data-d="' + ev.d + '">' +
          '<span class="ci-date">' + badge + ev.d + (ev.hm ? ' <b class="ci-hm">' + ev.hm + '</b>' : '') + '</span>' +
          '<span class="ci-body"><span class="ci-name">' + (fav ? '★ ' : '') + (en && ev.en ? ev.en : ev.n) + ' ' + vis + '</span>' +
          '<span class="ci-desc">' + ev.t + '</span></span>' +
          '<span class="ci-star" data-d="' + ev.d + '" title="' + (fav ? t8('cal.unfav', '移出计划本') : t8('cal.fav', '加入计划本')) + '">' + (fav ? '★' : '☆') + '</span>' +
          '</button>';
      }).join('');
    box.innerHTML = items || '<p class="ci-none">' + t8('cal.none', '该年份无收录天象，试试其他年份') + '</p>';
    box.querySelectorAll('.cal-item').forEach(function (b) {
      b.addEventListener('click', function (e) {
        if (e.target.classList.contains('ci-star')) return; // 收藏按钮单独处理
        jumpTo(this.dataset.d);
      });
    });
    box.querySelectorAll('.ci-star').forEach(function (s) {
      s.addEventListener('click', function (e) {
        e.stopPropagation();
        toggleFav(this.dataset.d);
      });
    });
    renderFav();
  }

  /* ---------- v14.0 观测计划本 ---------- */
  const FAV_KEY = 'solar_watchlist_v1';
  function watchlist() {
    try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); } catch (e) { return []; }
  }
  function saveFavs(list) {
    try { localStorage.setItem(FAV_KEY, JSON.stringify(list)); } catch (e) { }
  }
  function toggleFav(dateStr) {
    const list = watchlist();
    const i = list.indexOf(dateStr);
    if (i >= 0) list.splice(i, 1); else list.push(dateStr);
    saveFavs(list);
    if (window.Sfx) window.Sfx.click();
    renderList($('cal-search').value.trim());
    renderFav();
  }
  function renderFav() {
    const box = $('cal-fav');
    if (!box) return;
    const favs = watchlist();
    const btn = $('btn-fav');
    if (btn) btn.textContent = '📋 ' + t8('cal.favBtn', '计划本') + (favs.length ? '(' + favs.length + ')' : '');
    if (!favs.length) { box.classList.add('hidden'); box.innerHTML = ''; return; }
    const en = window.I18N && I18N.lang === 'en';
    const all = allEvents();
    box.classList.remove('hidden');
    box.innerHTML = '<div class="fav-title">📋 ' + t8('cal.myPlan', '我的观测计划本') + '</div>' +
      '<div class="fav-list">' + favs.sort().map(function (d) {
        const ev = all.find(function (x) { return x.d === d; });
        return '<button class="fav-item" data-d="' + d + '">' +
          '<span class="alm-when">' + d.slice(5) + '</span>' +
          '<span class="alm-name">' + (ev ? (ev.icon || '') + ' ' + (en && ev.en ? ev.en : ev.n) : d) + '</span>' +
          '<span class="alm-days">★</span></button>';
      }).join('') + '</div>' +
      '<button id="btn-fav-export" style="width:100%; margin-top:6px;">📄 ' + t8('cal.favExport', '导出计划本 (TXT)') + '</button>';
    box.querySelectorAll('.fav-item').forEach(function (b) {
      b.addEventListener('click', function () { jumpTo(this.dataset.d); });
    });
    $('btn-fav-export').addEventListener('click', function () {
      const lines = favs.sort().map(function (d) {
        const ev = all.find(function (x) { return x.d === d; });
        return d + '  ' + (ev ? (en && ev.en ? ev.en : ev.n) : '') + (ev ? ' — ' + ev.t : '');
      });
      const txt = '🌞 太阳系漫游指南 · 观测计划本\n' +
        '━━━━━━━━━━━━━━━━━━\n' + lines.join('\n') + '\n\n' +
        '由太阳系漫游指南生成 · https://leon1734.github.io/solar-system-guide/';
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([txt], { type: 'text/plain;charset=utf-8' }));
      a.download = 'my-observing-plan.txt';
      a.click();
      URL.revokeObjectURL(a.href);
      toast(t8('ui.favOk', '📋 观测计划本已导出'));
    });
  }

  function jumpTo(dateStr) {
    const ev = allEvents().find(function (e) { return e.d === dateStr; });
    if (!ev) return;
    const A = window.SolarApp;
    if (A.state.sys !== 'solar') A.setSystem('solar');
    A.setDate(ev.d);
    A.setPaused(false);
    if (ev.computed && ev.key) A.goto(ev.key, undefined, 2.6);
    else if (ev.cam && ev.cam.follow) A.goto(ev.cam.follow, undefined, 2.6);
    else if (ev.cam && ev.cam.origin) A.gotoOrigin(ev.cam.origin, 2.4);
    // 解说卡
    const card = $('cal-detail');
    const en = window.I18N && I18N.lang === 'en';
    card.classList.remove('hidden');
    card.innerHTML = '<b>' + (ev.icon || '📅') + ' ' + ev.d + ' · ' + (en && ev.en ? ev.en : ev.n) + (ev.computed ? ' 🧮' : '') + '</b><p>' + ev.t + '</p>' +
      (ev.cn ? '<p style="color:#ffd9a0; margin-top:6px;">📜 ' + ev.cn + '</p>' : '');
    if (window.TourEngine && TourEngine.active()) TourEngine.exit();
  }

  /* ---------- v11.0 C：ICS 导出（导入手机/电脑日历） ---------- */
  function toICSDate(dateStr) { return dateStr.replace(/-/g, ''); }
  function exportICS() {
    const evs = allEvents();
    const en = window.I18N && I18N.lang === 'en';
    let ics = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//SolarGuide//CN\r\nCALSCALE:GREGORIAN\r\n';
    evs.forEach(function (ev, i) {
      ics += 'BEGIN:VEVENT\r\n' +
        'UID:solar-guide-' + i + '-' + ev.d + '@local\r\n' +
        'DTSTART;VALUE=DATE:' + toICSDate(ev.d) + '\r\n' +
        'DTEND;VALUE=DATE:' + toICSDate(nextDay(ev.d)) + '\r\n' +
        'SUMMARY:' + (en && ev.en ? ev.en : ev.n) + '\r\n' +
        'DESCRIPTION:' + (ev.t || '').replace(/\r?\n/g, ' ') + '\r\n' +
        'END:VEVENT\r\n';
    });
    ics += 'END:VCALENDAR\r\n';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    a.download = 'solar-guide-events.ics';
    a.click();
    URL.revokeObjectURL(a.href);
    toast(t8('cal.icsOk', '📅 日历文件已导出——可导入手机/电脑日历应用'));
  }
  function nextDay(d) {
    const t = Date.parse(d + 'T12:00:00Z') + 86400000;
    const dt = new Date(t);
    return dt.getUTCFullYear() + '-' + String(dt.getUTCMonth() + 1).padStart(2, '0') + '-' + String(dt.getUTCDate()).padStart(2, '0');
  }

  function initCalendar() {
    renderList('');
    $('cal-search').addEventListener('input', function () {
      renderList(this.value.trim());
    });
    $('btn-cal').addEventListener('click', function () {
      setTimeout(function () {
        renderList($('cal-search').value.trim());
        renderAlmanac();
      }, 30);
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
    $('btn-ics').addEventListener('click', exportICS);
    $('btn-fav').addEventListener('click', function () {
      $('cal-fav').classList.toggle('hidden');
    });
    renderAlmanac();
    window.addEventListener('solar-lang', function () {
      oppCache = null; // 语言切换后重建描述
      renderList($('cal-search') ? $('cal-search').value.trim() : '');
      renderAlmanac();
      renderFav();
      if (!$('timeline').classList.contains('hidden')) buildTimeline();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindAll);
  } else {
    bindAll();
  }
})();
