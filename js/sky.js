/* ============================================================
 * sky.js —— v8.0 今晚天空 · 地平线罗盘
 * 黄道坐标 → 赤道坐标 → 地平坐标（方位角/高度角），
 * 观测地点可选/自定义/定位；含黄道宫、流星雨联动与 CSV 导出
 * ============================================================ */
'use strict';

window.SkyTonight = (function () {
  const $ = function (id) { return document.getElementById(id); };
  let ctx = null, W = 860, H = 330, timer = null;
  const D2R = Math.PI / 180;

  /* ---- 观测地点（v8.0，本地记忆） ---- */
  const obs = { lat: 39.90, lon: 116.40, label: '北京' };
  try {
    const s = JSON.parse(localStorage.getItem('solar_obs_v1') || 'null');
    if (s && isFinite(s.lat) && isFinite(s.lon)) Object.assign(obs, s);
  } catch (e) { }
  function saveObs() { try { localStorage.setItem('solar_obs_v1', JSON.stringify(obs)); } catch (e) { } }

  function t8(path, fb) { return (window.I18N && I18N.t(path)) || fb; }
  function EN() { return window.I18N && I18N.lang === 'en'; }

  /* ---- 地心黄道坐标 ---- */
  const _t1 = { x: 0, y: 0, z: 0 }, _t2 = { x: 0, y: 0, z: 0 };
  function geocentricEcl(p, days) {
    helioPos(p, days, _t1);
    helioPos(PLANETS[2], days, _t2);
    const x = _t1.x - _t2.x, y = _t1.y - _t2.y, z = _t1.z - _t2.z;
    const r = Math.hypot(x, y, z);
    return { lon: Math.atan2(y, x), lat: Math.asin(z / r), dist: r };
  }
  function sunEcl(days) {
    helioPos(PLANETS[2], days, _t2);
    return { lon: Math.atan2(-_t2.y, -_t2.x), lat: 0, dist: Math.hypot(_t2.x, _t2.y, _t2.z) };
  }
  function moonEcl(days) {
    const F = 93.272 + 13.229350 * days;
    return { lon: realMoonLonRad(days), lat: 5.128 * Math.sin(F * D2R) * D2R, dist: 0.00257 };
  }

  /* ---- 黄道 → 赤道 → 地平坐标（v8.0 核心） ---- */
  function eclToHoriz(lon, lat, days) {
    const eps = 23.4393 * D2R;
    const sinB = Math.sin(lat), cosB = Math.cos(lat);
    const sinD = sinB * Math.cos(eps) + cosB * Math.sin(eps) * Math.sin(lon);
    const dec = Math.asin(Math.max(-1, Math.min(1, sinD)));
    const y = Math.sin(lon) * Math.cos(eps) - Math.tan(lat) * Math.sin(eps);
    const x = Math.cos(lon);
    const ra = Math.atan2(y, x);
    let gmst = (280.46061837 + 360.98564736629 * days) % 360;
    if (gmst < 0) gmst += 360;
    let H = (gmst + obs.lon) * D2R - ra;
    H = normAngle(H);
    const phi = obs.lat * D2R;
    const sinAlt = Math.sin(dec) * Math.sin(phi) + Math.cos(dec) * Math.cos(phi) * Math.cos(H);
    const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
    const azY = -Math.cos(dec) * Math.sin(H);
    const azX = Math.sin(dec) * Math.cos(phi) - Math.cos(dec) * Math.sin(phi) * Math.cos(H);
    let az = Math.atan2(azY, azX) / D2R;
    az = (az + 360) % 360;
    return { alt: alt / D2R, az: az, dec: dec / D2R };
  }

  function dir8(az) {
    const zh = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
    const en = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return (EN() ? en : zh)[Math.round((az % 360) / 45) % 8];
  }

  function collectBodies(days) {
    const list = [];
    const s = sunEcl(days), sh = eclToHoriz(s.lon, s.lat, days);
    list.push({ key: 'sun', name: EN() ? 'Sun' : '太阳', color: '#ffd97a', az: sh.az, alt: sh.alt });
    const m = moonEcl(days), mh = eclToHoriz(m.lon, m.lat, days);
    list.push({ key: 'moon', name: EN() ? 'Moon' : '月球', color: '#cfcfcf', az: mh.az, alt: mh.alt });
    ['mercury', 'venus', 'mars', 'jupiter', 'saturn'].forEach(function (k) {
      const p = PLANETS.find(function (q) { return q.key === k; });
      const g = geocentricEcl(p, days), h = eclToHoriz(g.lon, g.lat, days);
      list.push({ key: k, name: EN() ? p.en : p.name, color: '#' + ('00000' + p.color.toString(16)).slice(-6), az: h.az, alt: h.alt });
    });
    return list;
  }

  function verdict(alt) {
    if (alt < 0) return { text: t8('sky.below', '在地平线下'), color: '#8a6a6a', ok: false };
    if (alt < 10) return { text: t8('sky.low', '贴地平线，勉强可见'), color: '#e0c885', ok: true };
    return { text: '✓ ' + t8('sky.visible', '可见'), color: '#9fe8a8', ok: true };
  }

  /* ---- 黄道宫 / CSV 辅助 ---- */
  function elongOf(p, days) {
    const g = geocentricEcl(p, days);
    const s = sunEcl(days);
    let d = g.lon - s.lon;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return { deg: Math.abs(d) / D2R, east: d > 0, dist: g.dist, lon: g.lon };
  }
  function currentRows() {
    const days = SolarApp.days();
    return ['mercury', 'venus', 'mars', 'jupiter', 'saturn'].map(function (key) {
      const p = PLANETS.find(function (q) { return q.key === key; });
      return { p: p, e: elongOf(p, days) };
    });
  }
  function zodiacOf(p, days) {
    const g = geocentricEcl(p, days);
    let lon = g.lon / D2R;
    lon = ((lon % 360) + 360) % 360;
    return ZODIAC_SIGNS[Math.floor(lon / 30)];
  }

  /* ---- 绘制 ---- */
  function draw() {
    if (!ctx) return;
    const days = SolarApp.days();
    const bodies = collectBodies(days);
    const HY = 160, X0 = 34, X1 = W - 34;
    const azX = function (az) { return X0 + (az / 360) * (X1 - X0); };

    ctx.fillStyle = '#02030a';
    ctx.fillRect(0, 0, W, H);
    // 天幕
    const g = ctx.createLinearGradient(0, 16, 0, HY);
    g.addColorStop(0, '#040714');
    g.addColorStop(1, '#0e1834');
    ctx.fillStyle = g;
    ctx.fillRect(0, 16, W, HY - 16);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (let i = 0; i < 80; i++) ctx.fillRect((i * 137.5) % W, 20 + (i * 89.7) % (HY - 26), 1.2, 1.2);
    // 高度角参考线 30/60
    [[30, '30°'], [60, '60°']].forEach(function (p2) {
      const y = HY - p2[0] / 90 * (HY - 30);
      ctx.strokeStyle = 'rgba(140,170,220,0.14)';
      ctx.setLineDash([3, 6]);
      ctx.beginPath(); ctx.moveTo(X0, y); ctx.lineTo(X1, y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#5a6a88'; ctx.font = '10px sans-serif'; ctx.textAlign = 'left';
      ctx.fillText(p2[1], X0 + 3, y - 3);
    });
    // 地面与地平线
    ctx.fillStyle = '#0b0f1a';
    ctx.fillRect(0, HY, W, H - HY);
    ctx.strokeStyle = 'rgba(150,180,230,0.55)';
    ctx.beginPath(); ctx.moveTo(0, HY); ctx.lineTo(W, HY); ctx.stroke();
    // 方位刻度（北 0° 起，顺时针）
    ctx.textAlign = 'center'; ctx.font = '11px sans-serif';
    const DIRS = EN() ? ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] : ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
    for (let a = 0; a < 360; a += 45) {
      const x = azX(a);
      ctx.strokeStyle = 'rgba(140,170,220,0.16)';
      ctx.beginPath(); ctx.moveTo(x, 22); ctx.lineTo(x, HY); ctx.stroke();
      ctx.fillStyle = (a === 0 || a === 180) ? '#cfe0ff' : '#7d8db0';
      ctx.fillText(DIRS[a / 45], x, HY + 15);
    }
    // 天体（太阳辉光先画）
    bodies.forEach(function (b) {
      const x = azX(b.az);
      const below = b.alt < 0;
      const y = below ? HY + 26 + Math.min(1, -b.alt / 90) * 16
        : HY - Math.min(1, b.alt / 90) * (HY - 30);
      const rr = b.key === 'sun' ? 7 : b.key === 'jupiter' ? 5.5 : b.key === 'saturn' ? 5 : 4;
      ctx.globalAlpha = below ? 0.35 : 1;
      if (b.key === 'sun') {
        const sg = ctx.createRadialGradient(x, y, 1, x, y, rr * 4);
        sg.addColorStop(0, '#fff4c2');
        sg.addColorStop(0.5, 'rgba(255,190,80,0.7)');
        sg.addColorStop(1, 'rgba(255,160,40,0)');
        ctx.fillStyle = sg;
        ctx.beginPath(); ctx.arc(x, y, rr * 4, 0, 6.283); ctx.fill();
      } else {
        const pg = ctx.createRadialGradient(x, y, 0, x, y, rr * 2.6);
        pg.addColorStop(0, b.color);
        pg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = pg;
        ctx.beginPath(); ctx.arc(x, y, rr * 2.6, 0, 6.283); ctx.fill();
      }
      ctx.fillStyle = b.color;
      ctx.beginPath(); ctx.arc(x, y, rr, 0, 6.283); ctx.fill();
      ctx.fillStyle = below ? '#7d8db0' : '#dfe6f2';
      ctx.font = '12px sans-serif';
      ctx.fillText(b.name, x, below ? y + rr + 14 : y - rr - 8);
      ctx.globalAlpha = 1;
    });
    // 标题
    ctx.textAlign = 'left';
    ctx.fillStyle = '#cfe0ff'; ctx.font = 'bold 13px sans-serif';
    ctx.fillText(t8('sky.title2', '地平线罗盘 · 模拟时刻真实方位与高度') + ' — ' + obs.label, 24, 30);
    // 数据网格（太阳/月球 + 五大行星）
    const colW = (W - 48) / 4;
    bodies.forEach(function (b, i) {
      const x = 30 + (i % 4) * colW;
      const y = HY + 40 + Math.floor(i / 4) * 40;
      const v = verdict(b.alt);
      ctx.fillStyle = '#dfe6f2'; ctx.font = 'bold 12.5px sans-serif';
      ctx.fillText(b.name + ' · ' + dir8(b.az) + ' ' + Math.abs(b.alt).toFixed(0) + '°', x, y);
      ctx.fillStyle = v.color; ctx.font = '11px sans-serif';
      ctx.fillText(v.text, x, y + 14);
    });
    ctx.fillStyle = '#5a6a88'; ctx.font = '11px sans-serif';
    ctx.fillText(t8('sky.note2', '方位角自正北顺时针 0–360° · 高度角相对地平线 · 拖动时间可看天体升落'), 24, H - 6);

    /* ---- DOM 联动层：黄道宫 / 月相 / 流星雨 / 状态 ---- */
    const zbox = $('sky-zodiac');
    if (zbox) {
      let html = '';
      currentRows().forEach(function (r) {
        const z = zodiacOf(r.p, days);
        const con = CONSTELLATIONS.find(function (c) { return c.n === z; });
        html += '<span class="zz" data-con="' + (con ? con.e : '') + '">' + (EN() ? r.p.en : r.p.name) + ' · ' + z + '</span>';
      });
      try {
        if (window.MoonLab) {
          const mp = MoonLab.phaseInfo();
          html += '<span class="zz zm">🌙 ' + (EN() ? mp.nameEn : mp.name) + ' · ' + (mp.illum * 100).toFixed(0) + '%</span>';
        }
      } catch (e) { }
      zbox.innerHTML = html;
      zbox.querySelectorAll('.zz').forEach(function (sp) {
        sp.addEventListener('click', function () {
          const con = this.dataset.con;
          if (!con) return;
          if (!SolarApp.state.showConst) $('btn-const').click();
          StarMap.highlight(con);
          StarMap.showMyth(con);
        });
      });
    }
    const mbox = $('sky-meteors');
    if (mbox) {
      const date = simDate();
      const doy = Math.floor((date - new Date(Date.UTC(date.getUTCFullYear(), 0, 1))) / 86400000);
      let html = '';
      METEOR_SHOWERS.forEach(function (s) {
        let dd = Math.abs(doy - s.peak); dd = Math.min(dd, 365 - dd);
        if (dd > 6) return;
        const active = dd <= s.window / 2;
        html += '<span class="zz zmk" data-key="' + s.key + '">' + (active ? '✨ ' : '☄️ ') +
          (EN() ? s.en : s.name) + (active ? ' · ZHR ' + s.zhr : '') + ' →</span>';
      });
      const next = METEOR_SHOWERS.reduce(function (a, s) {
        let dd = s.peak - doy; if (dd < 0) dd += 365;
        return (a === null || dd < a.dd) ? { s: s, dd: dd } : a;
      }, null);
      if (next && next.dd <= 45 && html.indexOf(next.s.key) < 0) {
        html += '<span class="zz zmk" data-key="' + next.s.key + '">☄️ ' + (EN() ? next.s.en : next.s.name) +
          ' · ' + (next.dd > 0 ? next.dd + (EN() ? ' d to peak' : ' 天后峰值') : (EN() ? 'peaks today' : '今天峰值')) + ' →</span>';
      }
      if (!html) html = '<span class="zz zm">' + t8('sky.noMeteor', '近期暂无大型流星雨') + '</span>';
      mbox.innerHTML = html;
      mbox.querySelectorAll('.zmk').forEach(function (sp) {
        sp.addEventListener('click', function () {
          const s = METEOR_SHOWERS.find(function (x) { return x.key === this.dataset.key; }.bind(this));
          if (!s) return;
          const now = new Date(Date.UTC(2000, 0, 1, 12) + SolarApp.days() * 86400000);
          const t = Date.UTC(now.getUTCFullYear(), 0, 1) + s.peak * 86400000;
          SolarApp.setDate((t - Date.UTC(2000, 0, 1, 12)) / 86400000);
          document.querySelector('#modal-sky .modal-close').click();
          document.getElementById('btn-meteors').click();
          MeteorLab.select(s.key);
        });
      });
    }
  }

  /* ---- 观测地点 UI ---- */
  function bindObs() {
    const sel = $('obs-preset'), latIn = $('obs-lat'), lonIn = $('obs-lon');
    if (!sel) return;
    sel.innerHTML = '<option value="custom">' + t8('sky.custom', '自定义…') + '</option>' +
      OBSERVATORIES.map(function (o) {
        return '<option value="' + o.key + '">' + (EN() && o.en ? o.en : o.n) + '</option>';
      }).join('');
    function syncInputs() {
      latIn.value = obs.lat.toFixed(1);
      lonIn.value = obs.lon.toFixed(1);
    }
    function matchPreset() {
      const hit = OBSERVATORIES.find(function (o) {
        return Math.abs(o.lat - obs.lat) < 0.05 && Math.abs(o.lon - obs.lon) < 0.05;
      });
      sel.value = hit ? hit.key : 'custom';
    }
    sel.addEventListener('change', function () {
      const o = OBSERVATORIES.find(function (x) { return x.key === this.value; }.bind(this));
      if (o) { obs.lat = o.lat; obs.lon = o.lon; obs.label = o.n; syncInputs(); saveObs(); }
    });
    latIn.addEventListener('input', function () {
      const v = parseFloat(this.value);
      if (isFinite(v)) { obs.lat = v; obs.label = t8('sky.customPlace', '自定义'); matchPreset(); saveObs(); }
    });
    lonIn.addEventListener('input', function () {
      const v = parseFloat(this.value);
      if (isFinite(v)) { obs.lon = v; obs.label = t8('sky.customPlace', '自定义'); matchPreset(); saveObs(); }
    });
    $('btn-obs-loc').addEventListener('click', function () {
      if (!navigator.geolocation) { toast(t8('sky.noGeo', '当前环境不支持定位')); return; }
      navigator.geolocation.getCurrentPosition(function (pos) {
        obs.lat = +pos.coords.latitude.toFixed(2);
        obs.lon = +pos.coords.longitude.toFixed(2);
        obs.label = t8('sky.myPlace', '我的位置');
        syncInputs(); matchPreset(); saveObs();
        toast('📍 ' + t8('sky.gotLoc', '已定位') + ': ' + obs.lat + ', ' + obs.lon);
      }, function () {
        toast(t8('sky.geoDeny', '定位失败或被拒绝——可手动输入经纬度'));
      });
    });
    syncInputs(); matchPreset();
  }

  function start() {
    if (!ctx) {
      const cv = $('sky-canvas');
      ctx = cv.getContext('2d');
      W = cv.width; H = cv.height;
      bindObs();
      // C3: 观测数据 CSV 导出
      $('btn-csv').addEventListener('click', function () {
        const days = SolarApp.days();
        const d = simDate();
        let csv = '\uFEFF' + (EN()
          ? 'date,planet,ecliptic_lon_deg,elongation_deg,geo_dist_AU,zodiac,azimuth_deg,altitude_deg\n'
          : '日期,行星,地心黄经(°),距角(°),地心距离(AU),星座,方位角(°),高度角(°)\n');
        const byKey = {};
        collectBodies(days).forEach(function (b) { byKey[b.key] = b; });
        currentRows().forEach(function (r) {
          const g = geocentricEcl(r.p, days);
          const lon = ((g.lon / D2R) + 360) % 360;
          const h = eclToHoriz(g.lon, g.lat, days);
          csv += [d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate()),
            EN() ? r.p.en : r.p.name, lon.toFixed(2), r.e.deg.toFixed(2), g.dist.toFixed(4), zodiacOf(r.p, days),
            h.az.toFixed(1), h.alt.toFixed(1)
          ].join(',') + '\n';
        });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
        a.download = 'sky-report.csv';
        a.click();
        URL.revokeObjectURL(a.href);
        toast(t8('ui.csvOk', '📄 观测数据已导出为 CSV'));
      });
    }
    if (!timer) {
      if (location.search.indexOf('novx') >= 0) { draw(); return; } // 无头截图：单帧
      timer = setInterval(draw, 1000);
    }
    draw();
  }
  function stop() { if (timer) { clearInterval(timer); timer = null; } }

  setInterval(function () {
    const m = $('modal-sky');
    if (!m) return;
    if (m.classList.contains('hidden')) { if (timer) stop(); }
    else if (!timer) start();
  }, 500);

  return { start: start, stop: stop };
})();
