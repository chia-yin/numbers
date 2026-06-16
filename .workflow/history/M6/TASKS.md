STATUS: DONE

# M6 TASKS — 選號爬蟲

> 執行角色：BE（後端）。本里程碑無 ART / FE / INFRA 任務。
> 所有介面規格（API 路徑、回傳格式、函式簽名）見 `.workflow/SPEC.md`，請先閱讀再動手。

---

## 任務清單

### 相依套件

- [x] [BE] 安裝 `node-html-parser`
  - 執行：`npm install node-html-parser`
  - 確認 `package.json` `dependencies` 出現 `"node-html-parser": "^6.1.0"`（或更新版）
  - 判斷標準：`node -e "import('node-html-parser').then(m => console.log('ok'))"` 印出 `ok`

---

### 模組實作

- [x] [BE] 實作 `src/crawler/parser.js`
  - 新增檔案 `src/crawler/parser.js`（ESM，`"type": "module"` 專案）
  - 匯出 `extractFromText(content: string): string[]`
    - 對每行去除 `-`、空格後，用 `/\b(\d{10})\b/g` 找出所有 10 碼數字串
    - 回傳陣列（可為空）
  - 匯出 `extractFromHtml(html: string, selector: string): string[]`
    - 用 `node-html-parser` 的 `parse(html)` 解析
    - 若 `selector` 非空：`root.querySelectorAll(selector)` 取出元素，對每個元素的 `textContent` 呼叫 `extractFromText`
    - 若 `selector` 為空字串：對整個 `root.textContent` 呼叫 `extractFromText`
    - 回傳去重後的陣列（`[...new Set(results)]`）
  - 判斷標準：AC-4、AC-5（見 SPEC 第 5 節）

- [x] [BE] 實作 `src/crawler/politeness.js`
  - 新增檔案 `src/crawler/politeness.js`（ESM）
  - 匯出 `sleep(ms = 2000): Promise<void>`
    - `return new Promise(resolve => setTimeout(resolve, ms))`
  - 匯出 `async checkRobots(url: string): Promise<void>`
    - 從 `url` 解析 `origin`（`new URL(url).origin`）
    - fetch `${origin}/robots.txt`，timeout 5 秒（`AbortSignal.timeout(5000)`）
    - 若 fetch 失敗或狀態非 2xx：直接 return（視為允許）
    - 解析 robots.txt 文字：找 `User-agent: *` 段落下的 `Disallow:` 規則
    - 若目標 path（`new URL(url).pathname`）命中任何非空 Disallow 規則：`throw new Error('robots.txt disallows crawling this URL')`
    - 否則 return（允許）
  - 判斷標準：AC-6（見 SPEC 第 5 節）

- [x] [BE] 實作 `src/crawler/index.js`
  - 新增檔案 `src/crawler/index.js`（ESM）
  - 匯出 `async fetchCandidates(source): Promise<string[]>`
  - 實作邏輯：
    ```
    if source.type === 'text':
      return extractFromText(source.content ?? '')
    if source.type === 'url':
      await checkRobots(source.url)
      await sleep(source.delayMs ?? 2000)
      const res = await fetch(source.url, {
        signal: AbortSignal.timeout(10000),
        headers: { 'User-Agent': 'gonghao-numbers-crawler/1.0 (educational; contact: see package.json)' }
      })
      if (!res.ok) throw new Error(`fetch failed: HTTP ${res.status}`)
      const html = await res.text()
      return extractFromHtml(html, source.selector ?? '')
    throw new Error('unknown source type')
    ```
  - 判斷標準：`fetchCandidates({ type: 'text', content: '0912345678' })` 回傳 `['0912345678']`

- [x] [BE] 新增 `config/sources.json`
  - 新增目錄 `config/` 與檔案 `config/sources.json`
  - 內容完全照 SPEC 第 4.5 節的 JSON（兩筆：manual、example-url）
  - 判斷標準：`node -e "import('./config/sources.json', { assert: { type: 'json' } }).then(m => console.log(m.default.length))"` 印出 `2`
    > 注意：Node.js 20 用 `import()` 搭配 `assert: { type: 'json' }` 或用 `fs.readFile` + `JSON.parse` 皆可；`crawl.js` 裡用 `readFile` + `JSON.parse` 最穩。

