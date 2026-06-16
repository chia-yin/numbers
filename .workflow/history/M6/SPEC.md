# M6 SPEC — 選號爬蟲

> 寫給沒看過本次對話的 agent。請完整閱讀後再動手。

---

## 1. 功能目標與範圍

### 做什麼
- 提供 `POST /api/crawl` 端點：接收「來源描述」，回傳從來源萃取出的電話號碼陣列。
- 支援兩種來源型別：
  1. **text 模式**：使用者直接貼入號碼清單（多行文字），後端解析出號碼。
  2. **url 模式**：後端以內建 `fetch` 抓取指定 URL，用 CSS selector 或 regex 萃取號碼；需遵守 `robots.txt`、每次請求延遲 ≥ 2000ms。
- 提供 `config/sources.json`：預設來源設定檔，供後續 M7 前端下拉選單使用。
- 提供 `GET /api/crawl/sources`：回傳 `config/sources.json` 中所有來源（含 enabled=false 者），供前端顯示。

### 不做什麼（明確排除）
- 不做登入、Cookies、JavaScript 渲染（不用 Puppeteer/Playwright）。
- 不做批次多來源同時爬取（一次請求對應一個 source）。
- 不做號碼去重或評分（去重在 M7 做）。
- 不做前端 UI（M7 的 `rank.html` 才實作選號頁面）。
- 不修改 `src/routes/analyze.js` 或任何已存在的引擎程式碼。

---

## 2. 技術方案

### 2.1 新增依賴

在 `package.json` 的 `dependencies` 加入：
```json
"node-html-parser": "^6.1.0"
```
使用 `npm install node-html-parser` 安裝。

> 選型理由：ROADMAP 第「技術選型」節已明訂。避免 Puppeteer 的笨重依賴。

### 2.2 新增檔案清單

```
src/
  crawler/
    index.js        ← 主入口，orchestrate 抓取流程
    parser.js       ← 從 HTML 字串或純文字萃取電話號碼
    politeness.js   ← robots.txt 檢查 + sleep helper
  routes/
    crawl.js        ← Express router，掛 POST /api/crawl 與 GET /api/crawl/sources
config/
  sources.json      ← 來源設定檔
test/
  crawler.test.js   ← 單元測試（不打真實網路）
```

### 2.3 修改現有檔案

- `src/server.js`：新增一行 `import` + `app.use('/api/crawl', crawlRouter)`。

### 2.4 資料流

```
POST /api/crawl
  └─ crawl.js router
       ├─ 驗證 request body
       └─ fetchCandidates(source)  ← src/crawler/index.js
            ├─ [type=text]  → parser.extractFromText(content)
            └─ [type=url]   → politeness.checkRobots(url)
                              → fetch(url)
                              → parser.extractFromHtml(html, selector)
```

---

## 3. API 規格（跨角色介面，請照此實作）

### 3.1 POST /api/crawl

**Request body（application/json）：**

```json
{
  "source": {
    "type": "text",
    "content": "0912345678\n0987654321\n0936102682"
  }
}
```

或：

```json
{
  "source": {
    "type": "url",
    "url": "https://example.com/numbers",
    "selector": ".number-item",
    "delayMs": 2000
  }
}
```

**Response 200 OK：**

```json
{
  "candidates": ["0912345678", "0987654321", "0936102682"],
  "sourceType": "text",
  "count": 3
}
```

**Response 400 Bad Request（欄位缺失或格式錯誤）：**

```json
{ "error": "source.type must be 'text' or 'url'" }
```

**Response 403 Forbidden（robots.txt 禁止）：**

```json
{ "error": "robots.txt disallows crawling this URL" }
```

**Response 500 Internal Server Error（fetch 失敗）：**

```json
{ "error": "fetch failed: <原始錯誤訊息>" }
```

### 3.2 GET /api/crawl/sources

**Response 200 OK：**

```json
[
  {
    "id": "manual",
    "name": "手動貼入號碼清單",
    "type": "text",
    "description": "將號碼（一行一個）貼入前端文字框"
  },
  {
    "id": "example-url",
    "name": "示範 URL 來源",
    "type": "url",
    "url": "https://example.com/numbers",
    "selector": ".number-item",
    "delayMs": 2000,
    "enabled": false,
    "note": "實際電信選號 URL 請自行填入並設 enabled: true"
  }
]
```

---

## 4. 模組規格

### 4.1 `src/crawler/parser.js`

```js
// 匯出：
export function extractFromText(content)
// content: 多行字串，每行可能含電話號碼
// 規則：找出所有符合台灣手機格式的數字串
//   - 接受 09xxxxxxxx（10 碼）
//   - 接受純 10 位數字（不限首碼，讓使用者彈性貼入）
//   - 每行取第一個符合的號碼；忽略空白行與無號碼行
// 回傳：string[]（可為空陣列）

export function extractFromHtml(html, selector)
// html: 完整 HTML 字串
// selector: CSS selector 字串，若為空字串則對全文做 regex 萃取
// 規則：先用 node-html-parser 選出元素，再對每個元素的 textContent 跑 extractFromText
// 回傳：string[]（可為空陣列）
```

