import { extractAllPhones } from './parser.js';

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

async function loadChromium() {
  try {
    const { chromium } = await import('playwright');
    return chromium;
  } catch {
    throw new Error(
      'browser 來源需要 Playwright。請先安裝:npm i playwright && npx playwright install chromium',
    );
  }
}

async function runSteps(page, steps) {
  for (const step of steps ?? []) {
    try {
      if (step.click) await page.click(step.click);
      if (step.fill) await page.fill(step.fill.selector, step.fill.value);
      if (step.waitFor) await page.waitForSelector(step.waitFor);
      if (step.waitMs) await page.waitForTimeout(step.waitMs);
    } catch {
      // 單一步驟失敗不致命(選擇器可能因網站改版而異),繼續
    }
  }
}

async function scrape(page, selector) {
  if (selector) await page.waitForSelector(selector).catch(() => {});
  const text = selector
    ? (await page.locator(selector).allInnerTexts()).join('\n')
    : await page.evaluate(() => document.body.innerText);
  return extractAllPhones(text);
}

// 找出「前四碼」下拉(選項值符合 09xx)的所有選項值
async function findPrefixOptions(page, pattern) {
  const re = pattern || '^09\\d\\d$';
  return page.evaluate((reStr) => {
    const rx = new RegExp(reStr);
    for (const sel of document.querySelectorAll('select')) {
      const vals = [...sel.options].map((o) => o.value).filter((v) => rx.test(v));
      if (vals.length >= 2) {
        // 回傳此 select 的識別(name 或產生的索引)與符合的值
        return { name: sel.name || sel.id || '', vals };
      }
    }
    return null;
  }, re);
}

// 遍歷下拉每個前綴 → 送出查詢 → 抓號(CHT 這類「先選前四碼再查」的頁面用)
async function iterateSelectCrawl(page, source) {
  const cfg = source.iterateSelect === true ? {} : source.iterateSelect;
  const found = await findPrefixOptions(page, cfg.optionPattern);
  if (!found || !found.vals.length) {
    // 找不到前綴下拉 → 退回單次抓取
    return scrape(page, source.selector);
  }
  const submitText = cfg.submitText || '確定查詢';
  const waitMs = cfg.waitMs ?? 2500;
  const all = new Set();

  for (const val of found.vals) {
    try {
      // 每個前綴都從乾淨表單開始
      await page.goto(source.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await runSteps(page, source.steps); // 例如關 cookie
      // 選下拉值(用 name 定位該 select)
      const selectLoc = found.name ? page.locator(`select[name="${found.name}"], #${found.name}`).first() : page.locator('select').first();
      await selectLoc.selectOption(val).catch(() => {});
      // 送出:依按鈕文字/value 點擊
      await page
        .getByRole('button', { name: submitText })
        .first()
        .click()
        .catch(async () => {
          await page.locator(`input[type=submit][value*="${submitText}"], button:has-text("${submitText}"), a:has-text("${submitText}")`).first().click().catch(() => {});
        });
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await page.waitForTimeout(waitMs);
      for (const p of await scrape(page, cfg.resultSelector || source.selector)) all.add(p);
    } catch {
      // 單一前綴失敗略過,繼續下一個
    }
  }
  return [...all];
}

// 用無頭瀏覽器渲染 JS 選號頁並抓號。
// source.iterateSelect 存在 → 遍歷前四碼下拉逐一查詢(CHT);否則單次渲染抓取(FET)。
export async function fetchViaBrowser(source) {
  const chromium = await loadChromium();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ userAgent: USER_AGENT });
    page.setDefaultTimeout(20000);

    if (source.iterateSelect) {
      await page.goto(source.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await runSteps(page, source.steps);
      return iterateSelectCrawl(page, source);
    }

    await page.goto(source.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await runSteps(page, source.steps);
    return scrape(page, source.selector);
  } finally {
    await browser.close();
  }
}
