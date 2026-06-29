// 遠傳 ecare 預約門號爬蟲(需登入)
// 流程:心生活兩段式登入(門號→密碼)→ 進 bookingMsisdn → 逐前綴選號查詢,
// 攔截 queryAvailableMsisdn API 回應收號。帳密由環境變數 FET_ACCOUNT / FET_PASSWORD 提供。
// 注意:登入第二步可能出現圖形驗證碼(風控時),屆時自動登入會失敗並提示改用手動。

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const BOOKING_URL = 'https://ecare.fetnet.net/DigService/help-center/bookingMsisdn';
const API_MARK = 'queryAvailableMsisdn';

async function loadChromium() {
  try {
    const { chromium } = await import('playwright');
    return chromium;
  } catch {
    throw new Error('FET ecare 需要 Playwright:npm i playwright && npx playwright install chromium');
  }
}

async function login(page, account, password) {
  await page.goto(BOOKING_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(3500);
  if (!page.url().includes('login')) return; // 已是登入態(帶 storageState 時)
  // 第一步:門號
  await page.locator('input[type=text]').first().fill(account);
  await page.locator('#login_btn, button[type=submit]').first().click();
  await page.waitForTimeout(4000);
  // 第二步:密碼(若出現驗證碼則無法自動)
  await page.locator('#password-field, input[type=password]').first().fill(password);
  // 偵測驗證碼欄位是否為必填/可見
  const captcha = page.locator('input[placeholder*="驗證碼"]');
  if (await captcha.count() && (await captcha.first().isVisible().catch(() => false))) {
    const required = await captcha.first().evaluate((el) => el.required).catch(() => false);
    if (required) throw new Error('FET 登入出現必填圖形驗證碼(風控),無法自動登入。請稍後再試或改用手動模式。');
  }
  await page.locator('#login_btn, button[type=submit]').first().click();
  await page.waitForTimeout(7000);
  if (page.url().includes('login')) {
    throw new Error('FET 登入失敗(可能帳密錯誤或出現驗證碼)。');
  }
}

// 讀取「門號開頭」下拉所有前綴(排除「不限」)
async function readPrefixes(page) {
  return page.evaluate(() => {
    const sel = document.querySelector('select[name=numberPrefix]');
    if (!sel) return [];
    return [...sel.options].map((o) => o.value).filter((v) => /^09\d\d$/.test(v));
  });
}

const waitQuery = (page) =>
  page
    .waitForResponse((r) => r.url().includes(API_MARK), { timeout: 20000 })
    .then(async (r) => {
      try {
        return (await r.json()).availableMsisdnList || [];
      } catch {
        return [];
      }
    });

// 開啟「門號開頭」下拉並點選某前綴。範圍鎖到 numberPrefix 容器,
// 必須點「可見選單項」(span.content / li),不可點隱藏的原生 <option>(點了無效)。
async function pickPrefix(page, prefix) {
  const box = page.locator('.fui-select:has(select[name=numberPrefix])').first();
  await box.locator('.fui-dropdown').first().click().catch(() => {}); // 開啟
  await page.waitForTimeout(400);
  // 只點可見選單項(排除 option)
  const item = box.locator('.fui-dropdown-item, span.content, li, a').filter({ hasText: new RegExp(`^${prefix}$`) }).first();
  await item.click({ timeout: 5000 }).catch(async () => {
    await box.locator(`text="${prefix}"`).first().click({ timeout: 3000 }).catch(() => {});
  });
  await page.waitForTimeout(300);
}

async function clickSearch(page) {
  await page
    .getByRole('button', { name: '查詢' })
    .first()
    .click()
    .catch(async () => {
      await page.locator('button:has-text("查詢")').first().click().catch(() => {});
    });
}

// source.fet: { excludeFour?:bool, prefixes?:[], delayMs? }
export async function fetchFetEcare(source) {
  const account = process.env.FET_ACCOUNT;
  const password = process.env.FET_PASSWORD;
  if (!account || !password) {
    throw new Error('未設定遠傳帳密:請在 .env 設 FET_ACCOUNT 與 FET_PASSWORD。');
  }
  const cfg = source.fet || {};
  const excludeFour = cfg.excludeFour === true; // 預設含 4(抓越多越好)
  const delayMs = cfg.delayMs ?? 800;

  const chromium = await loadChromium();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ userAgent: UA });
    page.setDefaultTimeout(20000);
    await login(page, account, password);

    // 設定是否排除 4(預設不排除 = 含 4)
    if (!excludeFour) {
      await page.getByText('不排除', { exact: true }).first().click().catch(() => {});
      await page.waitForTimeout(300);
    }

    const prefixes = cfg.prefixes?.length ? cfg.prefixes : await readPrefixes(page);
    const all = new Set();
    for (const prefix of prefixes) {
      // 最多試 2 次:若回應號碼不全屬此前綴,代表選單沒選到(仍是「不限」),重試
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          await pickPrefix(page, prefix);
          const p = waitQuery(page);
          await clickSearch(page);
          const list = await p;
          const msisdns = list.map((x) => x.msisdn).filter(Boolean);
          const matched = msisdns.filter((m) => m.startsWith(prefix));
          // 全部符合(或空) → 採用;若混入其他前綴 = 選號失敗,重試
          if (msisdns.length === 0 || matched.length === msisdns.length) {
            for (const m of matched) all.add(m);
            break;
          }
        } catch {
          // 重試
        }
        await page.waitForTimeout(delayMs);
      }
      await page.waitForTimeout(delayMs);
    }
    return [...all];
  } finally {
    await browser.close();
  }
}
