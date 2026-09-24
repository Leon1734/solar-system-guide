/* ============================================================
 * sky.js —— v5.0 今晚天空
 * 由模拟时刻的真实行星位置计算距角（太阳-地球-行星夹角），
 * 给出可见性预报 + 天空带可视化（黄昏地平线视角）
 * ============================================================ */
'use strict';

window.SkyTonight = (function () {
  const $ = function (id) { return document.getElementById(id); };
  let ctx = null, W = 860, H = 300, timer = null;

  function t8(path, fb) { return (window.I18N && I18N.t(path)) || fb; }

  /* 地心黄经：地球位置 -> 行星地心向量 */
  function geocentricLon(pDays, days) {
    helioPos(pDays, days, _tmp);
    helioPos(PLANETS[2], days, _tmp2); // earth
    return {
      lon: Math.atan2(_tmp.y - _tmp2.y, _tmp.x - _tmp2.x),
      dist: Math.hypot(_tmp.x - _tmp2.x, _tmp.y - _tmp2.y, _tmp.z - _tmp2.z)
    };
  }
  const _tmp = { x: 0, y: 0, z: 0 };
  const _tmp2 = { x: 0, y: 0, z: 0 };

  /* 太阳地心黄经 = 地球日心黄经 + 180° */
  function sunLon(days) {
    helioPos(PLANETS[2], days, _tmp2);
    return Math.atan2(-_tmp2.y, -_tmp2.x);
  }

  function elongation(p, days) {
    const g = geocentricLon(p, days);
    const s = sunLon(days);
    let d = g.lon - s;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return {
      deg: Math.abs(d) * 180 / Math.PI,     // 距角 0..180
      east: d > 0,                           // 东距角=黄昏西天；西距角=黎明东天
      dist: g.dist
    };
  }

  /* 黄道宫判定：地心黄经每 30° 一宫 */
  function zodiacOf(p, days) {
    const g = geocentricLon(p, days);
    let lon = g.lon * 180 / Math.PI;
    lon = ((lon % 360) + 360) % 360;
    return ZODIAC_SIGNS[Math.floor(lon / 30)];
  }

  /* 可见性判定（距角规则，外行星常年可见） */
  function verdict(e, isOuter) {
    if (e.deg < 12) return { text: t8('sky.lost', '淹没在阳光中'), color: '#e08585', ok: false };
    if (!isOuter && e.deg < 22) return { text: t8('sky.low', '贴近地平线，勉强可见'), color: '#e0c885', ok: true };
    return {
      text: (e.east ? t8('sky.evening', '黄昏后 · 西天') : t8('sky.morning', '黎明前 · 东天')) +
        (isOuter ? '' : ' · ' + e.deg.toFixed(0) + '°'),
      color: '#9fe8a8', ok: true
    };
  }

  function currentRows() {
    const days = SolarApp.days();
    const outers = { mars: 1, jupiter: 1, saturn: 1 };
    return ['mercury', 'venus', 'mars', 'jupiter', 'saturn'].map(function (key) {
      const p = PLANETS.find(function (q) { return q.key === key; });
      const e = elongation(p, days);
      const v = verdict(e, !!outers[key]);
      return { p: p, e: e, v: v };
    });
  }

  function draw() {
    if (!ctx) return;
    const rows = currentRows();
    ctx.fillStyle = '#02030a';
    ctx.fillRect(0, 0, W, H);

    /* ---- 上：天空带（站在地平线上的黄昏视角） ---- */
    const bandY = 190;
    // 黄昏渐变天幕
    const g = ctx.createLinearGradient(0, 20, 0, bandY);
    g.addColorStop(0, '#050816');
    g.addColorStop(0.75, '#0d1430');
    g.addColorStop(1, '#3a2418');
    ctx.fillStyle = g;
    ctx.fillRect(0, 20, W, bandY - 20);
    // 星点
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    for (let i = 0; i < 70; i++) {
      ctx.fillRect((i * 137.5) % W, 22 + (i * 53.7) % 120, 1.2, 1.2);
    }
    // 地平线
    ctx.fillStyle = '#111522';
    ctx.fillRect(0, bandY, W, 14);
    ctx.strokeStyle = 'rgba(140,170,220,0.4)';
    ctx.beginPath(); ctx.moveTo(0, bandY); ctx.lineTo(W, bandY); ctx.stroke();
    // 东西标
    ctx.fillStyle = '#8fa0b8'; ctx.font = '12px sans-serif';
    const eastTxt = '← 东 · ' + t8('sky.morningSide', '明晨可见的一侧');
    ctx.fillText(eastTxt, 14, H - 4);
    const westTxt = t8('sky.westSide', '西 · 黄昏可见的一侧') + ' →';
    ctx.fillText(westTxt, W - ctx.measureText(westTxt).width - 14, H - 4);

    // 太阳位于地平线下方中点
    const sunX = W / 2;
    // 落日余晖
    const sg = ctx.createRadialGradient(sunX, bandY + 8, 4, sunX, bandY + 8, 70);
    sg.addColorStop(0, 'rgba(255,180,80,0.55)');
    sg.addColorStop(1, 'rgba(255,180,80,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(sunX - 70, bandY - 60, 140, 70);
    ctx.fillStyle = '#ff9d5c'; ctx.font = '11px sans-serif';
    const sunTxt = '☀ ' + t8('sky.sunBelow', '太阳（地平线下）');
    ctx.fillText(sunTxt, sunX - ctx.measureText(sunTxt).width / 2, bandY + 26);

    rows.forEach(function (r) {
      const col = '#' + ('00000' + r.p.color.toString(16)).slice(-6);
      const rr = r.p.key === 'jupiter' ? 5 : r.p.key === 'saturn' ? 4.5 : 3.2;
      if (r.e.east) {
        // 东距角：黄昏时挂在西天，距角越大越高
        const x = sunX + 40 + (r.e.deg / 180) * (W * 0.44);
        const y = bandY - 12 - Math.min(1, r.e.deg / 46) * 118;
        const pg = ctx.createRadialGradient(x, y, 0, x, y, rr * 3);
        pg.addColorStop(0, col);
        pg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = pg;
        ctx.beginPath(); ctx.arc(x, y, rr * 3, 0, 6.283); ctx.fill();
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(x, y, rr, 0, 6.283); ctx.fill();
        ctx.fillStyle = r.v.ok ? '#dfe6f2' : '#8a6a6a';
        ctx.font = '12px sans-serif';
        ctx.fillText(r.p.name, x - 14, y - 10);
      } else {
        // 西距角：黄昏时不可见（在明晨的东天），画在地平线下作提示
        const x = 40 + (r.e.deg / 180) * (W * 0.40);
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(x, bandY + 30, rr, 0, 6.283); ctx.fill();
        ctx.fillStyle = '#8a97ad';
        ctx.font = '11.5px sans-serif';
        ctx.fillText(r.p.name + '（' + t8('sky.tomorrow', '明晨东天') + '）', x - 20, bandY + 48);
        ctx.globalAlpha = 1;
      }
    });

    /* ---- 下：数据行 ---- */
    let y0 = bandY + 62;
    ctx.font = '13px sans-serif';
    rows.forEach(function (r, i) {
      const x = 40 + (i % 5) * 165;
      ctx.fillStyle = '#93a4c3';
      ctx.fillText(r.p.name, x, y0);
      ctx.fillStyle = r.v.color;
      ctx.font = '12px sans-serif';
      ctx.fillText(r.v.text, x, y0 + 17);
      ctx.font = '13px sans-serif';
    });
    ctx.fillStyle = '#5a6a88'; ctx.font = '11.5px sans-serif';
    const note = t8('sky.note', '距角 = 太阳-地球-行星夹角，由模拟时刻的真实轨道位置计算 · 天王星海王星肉眼不可见故未列出');
    ctx.fillText(note, 40, H - 6);

    /* 黄道宫 / 月相 / 可点条（DOM 层） */
    const zbox = $('sky-zodiac');
    if (zbox) {
      const en = window.I18N && I18N.lang === 'en';
      let html = '';
      rows.forEach(function (r) {
        const z = zodiacOf(r.p, SolarApp.days());
        const con = CONSTELLATIONS.find(function (c) { return c.n === z; });
        html += '<span class="zz" data-con="' + (con ? con.e : '') + '">' + (en ? r.p.en : r.p.name) + ' · ' + z + '</span>';
      });
      try {
        if (window.MoonLab) {
          const mp = MoonLab.phaseInfo();
          html += '<span class="zz zm">' + '🌙 ' + (en ? mp.nameEn : mp.name) + ' · ' + (mp.illum * 100).toFixed(0) + '%</span>';
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
      /* v7.0：流星雨区块（活跃或最近的一场） */
      const mbox = $('sky-meteors');
      if (mbox) {
        const d = SolarApp.days();
        const date = simDate();
        const doy = Math.floor((date - new Date(Date.UTC(date.getUTCFullYear(), 0, 1))) / 86400000);
        const en = window.I18N && I18N.lang === 'en';
        let html = '';
        METEOR_SHOWERS.forEach(function (s) {
          let dd = Math.abs(doy - s.peak); dd = Math.min(dd, 365 - dd);
          if (dd > 6) return;
          const active = dd <= s.window / 2;
          html += '<span class="zz zmk" data-key="' + s.key + '">' + (active ? '✨ ' : '☄️ ') +
            (en ? s.en : s.name) + (active ? ' · ZHR ' + s.zhr : '') + ' →</span>';
        });
        const next = METEOR_SHOWERS.reduce(function (a, s) {
          let dd = s.peak - doy; if (dd < 0) dd += 365;
          return (a === null || dd < a.dd) ? { s: s, dd: dd } : a;
        }, null);
        if (next && next.dd <= 45 && html.indexOf(next.s.key) < 0) {
          html += '<span class="zz zmk" data-key="' + next.s.key + '">☄️ ' + (en ? next.s.en : next.s.name) +
            ' · ' + (next.dd > 0 ? next.dd + (en ? ' d to peak' : ' 天后峰值') : (en ? 'peaks today' : '今天峰值')) + ' →</span>';
        }
        if (!html) html = '<span class="zz zm">' + t8('sky.noMeteor', '近期暂无大型流星雨') + '</span>';
        mbox.innerHTML = html;
        mbox.querySelectorAll('.zmk').forEach(function (sp) {
          sp.addEventListener('click', function () {
            const s = METEOR_SHOWERS.find(function (x) { return x.key === this.dataset.key; }.bind(this));
            if (!s) return;
            // 跳到今年峰值日（年首 + peak 天）
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
  }

  function start() {
    if (!ctx) {
      const cv = $('sky-canvas');
      ctx = cv.getContext('2d');
      W = cv.width; H = cv.height;
      // C3: 观测数据 CSV 导出
      $('btn-csv').addEventListener('click', function () {
        const en = window.I18N && I18N.lang === 'en';
        const d = simDate();
        let csv = '\uFEFF' + (en ? 'date,planet,ecliptic_lon_deg,elongation_deg,geo_dist_AU,zodiac\n' : '日期,行星,地心黄经(°),距角(°),地心距离(AU),星座\n');
        currentRows().forEach(function (r) {
          const g = geocentricLon(r.p, SolarApp.days());
          const lon = ((g.lon * 180 / Math.PI) + 360) % 360;
          csv += [d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate()),
            en ? r.p.en : r.p.name, lon.toFixed(2), r.e.deg.toFixed(2), g.dist.toFixed(4), zodiacOf(r.p, SolarApp.days())
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
    if (!timer) timer = setInterval(draw, 1000);
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
