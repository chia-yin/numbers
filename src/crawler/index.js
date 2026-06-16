import { extractFromHtml, extractFromText } from './parser.js';
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

  throw new Error('unknown source type');
}
