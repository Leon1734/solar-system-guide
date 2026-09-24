/* ============================================================
 * constellation.js —— v6.0 星座背景层
 * 亮星座连线 + 亮星中文名置于天球（真实赤经赤纬 → 黄道坐标），
 * 含黄道参考圈；支持按星座英文名高亮（供今晚天空联动）
 * ============================================================ */
'use strict';

window.StarMap = (function () {
  const R = 48000; // 与背景星层同球径
  const D2R = Math.PI / 180;
  const OBL = 23.44 * D2R; // 黄赤交角
  let group = null, lineMat = null;
  let labels = [];           // { pos, el, con }
  let highlightUntil = 0;
  let built = false;

  /* 赤经小时/赤纬度 → 黄道坐标单位向量（场景系：X=x_ecl, Y=z_ecl, Z=-y_ecl）×R */
  function raDecToScene(raH, decD, out) {
    const ra = raH * 15 * D2R, dec = decD * D2R;
    const sinB = Math.sin(dec) * Math.cos(OBL) - Math.cos(dec) * Math.sin(OBL) * Math.sin(ra);
    const cosBcosL = Math.cos(dec) * Math.cos(ra);
    const cosBsinL = Math.sin(dec) * Math.sin(OBL) + Math.cos(dec) * Math.cos(OBL) * Math.sin(ra);
    const beta = Math.asin(Math.max(-1, Math.min(1, sinB)));
    const lon = Math.atan2(cosBsinL, cosBcosL);
    const cl = Math.cos(beta);
    out.set(cl * Math.cos(lon) * R, Math.sin(beta) * R, -cl * Math.sin(lon) * R);
    return out;
  }

  function build() {
    if (built) return;
    built = true;
    group = new THREE.Group();

    const lineVerts = [];
    const starPos = [];
    CONSTELLATIONS.forEach(function (c) {
      const pts = c.s.map(function (sd) {
        const v = new THREE.Vector3();
        raDecToScene(sd[0], sd[1], v);
        starPos.push(v.x, v.y, v.z);
        return v;
      });
      c.l.forEach(function (pair) {
        const a = pts[pair[0]], b = pts[pair[1]];
        lineVerts.push(a.x, a.y, a.z, b.x, b.y, b.z);
      });
      Object.keys(c.b || {}).forEach(function (idx) {
        const el = document.createElement('div');
        el.className = 'body-label star-label';
        el.textContent = (I18N && I18N.lang === 'en') ? (c.e + ' ' + c.b[idx]) : c.b[idx];
        el.style.display = 'none';
        el.addEventListener('click', function (e) {
          e.stopPropagation();
          showMyth(c.e);
        });
        labelsRoot.appendChild(el);
        labels.push({ pos: pts[+idx].clone(), el: el, con: c });
      });
    });
    lineMat = new THREE.LineBasicMaterial({
      color: 0x6a86c8, transparent: true, opacity: 0.32, depthWrite: false
    });
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(lineVerts, 3));
    group.add(new THREE.LineSegments(lg, lineMat));

    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    group.add(new THREE.Points(sg, new THREE.PointsMaterial({
      size: 3.4, map: T_DOT, color: 0xdfe6ff, transparent: true,
      opacity: 0.85, sizeAttenuation: false, depthWrite: false
    })));

    // 黄道参考圈
    const eVerts = [];
    for (let k = 0; k <= 180; k++) {
      const lon = k / 180 * Math.PI * 2;
      eVerts.push(Math.cos(lon) * R, 0, -Math.sin(lon) * R);
    }
    group.add(new THREE.Line(
      new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(eVerts, 3)),
      new THREE.LineBasicMaterial({ color: 0xc8a86a, transparent: true, opacity: 0.22, depthWrite: false })
    ));

    group.visible = state.showConst;
    scene.add(group);
  }

  function update() {
    if (!state.showConst || !group) return;
    camera.getWorldPosition(camTmp);
    labels.forEach(function (L) {
      const d = camTmp.distanceTo(L.pos);
      if (d >= 95000) { L.el.style.display = 'none'; return; }
      const p = L.pos.clone().project(camera);
      const vis = p.z < 1 && Math.abs(p.x) < 1.05 && Math.abs(p.y) < 1.05;
      L.el.style.display = vis ? '' : 'none';
      if (!vis) return;
      L.el.style.left = ((p.x * 0.5 + 0.5) * window.innerWidth) + 'px';
      L.el.style.top = ((-p.y * 0.5 + 0.5) * window.innerHeight) + 'px';
    });
    if (highlightUntil && clock.elapsedTime > highlightUntil && lineMat) {
      highlightUntil = 0;
      lineMat.opacity = 0.32;
      lineMat.color.setHex(0x6a86c8);
    }
  }

  function highlight(conNameEn) {
    if (!group) return;
    highlightUntil = clock.elapsedTime + 6;
    lineMat.opacity = 0.95;
    lineMat.color.setHex(0xffc85e);
  }

  /* v7.0：星座神话小传卡 */
  function showMyth(conNameEn) {
    const c = CONSTELLATIONS.find(function (x) { return x.e === conNameEn; });
    const m = CONSTELLATION_MYTHS[conNameEn];
    if (!c || !m) return;
    const en = window.I18N && I18N.lang === 'en';
    document.getElementById('const-h').textContent = '✨ ' + (en ? c.e : c.n);
    document.getElementById('con-story').textContent = en ? (m.storyEn || m.story) : m.story;
    document.getElementById('con-star').textContent = '⭐ ' + m.star;
    const mod = document.getElementById('modal-constellation');
    if (mod) mod.classList.remove('hidden');
  }

  function toggle(on) {
    state.showConst = !!on;
    if (!group && on) build();
    if (group) {
      group.visible = !!on;
      if (!on) labels.forEach(function (L) { L.el.style.display = 'none'; });
    }
  }

  function refreshLang() {
    if (!built) return;
    labels.forEach(function (L) { L.el.remove(); });
    labels = [];
    scene.remove(group);
    built = false;
    build();
  }

  return { toggle: toggle, update: update, highlight: highlight, refreshLang: refreshLang, showMyth: showMyth };
})();

/* 自注册：SolarApp 就绪后接入渲染后钩子与语言刷新 */
(function () {
  (function wait() {
    if (window.SolarApp) {
      SolarApp.onAfterRender(function () { StarMap.update(); });
      window.addEventListener('solar-lang', function () { StarMap.refreshLang(); });
    } else setTimeout(wait, 120);
  })();
})();