- [x] [BE] 實作 `src/routes/crawl.js`
  - 新增檔案 `src/routes/crawl.js`（ESM）
  - 用 `node:fs/promises` 的 `readFile` + `JSON.parse` 讀 `config/sources.json`（路徑用 `import.meta.url` 計算相對路徑，往上兩層到專案根目錄）
  - `GET /sources`：讀取並回傳 sources 陣列（200 JSON）
  - `POST /`：
    - 驗證 `req.body.source` 存在；否則 400 `{ error: "source is required" }`
    - 驗證 `source.type` 為 `'text'` 或 `'url'`；否則 400 `{ error: "source.type must be 'text' or 'url'" }`
    - 呼叫 `fetchCandidates(source)`
    - 若 catch 到 `robots.txt disallows` 訊息：回 403
    - 其他 Error：回 500 `{ error: "fetch failed: <message>" }`
    - 成功：回 200 `{ candidates, sourceType: source.type, count: candidates.length }`
  - 判斷標準：AC-1、AC-2、AC-3、AC-7

- [x] [BE] 修改 `src/server.js`，掛載爬蟲 router
  - 在 `import { router as analyzeRouter } from './routes/analyze.js'` 後加：
    ```js
    import { router as crawlRouter } from './routes/crawl.js'
    ```
  - 在 `app.use('/api/analyze', analyzeRouter)` 後加：
    ```js
    app.use('/api/crawl', crawlRouter)
    ```
  - 不動其他任何現有程式碼
  - 判斷標準：`npm start` 後 `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/crawl/sources` 印出 `200`

---

### 測試

- [x] [BE] 新增 `test/crawler.test.js`
  - 使用 `node:test` + `node:assert`（與既有測試風格一致，不用 Jest/Mocha）
  - **不得**發出真實 HTTP 請求（用 `import { mock } from 'node:test'` 或直接測試 parser/logic 層）
  - 測試案例：
    1. `extractFromText('0912345678\n0987654321')` → `['0912345678', '0987654321']`（AC-4）
    2. `extractFromText('電話: 0936-102-682 請來電')` → `['0936102682']`（含橫線格式，去除後 match）
    3. `extractFromText('no numbers here')` → `[]`
    4. `extractFromHtml('<ul><li class="n">0912345678</li></ul>', '.n')` → `['0912345678']`（AC-5）
    5. `fetchCandidates({ type: 'text', content: '0912345678\n0987654321\n0936102682' })` → 長度 3（AC-1）
    6. `crawl.js` POST handler：body 缺 source → 400（AC-2）
    7. `crawl.js` POST handler：`source.type = 'ftp'` → 400（AC-3）
    8. `crawl.js` GET /sources → 200，回傳陣列長度 ≥ 1（AC-7）
    9. `checkRobots`：mock fetch 回傳含 `Disallow: /` 的 robots.txt → throw（AC-6 禁止）
    10. `checkRobots`：mock fetch 回傳 404 → 不 throw（AC-6 pass）
  - 對 `crawl.js` router 的測試：直接 import handler 函式（仿 `test/api.test.js` 既有模式）或用 Express 的 `supertest`-like 直接呼叫 `app`
    > 提示：看 `test/api.test.js` 如何 import `analyzeHandler` 做單元測試，沿用同樣模式
  - 判斷標準：`npm test` 全綠，AC-1 到 AC-9 全通

---

## 測試指令

```bash
# 跑全部測試（包含既有 M1-M5 測試與新的 crawler 測試）
npm test

# 只跑爬蟲測試
node --test test/crawler.test.js

# 手動 smoke test（需先 npm start）
curl -s -X POST http://localhost:3000/api/crawl \
  -H 'Content-Type: application/json' \
  -d '{"source":{"type":"text","content":"0912345678\n0987654321"}}' | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8');console.log(JSON.parse(d))"

# 取得來源清單
curl -s http://localhost:3000/api/crawl/sources
```

---

## 注意事項

1. **ESM 模組**：專案 `package.json` 有 `"type": "module"`，所有 `import`/`export` 用 ESM 語法，`require()` 不可用。
2. **`config/sources.json` 路徑**：在 `src/routes/crawl.js` 裡用 `fileURLToPath(import.meta.url)` 計算絕對路徑，再 `join(dirname(...), '../../config/sources.json')`，避免 CWD 不確定問題。
3. **既有測試不得破壞**：`test/api.test.js`、`test/adapter.test.js` 等必須繼續通過。
4. **不修改任何 M1–M5 已有檔案**，除了 `src/server.js`（只加兩行）。
