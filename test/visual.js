/* ============================================================
 * visual.js —— v4.0 视觉回归基线（零依赖，Edge 无头截图画廊）
 * 用法：
 *   node test/visual.js            # 生成 test/shots/ 画廊
 *   node test/visual.js compare    # 与 test/baseline/ 逐张比较（字节大小偏差 >25% 报警）
 * 前提：本地静态服务器运行于 8123 端口（见 README）
 * ============================================================ */
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE = 'http://127.0.0.1:8123/index.html';
const OUT = path.join(__dirname, 'shots');
const BASELINE = path.join(__dirname, 'baseline');

/* 场景清单：URL 参数驱动（freeze 固定时刻保证可复现）
 * meteors/starlife 通过 novx=1 单帧绘制（不启动 interval），已补回。 */
const SCENES = [
  { name: 'overview', url: '?freeze=1&date=2026-01-01' },
  { name: 'real-mode', url: '?freeze=1&date=2026-01-01&mode=real' },
  { name: 'hz-ring', url: '?freeze=1&date=2026-06-01&hz=1' },
  { name: 'probes', url: '?freeze=1&date=1990-01-01' },
  { name: 'exo-trappist', url: '?sys=trappist1&freeze=1' },
  { name: 'transit-lab', url: '?view=transit&freeze=1&novx=1' },
  { name: 'meteors', url: '?view=meteors&freeze=1&novx=1' },
  { name: 'starlife', url: '?view=starlife&freeze=1&novx=1' },
  { name: 'eclipse', url: '?view=eclipse&freeze=1' },
  { name: 'en-lang', url: '?freeze=1&lang=en&date=2026-01-01' }
];

function shoot(scene, outPath) {
  const tmpProfile = fs.mkdtempSync(path.join(require('os').tmpdir(), 'edge-vis-'));
  try {
    execFileSync(EDGE, [
      '--headless=new', '--disable-gpu-sandbox', '--no-first-run',
      '--user-data-dir=' + tmpProfile,
      '--window-size=1280,800',
      '--screenshot=' + outPath.replace(/\\/g, '/'),
      '--virtual-time-budget=12000',
      BASE + scene.url
    ], { timeout: 90000, stdio: 'ignore' });
  } finally {
    try { fs.rmSync(tmpProfile, { recursive: true, force: true }); } catch (e) { }
  }
}

function run() {
  const compare = process.argv[2] === 'compare';
  fs.mkdirSync(OUT, { recursive: true });
  if (compare) fs.mkdirSync(BASELINE, { recursive: true });
  let fails = 0;
  SCENES.forEach(function (s) {
    const out = path.join(OUT, s.name + '.png');
    process.stdout.write('📸 ' + s.name + ' … ');
    try {
      shoot(s, out);
      const size = fs.statSync(out).size;
      if (size < 8000) { console.log('⚠️ 画面过小(' + size + 'B)，可能未渲染'); fails++; return; }
      if (compare) {
        const base = path.join(BASELINE, s.name + '.png');
        if (!fs.existsSync(base)) {
          fs.copyFileSync(out, base);
          console.log('基线已建立 (' + Math.round(size / 1024) + 'KB)');
        } else {
          const bSize = fs.statSync(base).size;
          const dev = Math.abs(size - bSize) / bSize;
          if (dev > 0.25) { console.log('❌ 与基线偏差 ' + (dev * 100).toFixed(0) + '%（' + Math.round(bSize / 1024) + '→' + Math.round(size / 1024) + 'KB），请人工核对'); fails++; }
          else console.log('✅ 偏差 ' + (dev * 100).toFixed(1) + '%');
        }
      } else {
        console.log(Math.round(size / 1024) + 'KB');
      }
    } catch (e) {
      console.log('❌ ' + e.message.split('\n')[0]);
      fails++;
    }
  });
  console.log(compare ? (fails ? '❌ ' + fails + ' 张异常' : '✅ 全部通过') : '画廊完成 → test/shots/');
  process.exit(fails ? 1 : 0);
}
run();
