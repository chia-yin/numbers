import { extractAllPhones } from './parser.js';

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// 用無頭瀏覽器(Playwright)把 JS 網站實際跑起來,執行可選的互動步驟,
// 再從渲染後的畫面抓出所有手機號碼。適合 FET / CHT 這種動態選號頁。
//
// source 形如:
// {
//   type: 'browser',
//   url: 'https://...',
//   steps: [               // 可選:進入後要做的互動(依序執行)
//     { click: '#accept-cookie' },
//     { fill: { selector: '#area', value: '台北' } },
//     { click: 'button.search' },
//     { waitFor: '.number-list' },
//     { waitMs: 1500 }
//   ],
//   selector: '.number-list',  // 可選:只從這些元素抓文字;省略則抓整頁
//   delayMs: 2000
// }
export async function fetchViaBrowser(source) {
  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    throw new Error(
      'browser 來源需要 Playwright。請先安裝:npm i playwright && npx playwright install chromium',
    );
  }

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ userAgent: USER_AGENT });
    page.setDefaultTimeout(20000);
    await page.goto(source.url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    for (const step of source.steps ?? []) {
      try {
        if (step.click) await page.click(step.click);
        if (step.fill) await page.fill(step.fill.selector, step.fill.value);
        if (step.waitFor) await page.waitForSelector(step.waitFor);
        if (step.waitMs) await page.waitForTimeout(step.waitMs);
      } catch {
        // 單一步驟失敗不致命(選擇器可能因網站改版而異),繼續嘗試後續步驟與抓號
      }
    }

    if (source.selector) {
      await page.waitForSelector(source.selector).catch(() => {});
    }

    const text = source.selector
      ? (await page.locator(source.selector).allInnerTexts()).join('\n')
      : await page.evaluate(() => document.body.innerText);

    return extractAllPhones(text);
  } finally {
    await browser.close();
  }
}
