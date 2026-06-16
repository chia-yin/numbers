# SPEC — M7: 好號碼篩選與排名頁

> 寫給沒看過本專案對話的實作者。所有上下文、資料模型、介面均在此文件定義。

---

## 1. 功能目標與範圍

### 做什麼
- 新增 `POST /api/rank` 端點：接收候選號碼陣列，批次呼叫現有分析引擎，依加權分降序排列，依 minScore 篩選後回傳。
- 新增 `GET /api/sources` 端點：回傳 `config/sources.json` 中可用的來源清單（供前端下拉選單使用）。
- 新增 `public/rank.html`：選號排名頁，支援手動貼入或 URL 爬取兩種來源，顯示排名表格，可點擊號碼跳至詳細分析。
- 更新 `public/index.html`：讀取 URL query param `?phone=xxx`，自動填入並送出分析。
- 更新 `src/server.js`：掛載兩個新路由。
- 新增 `test/rank.test.js`：rank 路由的單元測試。

### 不做什麼
- 不實作資料庫或結果持久化（分析結果僅在 request 週期內存在）。
- 不修改現有 `/api/analyze` 或 `/api/crawl` 的行為。
- 不實作使用者認證。
- 不實作分頁（一次回傳全部篩選後結果，最多 200 筆）。
- 不修改 `.workflow/ROADMAP.md`。

---

## 2. 現有架構（本里程碑依賴）

```
src/
  server.js              ← Express app，掛路由，export { app }
  routes/
    analyze.js           ← export { analyzeHandler, router }
    crawl.js             ← POST /api/crawl
  engine/
    wuxingJudge.js       ← export { judgeAll }（核心計算）
    groupConfig.js       ← export { DEFAULT_GROUP_CONFIG }（預設 [3,3,4]）
config/
  sources.json           ← 爬蟲來源設定（見第 4 節）
public/
  index.html             ← 單號分析頁
  style.css              ← 全域樣式（.symbol-good/.symbol-mid/.symbol-bad）
```

### analyzeHandler 介面（`src/routes/analyze.js`）
```js
// 回傳 { status: number, body: object }
analyzeHandler(phone: string, groups: number[] | undefined)
```
- status 200 時，body 為完整分析結果（見第 3.1 節）。
- status 400 時，body 為 `{ error: string }`。
- rank 路由應直接 import 此函式，不重新造輪。

### judgeAll 介面（`src/engine/wuxingJudge.js`）
```js
judgeAll(phoneNumber: string, groupConfig?: number[]) → ResultObject
```
結果物件中，`score.weighted`（0–100 浮點數）是排名依據。

---

## 3. API 規格

### 3.1 `POST /api/rank`

**掛載路徑**：`src/server.js` 加入 `app.use('/api/rank', rankRouter)`

**Request body**（JSON）：
```json
{
  "candidates": ["0912345678", "0987654321"],
  "groups": [3, 3, 4],
  "minScore": 70
}
```
| 欄位 | 型別 | 必填 | 預設值 | 說明 |
|------|------|------|--------|------|
| candidates | string[] | 是 | — | 手機號碼陣列，每個元素需為純數字字串 |
| groups | number[] | 否 | [3,3,4] | 分組規則，需與號碼長度相符 |
| minScore | number | 否 | 70 | 加權分下限（0–100），低於此分的號碼不回傳 |

**驗證規則**：
- `candidates` 缺少或非陣列 → 400 `{ "error": "candidates must be a non-empty array" }`
- `candidates.length === 0` → 400 同上
- `candidates.length > 200` → 400 `{ "error": "candidates limit is 200" }`
- `minScore` 不是 0–100 的數字 → 400 `{ "error": "minScore must be a number between 0 and 100" }`
- 個別號碼分析失敗（格式錯誤等）→ 靜默跳過，不計入結果（不中斷整個請求）

**Response（200）**：
```json
{
  "ranked": [
    {
      "rank": 1,
      "phone": "0987654321",
      "groups": ["098", "765", "4321"],
      "groupSums": { "n1": 26, "n2": 18, "n3": 15 },
      "fiveGrid": {
        "總格": { "value": 59, "digit": 9, "wuxing": "水", "symbol": "○", "luck": "...", "weight": 0.5 },
        "天格": { "value": 27, "digit": 7, "wuxing": "金", "symbol": "○", "luck": "...", "weight": 0.05, "relation": "X生本體" },
        "人格": { "value": 44, "digit": 4, "wuxing": "火", "symbol": "▲", "luck": "...", "weight": 0.15, "relation": "..." },
        "地格": { "value": 33, "digit": 3, "wuxing": "火", "symbol": "○", "luck": "...", "weight": 0.1, "relation": "..." },
        "外格": { "value": 16, "digit": 6, "wuxing": "土", "symbol": "▲", "luck": "...", "weight": 0.25, "relation": "..." }
      },
      "extended": {
        "子息": { "value": 27, "digit": 7, "wuxing": "金", "relation": "..." },
        "健康": { "value": 36, "digit": 6, "wuxing": "土", "relation": "..." },
        "配偶": { "value": 22, "digit": 2, "wuxing": "木", "relation": "..." },
        "朋友": { "value": 31, "digit": 1, "wuxing": "木", "relation": "..." }
      },
      "score": { "weighted": 87.5, "level": "大吉" },
      "isPremium": false
    }
  ],
  "total": 1,
  "filtered": 4
}
```
- `ranked`：通過 minScore 篩選後依 `score.weighted` 降序排列，加上 `rank` 欄位（1 起算）。
- `total`：`ranked` 陣列長度（通過篩選的筆數）。
- `filtered`：被 minScore 過濾掉的筆數（即 candidates.length - 分析失敗數 - total）。
- 每個 ranked 項目的結構 = `analyzeHandler` 的 body（`aiComment` 欄位省略）+ `rank` 欄位。