**電話號碼 regex（決定版）：**
```
/\b(\d{10})\b/g
```
> 取連續 10 位數字；不含 `-`（使用者貼入時如含 `-` 請自行去除）。如來源頁面號碼格式為 `0912-345-678`，parser 先對整行 `replace(/-/g, '')` 再 match。

### 4.2 `src/crawler/politeness.js`

```js
export async function checkRobots(url)
// 解析 url 的 origin（https://example.com），fetch /robots.txt
// 檢查 User-agent: * 的 Disallow 規則，判斷 url 的 path 是否被禁
// robots.txt fetch 失敗（404、timeout 5s）→ 視為允許（pass through）
// 若禁止：throw new Error('robots.txt disallows crawling this URL')
// 若允許：正常 return（不回傳值）

export function sleep(ms)
// 回傳 Promise，延遲 ms 毫秒
// 預設：若呼叫者未傳 ms，使用 2000
```

### 4.3 `src/crawler/index.js`

```js
export async function fetchCandidates(source)
// source: { type, content?, url?, selector?, delayMs? }
// type='text': 直接呼叫 extractFromText(source.content)，回傳 string[]
// type='url':
//   1. checkRobots(source.url)（可能 throw）
//   2. sleep(source.delayMs ?? 2000)
//   3. fetch(source.url, { signal: AbortSignal.timeout(10000) })
//   4. 若 HTTP 非 2xx → throw new Error('fetch failed: HTTP <status>')
//   5. extractFromHtml(html, source.selector ?? '')
//   6. 回傳 string[]
// 其他 type：throw new Error("unknown source type")
```

### 4.4 `src/routes/crawl.js`

```js
import { Router } from 'express'
import { fetchCandidates } from '../crawler/index.js'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'

const router = Router()

router.get('/sources', async (req, res) => { ... })
// 讀 config/sources.json，回傳 JSON 陣列

router.post('/', async (req, res) => { ... })
// 驗證 req.body.source，呼叫 fetchCandidates，回傳 { candidates, sourceType, count }
// robots.txt 禁止 → 403
// 其他 Error → 500

export { router }
```

### 4.5 `config/sources.json`

```json
[
  {
    "id": "manual",
    "name": "手動貼入號碼清單",
    "type": "text",
    "description": "將號碼（一行一個）貼入前端文字框"
  },
  {
    "id": "example-url",
    "name": "示範 URL 來源",
    "type": "url",
    "url": "https://example.com/numbers",
    "selector": ".number-item",
    "delayMs": 2000,
    "enabled": false,
    "note": "實際電信選號 URL 請自行填入並設 enabled: true"
  }
]
```

### 4.6 `src/server.js` 修改

在現有 import 區塊後加：
```js
import { router as crawlRouter } from './routes/crawl.js'
```

在 `app.use('/api/analyze', analyzeRouter)` 之後加：
```js
app.use('/api/crawl', crawlRouter)
```

---

## 5. 驗收標準（逐條可測試）

| # | 條件 | 測試方式 |
|---|------|---------|
| AC-1 | `POST /api/crawl` 以 `type: 'text'` 貼入 3 個號碼，回傳 `candidates` 長度為 3 | `test/crawler.test.js` |
| AC-2 | `POST /api/crawl` body 缺少 `source` 欄位，回傳 400 | `test/crawler.test.js` |
| AC-3 | `POST /api/crawl` `source.type` 非 `text`/`url`，回傳 400 | `test/crawler.test.js` |
| AC-4 | `extractFromText` 可從含雜訊的多行字串正確萃取 10 碼數字 | `test/crawler.test.js` |
| AC-5 | `extractFromHtml` 可從 HTML 字串 + selector 萃取號碼 | `test/crawler.test.js` |
| AC-6 | `checkRobots` 在 robots.txt 明確 Disallow 時 throw；404 時 pass | `test/crawler.test.js`（mock fetch）|
| AC-7 | `GET /api/crawl/sources` 回傳 JSON 陣列，長度 ≥ 1 | `test/crawler.test.js` |
| AC-8 | `npm test` 全部通過，不含 skip | `npm test` |
| AC-9 | `POST /api/analyze` 既有行為不受影響 | `npm test`（已有 `test/api.test.js`）|

---

## 6. 環境變數

M6 不新增環境變數。爬蟲 User-Agent 硬碼為：
```
gonghao-numbers-crawler/1.0 (educational; contact: see package.json)
```

---

## 7. 禮貌爬蟲原則（實作規範）

1. **robots.txt 優先**：每次 url 模式爬取前必須先 fetch `/robots.txt`，違反 Disallow 規則則回 403。
2. **請求間隔**：`sleep(source.delayMs ?? 2000)` 在 fetch 目標頁面前執行。
3. **Timeout**：目標頁面 fetch 使用 `AbortSignal.timeout(10000)`（10 秒）。
4. **User-Agent**：所有 fetch 請求帶明確的 User-Agent header（見上方）。
5. **不重試**：fetch 失敗直接回 500，不自動重試（避免對方伺服器過載）。
