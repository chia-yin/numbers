import { extractAllPhones } from './parser.js';
import { sleep } from './politeness.js';

const BASE = 'https://bms.cht.com.tw/mbms/NewApply';
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// 取得 session cookie + 前四碼下拉清單(option value 為 09xx)
async function bootstrap() {
  const res = await fetch(`${BASE}/findAvailable.jsp`, { headers: { 'user-agent': UA } });
  const body = await res.text();
  const setCookie = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  const jar = setCookie.map((c) => c.split(';')[0]).join('; ');
  const prefixes = [...new Set([...body.matchAll(/(?:value=)["']?(09\d\d)["']?/g)].map((m) => m[1]))];
  return { jar, prefixes };
}

// 中華電信選號:直接打 findAvailableProc.jsp(免瀏覽器),
// 遍歷每個前四碼,並翻頁抓完該前綴所有可選號碼。
export async function fetchCht(source) {
  const cfg = source.cht && typeof source.cht === 'object' ? source.cht : {};
  const { jar, prefixes: discovered } = await bootstrap();
  const prefixes = cfg.prefixes && cfg.prefixes.length ? cfg.prefixes : discovered;
  if (!prefixes.length) {
    throw new Error('找不到前四碼清單(網站結構可能改版)');
  }

  const maxPages = cfg.maxPages ?? 25;
  const selfee = cfg.selfee ?? '480';
  const delayMs = source.delayMs ?? 600;
  const headers = {
    'user-agent': UA,
    cookie: jar,
    'content-type': 'application/x-www-form-urlencoded',
    referer: `${BASE}/findAvailable.jsp`,
  };

  const all = new Set();

  for (const head4G of prefixes) {
    // 第 1 頁:送出查詢
    const body =
      `servicetype=K&head4G=${head4G}&search_type=all&rb_search_type=all&tel=&selfee=${selfee}&x=1&y=1`;
    try {
      const res = await fetch(`${BASE}/findAvailableProc.jsp`, { method: 'POST', headers, body });
      for (const p of extractAllPhones(await res.text())) all.add(p);
    } catch {
      continue; // 此前綴失敗,換下一個
    }

    // 後續分頁
    for (let pageid = 2; pageid <= maxPages; pageid++) {
      await sleep(delayMs);
      let found;
      try {
        const res = await fetch(`${BASE}/findAvailableRst.jsp?pageid=${pageid}`, { headers });
        found = extractAllPhones(await res.text());
      } catch {
        break;
      }
      if (!found.length) break;
      const before = all.size;
      for (const p of found) all.add(p);
      if (all.size === before) break; // 沒有新號碼 → 此前綴抓完
    }
    await sleep(delayMs);
  }

  return [...all];
}
