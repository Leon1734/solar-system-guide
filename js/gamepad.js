/* ============================================================
 * gamepad.js —— v5.0 游戏手柄控制
 * 左摇杆：环绕旋转视角 | 右摇杆（上下）：推近拉远
 * A(0)：跟随选中 | B(1)：取消选中 | X(2)：切换轨道 | Start(9)：暂停
 * ============================================================ */
'use strict';

(function () {
  const DEAD = 0.18;          // 摇杆死区
  const ROT_SPD = 2.4;        // 旋转速度 rad/s
  const ZOOM_SPD = 0.9;       // 缩放速度（比例/秒）
  let connected = false;
  const prevBtn = {};

  function t8(path, fb) { return (window.I18N && I18N.t(path)) || fb; }

  function onceBtn(gp, idx) {
    const cur = gp.buttons[idx] && gp.buttons[idx].pressed;
    const was = prevBtn[idx];
    prevBtn[idx] = cur;
    return cur && !was;
  }

  function tick(dt) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = null;
    for (let i = 0; i < pads.length; i++) if (pads[i]) { gp = pads[i]; break; }
    if (!gp) return;
    const A = window.SolarApp;
    if (!A) return;
    const axes = gp.axes;
    const lx = Math.abs(axes[0]) > DEAD ? axes[0] : 0;
    const ly = Math.abs(axes[1]) > DEAD ? axes[1] : 0;
    const ry = Math.abs(axes[3]) > DEAD ? axes[3] : 0;

    // 环绕旋转：绕 controls.target 的球面角
    if (lx || ly) {
      const tgt = A.controls.target;
      const off = A.camera.position.clone().sub(tgt);
      const sph = new THREE.Spherical().setFromVector3(off);
      sph.theta -= lx * ROT_SPD * dt;
      sph.phi = Math.max(0.08, Math.min(Math.PI - 0.08, sph.phi - ly * ROT_SPD * dt));
      off.setFromSpherical(sph);
      A.camera.position.copy(tgt).add(off);
    }
    // 右摇杆上下：推近 / 拉远
    if (ry) {
      const tgt = A.controls.target;
      const off = A.camera.position.clone().sub(tgt);
      const k = Math.exp(-ry * ZOOM_SPD * dt);
      const min = A.controls.minDistance, max = A.controls.maxDistance;
      const len = Math.max(min * 1.05, Math.min(max * 0.98, off.length() * k));
      off.setLength(len);
      A.camera.position.copy(tgt).add(off);
    }
    // 按键
    if (onceBtn(gp, 0)) { // A：跟随当前选中（未选则选太阳）
      const sel = A.selected();
      A.follow(sel ? sel.data.key : 'sun');
    }
    if (onceBtn(gp, 1)) { // B：取消选中
      A.select(null);
    }
    if (onceBtn(gp, 2)) { // X：切换轨道线
      const tg = document.getElementById('tg-orbits');
      if (tg) { tg.checked = !tg.checked; tg.dispatchEvent(new Event('change')); }
    }
    if (onceBtn(gp, 9)) { // Start：暂停
      A.setPaused(!A.state.paused);
    }
  }

  function bind() {
    (function waitApp() {
      if (window.SolarApp) SolarApp.onTick(tick);
      else setTimeout(waitApp, 120);
    })();
    window.addEventListener('gamepadconnected', function (e) {
      if (connected) return;
      connected = true;
      SolarApp.toast(t8('ui.padOn', '🎮 手柄已连接：左摇杆旋转 / 右摇杆缩放 / A 跟随 / B 取消 / Start 暂停'));
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
})();
