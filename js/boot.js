/* ============================================================
 * boot.js —— 延迟脚本最后一步：绑定课程引擎、注册 SW、今日天象提醒
 * ============================================================ */
'use strict';
if (window.TourEngine) TourEngine.bind();
if (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(function () { });
  }
}

/* v7.0 今日天象提醒：启动 4 秒后提示今天的事件/流星雨峰值 */
setTimeout(function () {
  if (!window.SolarApp) return;
  const now = new Date(Date.UTC(2000, 0, 1, 12) + SolarApp.days() * 86400000);
  const ymd = now.getUTCFullYear() + '-' + String(now.getUTCMonth() + 1).padStart(2, '0') + '-' + String(now.getUTCDate()).padStart(2, '0');
  const ev = ASTRO_EVENTS.find(function (e) { return e.d === ymd; });
  const dayOfYear = Math.floor((now - new Date(Date.UTC(now.getUTCFullYear(), 0, 1))) / 86400000);
  const shower = METEOR_SHOWERS.find(function (s) { return Math.abs(dayOfYear - s.peak) <= 2; });
  if (ev) SolarApp.toast('📅 今天：' + ev.n + '（天文日历可回放）');
  else if (shower) SolarApp.toast('✨ ' + shower.name + '正值活跃期（峰值 ZHR ' + shower.zhr + '）');
}, 4000);
