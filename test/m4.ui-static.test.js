import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../public/style.css', import.meta.url), 'utf8');

test('m4 ui: page exposes the required form and result containers', () => {
  assert.match(html, /<form[^>]+id="analyzeForm"/);
  assert.match(html, /<input[^>]+id="phone"[^>]+type="text"[^>]+maxlength="15"[^>]+placeholder="0936102682"[^>]+required/);
  assert.match(html, /<input[^>]+id="groups"[^>]+type="text"[^>]+value="3-3-4"[^>]+pattern="\^\\d\+\(-\\d\+\)\+\$"[^>]+required/);
  assert.match(html, /id="error"[^>]+hidden/);
  assert.match(html, /id="result"[^>]+hidden/);
  assert.match(html, /id="verdict"/);
  assert.match(html, /id="fiveGridTable"/);
  assert.match(html, /id="extendedTable"/);
});

test('m4 ui: submit handler posts parsed groups to the analyze API', () => {
  assert.match(html, /addEventListener\('submit'/);
  assert.match(html, /preventDefault\(\)/);
  assert.match(html, /fetch\('\/api\/analyze'/);
  assert.match(html, /method:\s*'POST'/);
  assert.match(html, /'Content-Type':\s*'application\/json'/);
  assert.match(html, /split\('-'\)/);
  assert.match(html, /Number\(part\.trim\(\)\)/);
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

test('m4 ui: stylesheet defines required layout and luck color classes', () => {
  assert.match(css, /body\s*\{[\s\S]*font-family:\s*sans-serif;[\s\S]*max-width:\s*900px;[\s\S]*margin:\s*2rem auto;[\s\S]*padding:\s*0 1rem;/);
  assert.match(css, /form\s*\{[\s\S]*display:\s*flex;[\s\S]*flex-direction:\s*column;[\s\S]*gap:\s*0\.75rem;[\s\S]*max-width:\s*400px;/);
  assert.match(css, /table\s*\{[\s\S]*border-collapse:\s*collapse;[\s\S]*width:\s*100%;[\s\S]*margin-top:\s*1\.5rem;/);
  assert.match(css, /#verdict\s*\{[\s\S]*padding:\s*1rem;[\s\S]*border-radius:\s*6px;[\s\S]*margin-top:\s*1\.5rem;[\s\S]*font-size:\s*1\.2rem;/);
  assert.match(css, /#error\s*\{[\s\S]*color:\s*#721c24;[\s\S]*background:\s*#f8d7da;[\s\S]*padding:\s*0\.75rem;[\s\S]*border-radius:\s*4px;[\s\S]*margin-top:\s*1rem;/);
  assert.match(css, /\.symbol-good\s*\{[\s\S]*background-color:\s*#d4edda;[\s\S]*color:\s*#155724;/);
  assert.match(css, /\.symbol-mid\s*\{[\s\S]*background-color:\s*#fff3cd;[\s\S]*color:\s*#856404;/);
  assert.match(css, /\.symbol-bad\s*\{[\s\S]*background-color:\s*#f8d7da;[\s\S]*color:\s*#721c24;/);
});
