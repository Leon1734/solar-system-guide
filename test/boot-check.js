/* 引导完整性静态检查：JS 绑定的元素 id 必须存在于 index.html
 * （供 node test/boot-check.js 与 .github/workflows/ci.yml 共用）
 * 动态生成的 id 在 DYNAMIC 白名单中登记 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const DYNAMIC = new Set([
  'quiz-finish', 'tour-wait-bar', 'row-progress', 'row-live', 'row-dist', 'btn-fav-export'
]);
const SKIP_FILES = new Set(['boot.js', 'data.js', 'textures.js', 'sfx.js']);

const missing = [];
fs.readdirSync(path.join(ROOT, 'js')).filter(function (f) {
  return f.endsWith('.js') && !SKIP_FILES.has(f);
}).forEach(function (f) {
  const src = fs.readFileSync(path.join(ROOT, 'js', f), 'utf8');
  const re = /\$\('([\w-]+)'\)/g;
  let m;
  while ((m = re.exec(src))) {
    if (!DYNAMIC.has(m[1]) && html.indexOf('id="' + m[1] + '"') < 0) {
      missing.push(f + ' -> ' + m[1]);
    }
  }
});
if (missing.length) {
  console.error('❌ 缺失 id:', missing.join(', '));
  process.exit(1);
}
console.log('✅ id cross-check clean / 元素 id 交叉核对通过');
