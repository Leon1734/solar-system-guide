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
    /* v8.0 深空天体标记（点击出档案卡） */
    DEEPSKY.forEach(function (d) {
      const v = new THREE.Vector3();
      raDecToScene(d.ra, d.dec, v);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: T_DOT, color: d.color, transparent: true, opacity: 0.9, depthWrite: false
      }));
      sp.position.copy(v);
      sp.scale.set(10, 10, 1);
      group.add(sp);
      const el = document.createElement('div');
      el.className = 'body-label star-label ds-label';
      el.textContent = '🌌 ' + ((I18N && I18N.lang === 'en') ? d.e : d.n);
      el.style.display = 'none';
      el.addEventListener('click', function (e) {
        e.stopPropagation();
        showDeepSky(d);
      });
      labelsRoot.appendChild(el);
      labels.push({ pos: v.clone(), el: el, con: null });
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
    buildChinese();
  }

  /* v9.0 中国星官模式：二十八宿驿站链 + 宿名标签 */
  let cnGroup = null, cnLabels = [], cnLineMat = null;
  function buildChinese() {
    if (cnGroup) return;
    cnGroup = new THREE.Group();
    const pts = CONST_MANSIONS.map(function (m) {
      const v = new THREE.Vector3();
      raDecToScene(m.ra, m.dec, v);
      return v;
    });
    // 宿链（闭合）：月亮的 28 站路线
    const linePts = [];
    for (let i = 0; i <= pts.length; i++) {
      const a = pts[i % pts.length];
      linePts.push(a.x, a.y, a.z);
    }
    cnLineMat = new THREE.LineBasicMaterial({
      color: 0xd8a86a, transparent: true, opacity: 0.5, depthWrite: false
    });
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(linePts, 3));
    cnGroup.add(new THREE.Line(lg, cnLineMat));
    // 距星点 + 宿名标签
    pts.forEach(function (v, i) {
      const m = CONST_MANSIONS[i];
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: T_DOT, color: 0xffd9a0, transparent: true, opacity: 0.95, depthWrite: false
      }));
      sp.position.copy(v);
      sp.scale.set(6.5, 6.5, 1);
      cnGroup.add(sp);
      const el = document.createElement('div');
      el.className = 'body-label star-label cn-label';
      el.textContent = (I18N && I18N.lang === 'en') ? (m.n + ' · ' + m.img.split('').pop()) : m.n + '宿';
      el.style.display = 'none';
      el.addEventListener('click', function (e) {
        e.stopPropagation();
        showMansion(i);
      });
      labelsRoot.appendChild(el);
      cnLabels.push({ pos: v.clone(), el: el });
    });
    cnGroup.visible = state.constMode === 'china';
    scene.add(cnGroup);
    buildSanYuan();
  }

  /* v14.0 三垣骨架：紫微/太微/天市（仅中国模式显示） */
  let syGroup = null, syLabels = [];
  function buildSanYuan() {
    if (syGroup) return;
    syGroup = new THREE.Group();
    SAN_YUAN.forEach(function (yuan) {
      const pts = yuan.stars.map(function (s) {
        const v = new THREE.Vector3();
        raDecToScene(s.ra, s.dec, v);
        return v;
      });
      // 骨架连线
      const linePts = [];
      pts.forEach(function (v) { linePts.push(v.x, v.y, v.z); });
      const lg = new THREE.BufferGeometry();
      lg.setAttribute('position', new THREE.Float32BufferAttribute(linePts, 3));
      cnGroup.add(syGroup.add(new THREE.Line(lg, new THREE.LineBasicMaterial({
        color: yuan.color, transparent: true, opacity: 0.55, depthWrite: false
      }))));
      // 星点与标签
      pts.forEach(function (v, i) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({
          map: T_DOT, color: yuan.color, transparent: true, opacity: 0.95, depthWrite: false
        }));
        sp.position.copy(v);
        sp.scale.set(6, 6, 1);
        syGroup.add(sp);
        const el = document.createElement('div');
        el.className = 'body-label star-label sy-label';
        el.textContent = (I18N && I18N.lang === 'en') ? yuan.stars[i].n + ' · ' + yuan.e.split(' ')[0] : yuan.stars[i].n;
        el.style.display = 'none';
        el.addEventListener('click', function (e) {
          e.stopPropagation();
          showSanYuan(yuan);
        });
        labelsRoot.appendChild(el);
        syLabels.push({ pos: v.clone(), el: el });
      });
      // 垣名标签（取首星上方）
      const nameEl = document.createElement('div');
      nameEl.className = 'body-label star-label sy-label';
      nameEl.textContent = (I18N && I18N.lang === 'en') ? '🏯 ' + yuan.e : '🏯 ' + yuan.n;
      nameEl.style.display = 'none';
      nameEl.addEventListener('click', function (e) {
        e.stopPropagation();
        showSanYuan(yuan);
      });
      labelsRoot.appendChild(nameEl);
      syLabels.push({ pos: pts[0].clone(), el: nameEl, nameTag: true });
    });
    syGroup.visible = state.constMode === 'china';
    scene.add(syGroup);
  }
  function showSanYuan(yuan) {
    const en = window.I18N && I18N.lang === 'en';
    document.getElementById('const-h').textContent = '🏯 ' + (en ? yuan.e : yuan.n);
    document.getElementById('con-story').textContent = en
      ? 'One of the Three Enclosures of ancient Chinese sky charts — the framework beyond the 28 mansions.'
      : yuan.note;
    document.getElementById('con-star').textContent = '⭐ ' + t8b('垣内诸星：') +
      yuan.stars.map(function (s) { return s.n; }).join('、');
    document.getElementById('modal-constellation').classList.remove('hidden');
  }

  /* v9.0 宿卡（复用神话模态框） */
  function showMansion(idx) {
    const m = CONST_MANSIONS[idx];
    if (!m) return;
    const en = window.I18N && I18N.lang === 'en';
    document.getElementById('const-h').textContent = '🏯 ' + (en ? m.e : m.n + '宿') + '（' + m.img + '）';
    document.getElementById('con-story').textContent =
      (en ? 'The ' + (idx + 1) + 'th of 28 lunar mansions — one night’s inn for the Moon on its monthly journey. ' : '二十八宿的第 ' + (idx + 1) + ' 站——月亮每晚在这里歇一脚，约 27.3 天走完一圈。') +
      m.meaning;
    document.getElementById('con-star').textContent = '⭐ ' + t8b('距星：') + m.star;
    document.getElementById('modal-constellation').classList.remove('hidden');
  }
  function t8b(fb) { return (window.I18N && I18N.lang === 'en') ? 'Determinant star: ' : fb; }

  function update() {
    if (!state.showConst || !group) return;
    camera.getWorldPosition(camTmp);
    const cnOn = state.constMode === 'china';
    cnLabels.forEach(function (L) {
      const d = camTmp.distanceTo(L.pos);
      if (!cnOn || d >= 95000) { L.el.style.display = 'none'; return; }
      const p = L.pos.clone().project(camera);
      const vis = p.z < 1 && Math.abs(p.x) < 1.05 && Math.abs(p.y) < 1.05;
      L.el.style.display = vis ? '' : 'none';
      if (!vis) return;
      L.el.style.left = ((p.x * 0.5 + 0.5) * window.innerWidth) + 'px';
      L.el.style.top = ((-p.y * 0.5 + 0.5) * window.innerHeight) + 'px';
    });
    // v14.0 三垣标签（随中国模式）
    syLabels.forEach(function (L) {
      const d = camTmp.distanceTo(L.pos);
      if (!cnOn || d >= 95000) { L.el.style.display = 'none'; return; }
      const p = L.pos.clone().project(camera);
      const vis = p.z < 1 && Math.abs(p.x) < 1.05 && Math.abs(p.y) < 1.05;
      L.el.style.display = vis ? '' : 'none';
      if (!vis) return;
      L.el.style.left = ((p.x * 0.5 + 0.5) * window.innerWidth) + 'px';
      L.el.style.top = ((-p.y * 0.5 + 0.5) * window.innerHeight) - (L.nameTag ? 14 : 0) + 'px';
    });
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

  /* v8.0：深空天体卡（复用神话模态框） */
  function showDeepSky(d) {
    const en = window.I18N && I18N.lang === 'en';
    document.getElementById('const-h').textContent = '🌌 ' + (en ? d.e : d.n);
    document.getElementById('con-story').textContent = en ? (d.descEn || d.desc) : d.desc;
    document.getElementById('con-star').textContent = '⭐ ' + d.facts[0];
    document.getElementById('modal-constellation').classList.remove('hidden');
  }

  /* v9.0 三态切换：off / west / china（toggle(on) 兼容旧调用） */
  let lastMode = 'west';
  function setMode(mode) {
    state.constMode = mode;
    state.showConst = mode !== 'off';
    if (mode !== 'off') {
      if (!group) build();
      group.visible = mode === 'west';
      if (cnGroup) cnGroup.visible = mode === 'china';
      if (syGroup) syGroup.visible = mode === 'china';
      lastMode = mode;
      if (mode === 'west') {
        lineMat.opacity = 0.32;
        lineMat.color.setHex(0x6a86c8);
      }
    } else if (group) {
      group.visible = false;
      if (cnGroup) cnGroup.visible = false;
    }
    labels.forEach(function (L) {
      L.el.style.display = (mode === 'west') ? L.el.style.display : 'none';
    });
    if (cnGroup && mode !== 'china') cnLabels.forEach(function (L) { L.el.style.display = 'none'; });
  }
  function toggle(on) {
    setMode(on ? lastMode : 'off');
  }

  function refreshLang() {
    if (!built) return;
    labels.forEach(function (L) { L.el.remove(); });
    labels = [];
    cnLabels.forEach(function (L) { L.el.remove(); });
    cnLabels = [];
    syLabels.forEach(function (L) { L.el.remove(); });
    syLabels = [];
    if (cnGroup) { scene.remove(cnGroup); cnGroup = null; }
    if (syGroup) { scene.remove(syGroup); syGroup = null; }
    scene.remove(group);
    built = false;
    build();
    setMode(state.constMode || 'off');
  }

  return { toggle: toggle, setMode: setMode, update: update, highlight: highlight, refreshLang: refreshLang, showMyth: showMyth, showDeepSky: showDeepSky, showMansion: showMansion };
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
