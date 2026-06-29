import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { extractFromHtml, extractFromText } from './parser.js';
import { fetchViaBrowser } from './browser.js';
import { fetchCht } from './cht.js';
import { fetchFetEcare } from './fetEcare.js';
import { checkRobots, sleep } from './politeness.js';

const USER_AGENT = 'gonghao-numbers-crawler/1.0 (educational; contact: see package.json)';

const configDir = join(dirname(fileURLToPath(import.meta.url)), '../../config');

export async function fetchCandidates(source) {
  if (source.type === 'text') {
    return extractFromText(source.content ?? '');
  }

  // 內建靜態號碼(把本機抓好的清單隨程式部署,線上免瀏覽器/帳密即可用)
  if (source.type === 'static') {
    const safe = String(source.file ?? '').replace(/[^a-zA-Z0-9._一-鿿-]/g, '');
    if (!safe) throw new Error('static 來源缺少 file');
    const raw = await readFile(join(configDir, safe), 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : data.candidates ?? [];
  }

  if (source.type === 'url') {
    await checkRobots(source.url);
    await sleep(source.delayMs ?? 2000);
    const response = await fetch(source.url, {
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': USER_AGENT },
    });
    if (!response.ok) {
      throw new Error(`fetch failed: HTTP ${response.status}`);
    }
    const html = await response.text();
    return extractFromHtml(html, source.selector ?? '');
  }

  if (source.type === 'browser') {
    // 中華電信:有真實 API,直接 fetch(免瀏覽器)
    if (source.cht) {
      return fetchCht(source);
    }
    // 遠傳 ecare 預約門號:需登入,無頭瀏覽器登入後逐前綴抓
    if (source.fet) {
      return fetchFetEcare(source);
    }
    // 其他 JS 動態網站:用無頭瀏覽器渲染後抓號
    await sleep(source.delayMs ?? 1000);
    return fetchViaBrowser(source);
  }

  throw new Error('unknown source type');
}
