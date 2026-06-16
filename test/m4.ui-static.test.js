import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../public/style.css', import.meta.url), 'utf8');

test('m4 ui: page exposes the required form and result containers', () => {
  assert.match(html, /<form[^>]+id="analyzeForm"/);
  assert.match(html, /<input[^>]+id="phone"/);
  assert.match(html, /id="groups"/); // 進階自訂分組(可選)
  assert.match(html, /id="error"[^>]+hidden/);
  assert.match(html, /id="result"[^>]+hidden/);
  assert.match(html, /id="verdict"/);
  assert.match(html, /id="fiveGridTable"/);
  assert.match(html, /id="extendedTable"/);
  assert.match(html, /id="detailList"/); // 各格詳解(81 數理斷語)
});

test('m4 ui: 自動分組會去掉 10 碼開頭的 0 並切成 3-3-3', () => {
  assert.match(html, /function normalize/);
  assert.match(html, /startsWith\('0'\)/);
  assert.match(html, /\[3,\s*3,\s*3\]/);
});

test('m4 ui: submit handler posts to the analyze API', () => {
  assert.match(html, /addEventListener\('submit'/);
  assert.match(html, /preventDefault\(\)/);
  assert.match(html, /fetch\('\/api\/analyze'/);
  assert.match(html, /method:\s*'POST'/);
  assert.match(html, /'Content-Type':\s*'application\/json'/);
  assert.match(html, /JSON\.stringify\(\{\s*phone,\s*groups\s*\}\)/);
});

test('m4 ui: result rendering includes specified tables, relation fallback, premium mark, and error branch', () => {
  for (const heading of ['格名', '數值', '個位', '五行', '吉凶', '權重', '與總格關係']) {
    assert.match(html, new RegExp(`<th>${heading}</th>`));
  }
  assert.match(html, /★ 雙吉格/);
  assert.match(html, /—（本體）/);
  assert.match(html, /showError\(data\.error \|\|/);
  assert.match(html, /resultEl\.hidden = true/);
  assert.match(html, /errorEl\.hidden = false/);
});

test('m4 ui: stylesheet defines layout, luck color classes and detail/ai styles', () => {
  // 不鎖死精確色碼/尺寸(已重新設計),只確認關鍵 class 仍存在且有定義
  assert.match(css, /body\s*\{[\s\S]*font-family:/);
  assert.match(css, /form\s*\{[\s\S]*flex-direction:\s*column;/);
  assert.match(css, /table\s*\{[\s\S]*width:\s*100%;/);
  assert.match(css, /#verdict\s*\{/);
  assert.match(css, /#error\s*\{[\s\S]*background:/);
  assert.match(css, /\.symbol-good\s*\{[\s\S]*background-color:/);
  assert.match(css, /\.symbol-mid\s*\{[\s\S]*background-color:/);
  assert.match(css, /\.symbol-bad\s*\{[\s\S]*background-color:/);
  // 新版元件
  assert.match(css, /\.detail-item\s*\{/);
  assert.match(css, /\.ai-card\s*\{/);
});