---

### 3.2 `GET /api/sources`

**掛載路徑**：可直接加在 `src/routes/sources.js`，在 `server.js` 加入 `app.use('/api/sources', sourcesRouter)`

**Request**：無 body，無 query params

**Response（200）**：
```json
{
  "sources": [
    {
      "id": "manual",
      "name": "手動貼入號碼清單",
      "type": "text"
    },
    {
      "id": "example-url",
      "name": "示範 URL 來源",
      "type": "url",
      "url": "https://example.com/numbers",
      "selector": ".number-item",
      "delayMs": 2000
    }
  ]
}
```
- 回傳 `config/sources.json` 中 `type === 'text'` 的項目，加上所有 `enabled === true` 的 URL 來源。
- `type: 'text'` 的項目不需要 `url`、`selector`、`delayMs` 欄位。
- `type: 'url'` 的項目需包含 `url`、`selector`、`delayMs`。
- `note` 欄位不回傳前端（內部說明用）。

---

## 4. 前端規格

### 4.1 `public/rank.html`

頁面結構（獨立 HTML，無打包工具，同 index.html 風格）：

```
[導覽] ← 手機號碼分析（連回 index.html）

[來源選擇]
  ▼ 下拉選單（從 GET /api/sources 載入）
     - 每個 option 的 value = sources[i].id
     - 選 type=text → 顯示 <textarea> 貼入號碼（一行一個）
     - 選 type=url  → 顯示「抓取號碼」按鈕（呼叫 POST /api/crawl）

[URL 來源：抓取後顯示抓到的號碼數量與預覽前 5 筆]

[篩選設定]
  最低評分閾值：[數字輸入框，預設 70，min=0, max=100]
  分組規則：[文字輸入，預設 3-3-4，同 index.html]

[提交按鈕：篩選並排名]

[載入狀態提示（例：「分析中... 50/100」）]

[排名結果表格]
  欄位：排名 | 電話號碼（可點擊） | 加權分 | 評語 | 雙吉格 | 總格 | 外格 | 人格 | 地格 | 天格
  行的顏色套用 .symbol-good / .symbol-mid / .symbol-bad（依總格 symbol）
  電話號碼欄：<a href="index.html?phone=xxx">xxx</a>

[統計資訊：共分析 N 筆，通過篩選 M 筆，過濾 K 筆]
```

**API 呼叫流程**：
1. 頁面載入 → `GET /api/sources` → 填入下拉選單
2. 若選 URL 來源，點「抓取號碼」→ `POST /api/crawl { source: { type: 'url', url, selector } }` → 暫存 candidates
3. 點「篩選並排名」→ `POST /api/rank { candidates, groups, minScore }` → 渲染表格

**URL 來源的 crawl request**（`POST /api/crawl`）：
```json
{
  "source": {
    "type": "url",
    "url": "https://...",
    "selector": ".number-item"
  }
}
```

---

### 4.2 `public/index.html`（修改）

在現有 `<script>` 的 `form.addEventListener('submit', ...)` **之前**，加入以下邏輯：

```js
// 讀取 URL query param ?phone=xxx，自動填入並送出
const urlParams = new URLSearchParams(window.location.search)
const prePhone = urlParams.get('phone')
if (prePhone) {
  phoneInput.value = prePhone
  form.requestSubmit()
}
```

位置：`</script>` 結束標籤之前的最後幾行。

---

## 5. 檔案清單（本里程碑新增/修改）

| 動作 | 路徑 | 說明 |
|------|------|------|
| 新增 | `src/routes/rank.js` | POST /api/rank 實作 |
| 新增 | `src/routes/sources.js` | GET /api/sources 實作 |
| 修改 | `src/server.js` | 掛載 rankRouter 與 sourcesRouter |
| 新增 | `public/rank.html` | 排名頁 |
| 修改 | `public/index.html` | 加 ?phone= query param 自動填入邏輯 |
| 新增 | `test/rank.test.js` | rank 路由單元測試 |

---

## 6. 驗收標準（Acceptance Criteria）

以下每條均需可獨立驗證：

1. **AC-1**：`npm test` 所有測試（含 `test/rank.test.js`）全綠。
2. **AC-2**：`POST /api/rank { candidates: [...200筆以上...] }` 回傳 HTTP 400。
3. **AC-3**：`POST /api/rank { candidates: ["0936102682", "0912345678"] }` 回傳 HTTP 200，`ranked` 陣列依 `score.weighted` 降序排列，每項包含 `rank` 欄位。
4. **AC-4**：`POST /api/rank { candidates: ["0936102682"], minScore: 99 }` 若該號碼分數低於 99，回傳 `{ ranked: [], total: 0, filtered: 1 }`。
5. **AC-5**：`GET /api/sources` 回傳 HTTP 200，body 包含 `sources` 陣列，manual 項目一定存在。
6. **AC-6**：瀏覽器開啟 `rank.html`，貼入 5 個號碼，點「篩選並排名」，表格顯示正確排序結果。
7. **AC-7**：點擊排名表格中的號碼連結，跳至 `index.html?phone=xxx`，頁面自動分析並顯示結果。
8. **AC-8**：候選號碼中含有格式錯誤的號碼（如 `"abc"`），該號碼靜默跳過，其餘號碼正常分析回傳。
