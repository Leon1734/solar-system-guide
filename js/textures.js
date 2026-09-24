/* ============================================================
 * textures.js —— 程序化生成行星贴图（无外部图片依赖）
 * 全部基于 Canvas 2D + 值噪声，可直接以 file:// 打开运行
 * ============================================================ */
'use strict';

(function () {
  /* ---------- 伪随机与值噪声 ---------- */
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeNoise(seed, gridSize) {
    const rand = mulberry32(seed);
    const grid = new Float32Array(gridSize * gridSize);
    for (let i = 0; i < grid.length; i++) grid[i] = rand();
    const g = gridSize;
    function smooth(t) { return t * t * (3 - 2 * t); }
    function at(ix, iy) {
      ix = ((ix % g) + g) % g; iy = ((iy % g) + g) % g;
      return grid[iy * g + ix];
    }
    return function (x, y) {
      const ix = Math.floor(x), iy = Math.floor(y);
      const fx = smooth(x - ix), fy = smooth(y - iy);
      const a = at(ix, iy), b = at(ix + 1, iy), c = at(ix, iy + 1), d = at(ix + 1, iy + 1);
      return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
    };
  }

  function fbm(noise, x, y, octaves) {
    let sum = 0, amp = 0.5, freq = 1, norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += noise(x * freq, y * freq) * amp;
      norm += amp; amp *= 0.5; freq *= 2;
    }
    return sum / norm;
  }

  function lerp(a, b, t) { return a + (b - a) * t; }
  function mixColor(c1, c2, t) {
    return [Math.round(lerp(c1[0], c2[0], t)), Math.round(lerp(c1[1], c2[1], t)), Math.round(lerp(c1[2], c2[2], t))];
  }
  function css(c) { return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')'; }

  function makeCanvas(w, h) {
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    return cv;
  }

  /* 纬度比例（贴图 y -> -90..90 度），并处理球面收缩 */
  function drawSphereTexture(w, h, perPixel) {
    const cv = makeCanvas(w, h);
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(w, h);
    const d = img.data;
    for (let y = 0; y < h; y++) {
      const lat = (0.5 - y / h) * Math.PI; // -pi/2..pi/2（上为北极）
      const cl = Math.max(0.12, Math.cos(lat)); // 高纬横向压缩
      for (let x = 0; x < w; x++) {
        const lon = (x / w) * Math.PI * 2;
        const rgba = perPixel(lon, lat, cl, x, y);
        const i = (y * w + x) * 4;
        d[i] = rgba[0]; d[i + 1] = rgba[1]; d[i + 2] = rgba[2];
        d[i + 3] = rgba.length > 3 ? rgba[3] : 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return cv;
  }

  /* ---------- 各天体贴图 ---------- */

  function sunTexture() {
    const n1 = makeNoise(101, 64), n2 = makeNoise(202, 64);
    const cv = drawSphereTexture(1024, 512, function (lon, lat, cl) {
      const u = lon / (Math.PI * 2) * 40, v = lat / Math.PI * 20;
      let gran = fbm(n1, u * cl, v, 4);            // 米粒组织
      const cell = fbm(n2, u * cl * 2.4, v * 2.4, 3);
      gran = gran * 0.75 + cell * 0.25;
      // 偶发暗斑（太阳黑子感）
      let spot = 0;
      if (cell < 0.3 && fbm(n2, u * cl * 0.8 + 5, v * 0.8, 2) > 0.62) spot = (0.3 - cell) * 1.6;
      let r = lerp(255, 255, gran), g = lerp(200, 244, gran), b = lerp(60, 170, gran);
      r -= spot * 210; g -= spot * 230; b -= spot * 210;
      // 两极略暗
      const pole = 1 - 0.18 * Math.pow(Math.abs(lat) / (Math.PI / 2), 2);
      return [r * pole, g * pole, b * pole];
    });
    return cv;
  }

  function rockyTexture(seed, base, dark, light, craterCount, opts) {
    opts = opts || {};
    const n1 = makeNoise(seed, 64), n2 = makeNoise(seed + 7, 64);
    const rand = mulberry32(seed + 13);
    const cv = drawSphereTexture(1024, 512, function (lon, lat, cl) {
      const u = lon / (Math.PI * 2) * 26, v = lat / Math.PI * 13;
      let f = fbm(n1, u * cl, v, 5);
      f = f * 0.7 + fbm(n2, u * cl * 3, v * 3, 4) * 0.3;
      const shade = Math.min(1, Math.max(0, (f - 0.3) / 0.4));
      let c = mixColor(dark, light, shade);
      if (opts.poleColor) {
        const pl = Math.abs(lat) / (Math.PI / 2);
        const edge = 0.82 + 0.06 * fbm(n2, u * cl, v, 3);
        if (pl > edge) c = mixColor(c, opts.poleColor, Math.min(1, (pl - edge) / 0.06));
      }
      return c;
    });
    // 陨石坑
    const ctx = cv.getContext('2d');
    for (let i = 0; i < craterCount; i++) {
      const x = rand() * 1024, y = 40 + rand() * 432;
      const r = 2 + Math.pow(rand(), 2.2) * 22;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fill();
      ctx.beginPath(); ctx.arc(x - r * 0.18, y - r * 0.18, r * 0.85, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.fill();
    }
    return cv;
  }

  function venusTexture() {
    const n1 = makeNoise(303, 64), n2 = makeNoise(404, 64);
    return drawSphereTexture(1024, 512, function (lon, lat, cl) {
      const u = lon / (Math.PI * 2) * 10, v = lat / Math.PI * 10;
      const swirl = fbm(n1, u * cl * 1.6 + fbm(n2, u * cl, v * 1.4, 3) * 2.2, v * 3.2, 4);
      const c = mixColor([176, 138, 82], [246, 226, 176], Math.min(1, swirl * 1.35));
      return c;
    });
  }

  function earthTexture() {
    const n1 = makeNoise(505, 64), n2 = makeNoise(606, 64), n3 = makeNoise(707, 64);
    return drawSphereTexture(1024, 512, function (lon, lat, cl) {
      const u = lon / (Math.PI * 2) * 18, v = lat / Math.PI * 9;
      const cont = fbm(n1, u * cl, v, 6);
      const detail = fbm(n2, u * cl * 4, v * 4, 4);
      const pl = Math.abs(lat) / (Math.PI / 2);
      const iceEdge = 0.86 + 0.05 * fbm(n3, u * cl, v, 3);
      let c;
      if (cont > 0.545) { // 陆地
        const h = (cont - 0.545) / 0.2;
        let land = mixColor([46, 104, 52], [140, 126, 78], Math.min(1, h * 1.4 + detail * 0.35));
        if (cont > 0.68) land = mixColor(land, [168, 156, 120], (cont - 0.68) / 0.12);
        c = land;
      } else { // 海洋
        const deep = (0.545 - cont) / 0.25;
        c = mixColor([30, 96, 158], [10, 36, 88], Math.min(1, deep * 1.2 + detail * 0.2));
      }
      if (pl > iceEdge) c = mixColor(c, [235, 242, 248], Math.min(1, (pl - iceEdge) / 0.05));
      return c;
    });
  }

  function earthCloudTexture() {
    const n1 = makeNoise(808, 64);
    return drawSphereTexture(1024, 512, function (lon, lat, cl) {
      const u = lon / (Math.PI * 2) * 14, v = lat / Math.PI * 14;
      const f = fbm(n1, u * cl, v, 5);
      const a = Math.max(0, (f - 0.52) / 0.48);
      return [255, 255, 255, Math.round(Math.pow(a, 1.4) * 205)];
    });
  }

  function bandTexture(seed, palette, bandFreq, turb, spot) {
    // palette: [ [stop, color], ... ]，spot: {x, y, rx, ry, color}
    const n1 = makeNoise(seed, 64), n2 = makeNoise(seed + 99, 64);
    const cv = drawSphereTexture(1024, 512, function (lon, lat, cl) {
      const u = lon / (Math.PI * 2), v = lat / Math.PI; // 0..1
      const warp = (fbm(n1, u * 6 * cl, v * 22, 4) - 0.5) * turb;
      const t = Math.min(1, Math.max(0, v + warp));
      // 在色带里插值
      let c = palette[0][1];
      for (let i = 0; i < palette.length - 1; i++) {
        if (t >= palette[i][0] && t <= palette[i + 1][0]) {
          const k = (t - palette[i][0]) / (palette[i + 1][0] - palette[i][0]);
          c = mixColor(palette[i][1], palette[i + 1][1], k);
          break;
        }
      }
      const grain = fbm(n2, u * 30 * cl, v * 60, 3);
      c = mixColor(c, [255, 250, 235], (grain - 0.5) * 0.25 + 0.12);
      if (spot) {
        const dx = (u - spot.x), dy = (v - spot.y);
        const dd = (dx * dx) / (spot.rx * spot.rx) + (dy * dy) / (spot.ry * spot.ry);
        if (dd < 1) {
          const k = 1 - dd;
          c = mixColor(c, spot.color, Math.min(1, k * 1.6));
          if (dd > 0.55) c = mixColor(c, [235, 225, 205], (dd - 0.55) * 0.9); // 边缘亮环
        }
      }
      return c;
    });
    return cv;
  }

  function ringTexture() {
    const w = 1024, h = 32;
    const cv = makeCanvas(w, h);
    const ctx = cv.getContext('2d');
    const n = makeNoise(909, 128);
    for (let x = 0; x < w; x++) {
      const t = x / w;
      let alpha;
      if (t < 0.16) alpha = 0.10 + t * 0.9;              // C 环：稀薄
      else if (t < 0.58) alpha = 0.85 + n(t * 26, 0.5) * 0.15;   // B 环：明亮
      else if (t < 0.63) alpha = 0.06;                    // 卡西尼缝
      else if (t < 0.88) alpha = 0.62 + n(t * 22, 1.5) * 0.2;    // A 环
      else if (t < 0.895) alpha = 0.08;                   // 恩克缝
      else if (t < 0.97) alpha = 0.5;
      else alpha = Math.max(0, 0.5 * (1 - (t - 0.97) / 0.03));
      const v = n(t * 40, 3.3);
      const col = mixColor([150, 138, 116], [238, 228, 206], v);
      ctx.fillStyle = 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',' + alpha.toFixed(3) + ')';
      ctx.fillRect(x, 0, 1, h);
    }
    return cv;
  }

  function uranusRingTexture() {
    const w = 256, h = 8;
    const cv = makeCanvas(w, h);
    const ctx = cv.getContext('2d');
    for (let x = 0; x < w; x++) {
      const t = x / w;
      let alpha = 0;
      if (t > 0.62 && t < 0.68) alpha = 0.30;
      if (t > 0.82 && t < 0.88) alpha = 0.42;
      if (t > 0.94 && t < 0.99) alpha = 0.55;
      ctx.fillStyle = 'rgba(190,205,212,' + alpha + ')';
      ctx.fillRect(x, 0, 1, h);
    }
    return cv;
  }

  /* ---------- 通用小图 ---------- */

  function radialGlowTexture(size, stops) {
    const cv = makeCanvas(size, size);
    const ctx = cv.getContext('2d');
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    stops.forEach(function (s) { g.addColorStop(s[0], s[1]); });
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    return cv;
  }

  function ringHighlightTexture(size) {
    const cv = makeCanvas(size, size);
    const ctx = cv.getContext('2d');
    ctx.strokeStyle = 'rgba(120,220,255,0.95)';
    ctx.lineWidth = size * 0.035;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * 0.44, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(120,220,255,0.35)';
    ctx.lineWidth = size * 0.012;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * 0.48, 0, Math.PI * 2);
    ctx.stroke();
    return cv;
  }

  /* ---------- v1.1 新增：矮行星 / 大卫星 / 彗核 ---------- */

  function plutoTexture() {
    const n1 = makeNoise(88, 64), n2 = makeNoise(89, 64);
    const cv = drawSphereTexture(512, 256, function (lon, lat, cl) {
      const u = lon / (Math.PI * 2), v = lat / Math.PI + 0.5; // 0..1（下极到上极）
      const tu = fbm(n1, u * 8 * cl, v * 4, 4);
      let c = mixColor([122, 96, 74], [222, 202, 176], tu);
      // 心形平原（汤博区）：中心 (lon 180°, lat -20°) 的大亮区
      let du = Math.abs(u - 0.5); du = Math.min(du, 1 - du);
      const dv = v - 0.39;
      const heart = (du * du) / (0.115 * 0.115) + (dv * dv) / (0.16 * 0.16);
      if (heart < 1) c = mixColor(c, [240, 228, 208], (1 - heart) * 0.9);
      // 赤道暗斑（克苏鲁 Maculae）
      if (Math.abs(dv - 0.02) < 0.06 && du < 0.30 && fbm(n2, u * 10 * cl, v * 10, 3) > 0.42) {
        c = mixColor(c, [74, 48, 40], 0.55);
      }
      return c;
    });
    const ctx = cv.getContext('2d');
    for (let i = 0; i < 18; i++) { // 稀疏陨石坑
      const x = (i * 137.5) % 512, y = 40 + ((i * 73.3) % 176), r = 1.5 + (i % 3);
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fill();
    }
    return cv;
  }

  function ceresTexture() {
    const cv = rockyTexture(99, 0, [86, 84, 82], [188, 186, 182], 70, {});
    const ctx = cv.getContext('2d'); // 奥卡托亮斑
    ctx.fillStyle = 'rgba(255,255,250,0.95)';
    ctx.beginPath(); ctx.arc(300, 118, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(312, 112, 2.2, 0, Math.PI * 2); ctx.fill();
    return cv;
  }

  function erisTexture() {
    return rockyTexture(111, 0, [150, 150, 158], [242, 242, 248], 10, {});
  }

  function ioTexture() {
    const n1 = makeNoise(123, 64);
    const cv = drawSphereTexture(256, 128, function (lon, lat, cl) {
      const u = lon / (Math.PI * 2) * 12, v = lat / Math.PI * 6;
      const f = fbm(n1, u * cl, v, 4);
      let c = mixColor([196, 156, 44], [246, 236, 150], f);
      if (fbm(n1, u * cl * 1.8 + 9, v * 1.8, 3) > 0.66) c = mixColor(c, [190, 84, 40], 0.6); // 火山区
      return c;
    });
    const ctx = cv.getContext('2d');
    for (let i = 0; i < 26; i++) { // 火山黑点
      const x = (i * 97.7) % 256, y = 18 + ((i * 41.3) % 92), r = 1 + (i % 4) * 0.8;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(40,20,10,0.8)'; ctx.fill();
      ctx.beginPath(); ctx.arc(x, y, r + 1.4, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(200,60,20,0.5)'; ctx.stroke();
    }
    return cv;
  }

  function europaTexture() {
    const nE = makeNoise(131, 64); // 提到循环外：避免每像素重建噪声表
    const cv = drawSphereTexture(256, 128, function (lon, lat, cl) {
      const u = lon / (Math.PI * 2) * 8, v = lat / Math.PI * 4;
      const f = fbm(nE, u * cl, v, 4);
      return mixColor([214, 202, 186], [246, 242, 236], f);
    });
    const ctx = cv.getContext('2d'); // 冰面裂纹
    const rand = mulberry32(7);
    ctx.strokeStyle = 'rgba(150,90,50,0.55)';
    for (let i = 0; i < 34; i++) {
      ctx.lineWidth = 0.5 + rand() * 1.4;
      ctx.beginPath();
      let x = rand() * 256, y = rand() * 128;
      ctx.moveTo(x, y);
      for (let k = 0; k < 5; k++) { x += (rand() - 0.5) * 70; y += (rand() - 0.5) * 46; ctx.lineTo(x, y); }
      ctx.stroke();
    }
    return cv;
  }

  function ganymedeTexture() {
    const cv = rockyTexture(141, 0, [104, 96, 88], [198, 190, 180], 36, {});
    const ctx = cv.getContext('2d'); // 浅色沟槽地形
    const rand = mulberry32(17);
    ctx.strokeStyle = 'rgba(220,214,205,0.4)';
    for (let i = 0; i < 20; i++) {
      ctx.lineWidth = 1 + rand() * 3;
      ctx.beginPath();
      let x = rand() * 512, y = rand() * 256;
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rand() - 0.5) * 160, y + (rand() - 0.5) * 80);
      ctx.stroke();
    }
    return cv;
  }

  function callistoTexture() {
    return rockyTexture(151, 0, [70, 66, 62], [168, 160, 152], 95, {});
  }

  function titanTexture() {
    const n1 = makeNoise(161, 64);
    return drawSphereTexture(256, 128, function (lon, lat, cl) {
      const u = lon / (Math.PI * 2) * 6, v = lat / Math.PI * 3;
      const f = fbm(n1, u * cl, v, 3);
      return mixColor([204, 128, 48], [242, 186, 96], f * 0.85 + 0.1); // 浓密橙雾
    });
  }

  function halleyNucleusTexture() {
    return rockyTexture(171, 0, [42, 42, 46], [110, 110, 118], 22, {});
  }

  function milkyHazeTexture() {
    // 柔光团：径向渐变四向淡出（无硬边），叠加少量柔和尘埃暗斑
    const size = 256;
    const cv = makeCanvas(size, size);
    const ctx = cv.getContext('2d');
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(205,218,248,0.9)');
    g.addColorStop(0.35, 'rgba(180,198,240,0.42)');
    g.addColorStop(0.7, 'rgba(150,170,220,0.10)');
    g.addColorStop(1, 'rgba(140,160,220,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    // 尘埃暗隙：小而软的径向暗斑（同样四向淡出，避免规则形状）
    const rand = mulberry32(31);
    ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 9; i++) {
      const a = rand() * Math.PI * 2;
      const d = rand() * size * 0.24;
      const x = size / 2 + Math.cos(a) * d;
      const y = size / 2 + Math.sin(a) * d * 0.55;
      const r = size * 0.04 + rand() * size * 0.09;
      const gd = ctx.createRadialGradient(x, y, 0, x, y, r);
      gd.addColorStop(0, 'rgba(0,0,0,0.30)');
      gd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gd;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    return cv;
  }

  /* ---------- 导出 ---------- */

  window.SolarTextures = {
    build: function () {
      return {
        sun: sunTexture(),
        mercury: rockyTexture(11, 0, [92, 84, 76], [188, 174, 156], 90, {}),
        venus: venusTexture(),
        earth: earthTexture(),
        earthClouds: earthCloudTexture(),
        moon: rockyTexture(77, 0, [96, 96, 98], [200, 200, 202], 110, {}),
        mars: rockyTexture(22, 0, [110, 54, 34], [205, 118, 70], 60, { poleColor: [240, 238, 232] }),
        jupiter: bandTexture(33, [
          [0.00, [176, 158, 138]], [0.18, [206, 178, 140]], [0.30, [150, 112, 84]],
          [0.42, [224, 200, 168]], [0.52, [168, 126, 92]], [0.62, [228, 208, 180]],
          [0.75, [188, 152, 116]], [0.88, [204, 182, 152]], [1.00, [168, 152, 134]]
        ], 0, 0.16, { x: 0.30, y: 0.66, rx: 0.055, ry: 0.045, color: [188, 88, 58] }),
        saturn: bandTexture(44, [
          [0.00, [196, 176, 138]], [0.20, [226, 206, 164]], [0.38, [210, 188, 148]],
          [0.50, [232, 214, 176]], [0.62, [214, 192, 150]], [0.78, [226, 208, 168]],
          [1.00, [188, 168, 130]]
        ], 0, 0.10, null),
        uranus: bandTexture(55, [
          [0.00, [140, 190, 196]], [0.30, [158, 212, 218]], [0.55, [150, 202, 210]],
          [0.80, [166, 216, 222]], [1.00, [148, 196, 202]]
        ], 0, 0.05, null),
        neptune: bandTexture(66, [
          [0.00, [42, 78, 178]], [0.25, [58, 100, 204]], [0.45, [44, 82, 186]],
          [0.60, [64, 108, 212]], [0.80, [48, 86, 188]], [1.00, [40, 74, 172]]
        ], 0, 0.08, { x: 0.68, y: 0.42, rx: 0.045, ry: 0.035, color: [22, 44, 110] }),
        ringSaturn: ringTexture(),
        ringUranus: uranusRingTexture(),
        glowSun: radialGlowTexture(256, [
          [0.0, 'rgba(255,240,190,1)'], [0.18, 'rgba(255,214,120,0.85)'],
          [0.42, 'rgba(255,150,40,0.32)'], [1.0, 'rgba(255,120,20,0)']
        ]),
        glowSoft: radialGlowTexture(128, [
          [0.0, 'rgba(255,255,255,1)'], [0.4, 'rgba(255,255,255,0.5)'], [1.0, 'rgba(255,255,255,0)']
        ]),
        highlight: ringHighlightTexture(128),
        pluto: plutoTexture(),
        ceres: ceresTexture(),
        eris: erisTexture(),
        io: ioTexture(),
        europa: europaTexture(),
        ganymede: ganymedeTexture(),
        callisto: callistoTexture(),
        titan: titanTexture(),
        halleyNucleus: halleyNucleusTexture(),
        milkyHaze: milkyHazeTexture()
      };
    }
  };
})();
