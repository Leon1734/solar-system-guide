/* ============================================================
 * sfx.js —— v10.0 程序化音效（WebAudio，零音频资源）
 * 默认关闭；开启后：按钮点击音 / 成功音 / 发射扫频 / 太空氛围底噪
 * ============================================================ */
'use strict';

window.Sfx = (function () {
  let ac = null;
  let enabled = false;
  let padNodes = null;
  const KEY = 'solar_sfx_v1';

  function ensure() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ac = new AC();
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }

  /* 单音：振荡器 + 包络 */
  function tone(freq, dur, type, vol, slideTo) {
    if (!enabled) return;
    const a = ensure();
    if (!a) return;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type || 'sine';
    o.frequency.value = freq;
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, a.currentTime + dur);
    g.gain.setValueAtTime(vol || 0.06, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
    o.connect(g); g.connect(a.destination);
    o.start();
    o.stop(a.currentTime + dur + 0.02);
  }

  /* 太空氛围底噪：双失谐振荡器 + 低通 */
  function padOn() {
    const a = ensure();
    if (!a || padNodes) return;
    const g = a.createGain();
    g.gain.value = 0;
    g.gain.linearRampToValueAtTime(0.018, a.currentTime + 2);
    const filter = a.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 220;
    const o1 = a.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 55;
    const o2 = a.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 55.7;
    o1.connect(filter); o2.connect(filter);
    filter.connect(g); g.connect(a.destination);
    o1.start(); o2.start();
    padNodes = { g: g, o1: o1, o2: o2 };
  }
  function padOff() {
    if (!padNodes) return;
    try {
      padNodes.g.gain.linearRampToValueAtTime(0, ac.currentTime + 0.8);
      const nodes = padNodes;
      setTimeout(function () { try { nodes.o1.stop(); nodes.o2.stop(); } catch (e) { } }, 900);
    } catch (e) { }
    padNodes = null;
  }

  /* ---------- 对外 API ---------- */
  function setEnabled(on) {
    enabled = !!on;
    try { localStorage.setItem(KEY, enabled ? '1' : '0'); } catch (e) { }
    if (enabled) { ensure(); padOn(); }
    else padOff();
  }
  function isEnabled() { return enabled; }
  function init() {
    try { enabled = localStorage.getItem(KEY) === '1'; } catch (e) { }
    if (enabled) { ensure(); padOn(); }
    return enabled;
  }
  /* 需在用户手势中调用 */
  function toggle() {
    setEnabled(!enabled);
    return enabled;
  }

  return {
    init: init,
    toggle: toggle,
    isEnabled: isEnabled,
    click: function () { tone(1250, 0.045, 'sine', 0.05); },
    success: function () { tone(660, 0.1, 'sine', 0.07); setTimeout(function () { tone(990, 0.16, 'sine', 0.07); }, 90); },
    launch: function () { tone(180, 0.5, 'sawtooth', 0.08, 950); },
    chime: function () { tone(880, 0.14, 'triangle', 0.06); }
  };
})();
