import { extractFromHtml, extractFromText } from './parser.js';
import { fetchViaBrowser } from './browser.js';
import { fetchCht } from './cht.js';
import { checkRobots, sleep } from './politeness.js';

const USER_AGENT = 'gonghao-numbers-crawler/1.0 (educational; contact: see package.json)';

export async function fetchCandidates(source) {
  if (source.type === 'text') {
    return extractFromText(source.content ?? '');
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
    // 其他 JS 動態網站:用無頭瀏覽器渲染後抓號
    await sleep(source.delayMs ?? 1000);
    return fetchViaBrowser(source);
  }

  throw new Error('unknown source type');
}
