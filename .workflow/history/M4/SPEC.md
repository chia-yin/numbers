# SPEC — M4: 計算網頁 UI

> 本文件由架構師撰寫，供後續 AI agent（BE / FE）獨立實作，**不得依賴本次對話的上下文**。

---

## 1. 功能目標與範圍

### 做什麼
- 實作 `POST /api/analyze` HTTP 端點，串接已完成的 M3 引擎（`judgeAll()`），回傳完整分析結果。
- 將 `public/index.html` 改寫為 SPA：使用者輸入手機號碼與分組規則，送出後呼叫 API 並渲染結果。
- 新增 `public/style.css`：基本排版，以色碼呈現吉凶（○=綠、▲=橘、X=紅）。
- 新增 `test/api.test.js`：直接 import route handler 做單元測試，不啟動 HTTP server。

### 不做什麼（明確排除）
- **不** 實作 AI 口語解讀（M5 負責，`aiComment` 欄位本里程碑固定為 `null`）。
- **不** 實作爬蟲或排名頁（M6 / M7）。
- **不** 新增任何 npm 依賴。
- **不** 修改 `src/engine/` 下任何既有引擎模組。
- **不** 修改 `.workflow/ROADMAP.md`。

---

## 2. 現有架構摘要（背景知識）

```
src/
  server.js           ← Express app，目前只掛 static public/，需加入 JSON body parser 與 analyze route
  engine/
    calculator.js     ← analyze()：基礎五格計算
    groupConfig.js    ← DEFAULT_GROUP_CONFIG = [3,3,4]
    wuxingJudge.js    ← judgeAll()：完整分析（含 81數理 查表、生克判定、加權評分）
reference/
  81數理.json         ← 唯讀，key 1–81，每筆含 { symbol: "○"|"▲"|"X", luck: string, text: string }
public/
  index.html          ← 目前是 Hello 佔位頁，本里程碑全面改寫
```

### `judgeAll(phone, groupConfig?)` 回傳形狀

```js
{
  input: "0936102682",
  groups: ["036", "102", "682"],
  groupSums: { n1: 9, n2: 3, n3: 16 },
  fiveGrid: {
    總格: { value: 28, digit: 8, wuxing: "金" },
    天格: { value: 10, digit: 0, wuxing: "水" },
    人格: { value: 12, digit: 2, wuxing: "木" },
    地格: { value: 19, digit: 9, wuxing: "水" },
    外格: { value: 17, digit: 7, wuxing: "金" },
  },
  extended: {
    子息: { value: 27, digit: 7, wuxing: "金" },
    健康: { value: 36, digit: 6, wuxing: "土" },
    配偶: { value: 22, digit: 2, wuxing: "木" },
    朋友: { value: 31, digit: 1, wuxing: "木" },
  },
  numerology: {          // 81數理 查表結果，key 與 fiveGrid 相同
    總格: { symbol: "○", luck: "吉", text: "..." },
    天格: { symbol: "▲", luck: "半吉", text: "..." },
    // ...
  },
  wuxingRelations: {
    本體: "金",          // 總格五行
    天格: { wuxing: "水", relation: "X生本體" },
    人格: { wuxing: "木", relation: "X生本體" },
    地格: { wuxing: "水", relation: "X生本體" },
    外格: { wuxing: "金", relation: "比和" },
    子息: { wuxing: "金", relation: "比和" },
    健康: { wuxing: "土", relation: "本體生X" },
    配偶: { wuxing: "木", relation: "X生本體" },
    朋友: { wuxing: "木", relation: "X生本體" },
  },
  score: { weighted: 83.75, level: "吉" },
  isPremium: false,
}
```

關係字串枚舉：`"比和"` / `"本體生X"` / `"X生本體"` / `"本體剋X"` / `"X剋本體"`

吉凶等級枚舉（`score.level`）：`大吉` ≥80 / `吉` ≥60 / `半吉` ≥40 / `凶` ≥20 / `大凶` <20

---

## 3. API 規格

### `POST /api/analyze`

#### Request

```json
{
  "phone": "0936102682",
  "groups": [3, 3, 4]
}
```

| 欄位 | 型別 | 必填 | 說明 |
|------|------|------|------|
| `phone` | string | 是 | 手機號碼，必須全為數字 |
| `groups` | number[] | 否 | 分組，預設 `[3, 3, 4]`；各數加總必須等於 `phone.length` |

#### Response 200 — 成功

Route handler 將 `judgeAll()` 的輸出**轉換**為以下形狀後回傳（不直接透傳 `judgeAll` 原始物件）：

```json
{
  "input": "0936102682",
  "groups": ["036", "102", "682"],
  "groupSums": { "n1": 9, "n2": 3, "n3": 16 },
  "fiveGrid": {
    "總格": {
      "value": 28, "digit": 8, "wuxing": "金",
      "symbol": "○", "luck": "吉",
      "weight": 0.50
    },
    "天格": {
      "value": 10, "digit": 0, "wuxing": "水",
      "symbol": "▲", "luck": "半吉",
      "weight": 0.05,
      "relation": "X生本體"
    },
    "人格": {
      "value": 12, "digit": 2, "wuxing": "木",
      "symbol": "○", "luck": "吉",
      "weight": 0.15,
      "relation": "X生本體"
    },
    "地格": {
      "value": 19, "digit": 9, "wuxing": "水",
      "symbol": "▲", "luck": "半吉",
      "weight": 0.10,
      "relation": "X生本體"
    },
    "外格": {
      "value": 17, "digit": 7, "wuxing": "金",
      "symbol": "○", "luck": "吉",
      "weight": 0.25,
      "relation": "比和"
    }
  },
  "extended": {
    "子息": { "value": 27, "digit": 7, "wuxing": "金", "relation": "比和" },
    "健康": { "value": 36, "digit": 6, "wuxing": "土", "relation": "本體生X" },
    "配偶": { "value": 22, "digit": 2, "wuxing": "木", "relation": "X生本體" },
    "朋友": { "value": 31, "digit": 1, "wuxing": "木", "relation": "X生本體" }
  },
  "score": { "weighted": 83.75, "level": "吉" },
  "isPremium": false,
  "aiComment": null
}
```

**轉換規則（route handler 需執行）：**
- `fiveGrid` 各格：合併 `judgeAll.fiveGrid[key]` + `judgeAll.numerology[key]`（取 `symbol`、`luck`）+ WEIGHTS 常數 + `judgeAll.wuxingRelations[key].relation`（總格無此欄位）。
- `extended` 各格：合併 `judgeAll.extended[key]` + `judgeAll.wuxingRelations[key].relation`。
- WEIGHTS 常數（與引擎內一致）：`{ 總格: 0.50, 外格: 0.25, 人格: 0.15, 地格: 0.10, 天格: 0.05 }`。
- `aiComment` 固定為 `null`（M5 填入）。
- 不要透傳 `judgeAll` 的 `numerology` 與 `wuxingRelations` 原始欄位（已合併進各格）。

#### Response 400 — 輸入錯誤

```json
{ "error": "phone must be a non-empty string of digits" }
```

或

```json
{ "error": "groups sum (10) must equal phone length (10)" }
```

---

## 4. 新增 / 修改的檔案清單

| 路徑 | 動作 | 說明 |
|------|------|------|
| `src/routes/analyze.js` | 新增 | POST /api/analyze handler（ESM，export `analyzeHandler` 與 `router`） |
| `src/server.js` | 修改 | 加入 `express.json()` middleware + 掛載 `/api/analyze` route |
| `public/index.html` | 改寫 | SPA 表單 + 結果渲染（純 HTML/JS，無框架） |
| `public/style.css` | 新增 | 排版 + 吉凶色碼 |
| `test/api.test.js` | 新增 | 直接 import analyzeHandler，不啟動 HTTP server |

---

## 5. `src/routes/analyze.js` 介面

```js
// ESM module
import { Router } from 'express'

// 純函式，供測試直接呼叫
export function analyzeHandler(phone, groups) { ... }
// 回傳 { status: 200|400, body: object }

// Express Router，供 server.js 掛載
const router = Router()
router.post('/', async (req, res) => { ... })
export { router }
```

---

## 6. UI 規格（`public/index.html` + `public/style.css`）

### 頁面結構

```
[標題] 公號數字學 — 手機號碼五格分析

[表單]
  手機號碼：[input type=text maxlength=15 placeholder="0936102682"]
  分組規則：[input type=text value="3-3-4" pattern="^\d+(-\d+)+$"]
             (說明文字：台灣手機 10 碼，預設切法為 09xx-xxx-xxxx)
  [送出按鈕]

[結果區塊（初始隱藏，呼叫 API 後顯示）]
  整體評語：score.level（大字顯示）  加權分：score.weighted / 100
  isPremium 為 true 時顯示「★ 雙吉格」標記

  [五格分析表格]
  格名 | 數值 | 個位 | 五行 | 吉凶 | 權重 | 與總格關係

  [延伸關係格表格]
  格名 | 數值 | 個位 | 五行 | 與總格關係

[錯誤訊息區塊（API 回 400 時顯示 error 文字）]
```

### 色碼規則（套用在表格列或吉凶欄位）

| symbol 值 | 背景色（建議） | 文字色 |
|-----------|--------------|--------|
| `○` | `#d4edda`（淡綠） | `#155724` |
| `▲` | `#fff3cd`（淡黃） | `#856404` |
| `X` | `#f8d7da`（淡紅） | `#721c24` |

整體評語區塊背景色同總格 symbol 色碼。

### JavaScript 行為

1. 表單送出時（preventDefault），讀取 phone 與 groups 欄位值。
2. 將 groups 字串（如 `"3-3-4"`）split `-` 轉為整數陣列。
3. `fetch('/api/analyze', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({phone, groups}) })`。
4. 成功（200）：渲染結果區塊。失敗（400 / 非 ok）：顯示錯誤訊息。
5. 不使用任何 npm 或 CDN 依賴，純 Vanilla JS。

---

## 7. 驗收標準（Acceptance Criteria）

每條必須可獨立驗證：

1. **AC-1** `npm test` 全綠，包含 `test/api.test.js`。
2. **AC-2** `POST /api/analyze` 帶 `{"phone":"0936102682","groups":[3,3,4]}` → 200，response 含 `fiveGrid.總格.wuxing === "金"`、`score.level` 為字串、`aiComment === null`。
3. **AC-3** `POST /api/analyze` 帶 `{"phone":"abc"}` → 400，body 含 `error` 欄位。
4. **AC-4** `POST /api/analyze` 帶 `{"phone":"0936102682","groups":[3,3,5]}` → 400（groups sum = 11 ≠ 10）。
5. **AC-5** `fiveGrid` 五格各含 `symbol`、`luck`、`weight`、`wuxing`；天格/人格/地格/外格另含 `relation`；總格無 `relation`。
6. **AC-6** `extended` 四格各含 `relation`。
7. **AC-7** 瀏覽器開啟 `http://localhost:3000`，輸入 `0936102682` / `3-3-4`，送出後顯示五格表格，總格行背景為綠色（○）。
8. **AC-8** 瀏覽器輸入無效號碼，送出後顯示錯誤訊息（紅字），結果區塊不顯示。
9. **AC-9** `isPremium === true` 時，頁面顯示「★ 雙吉格」文字。
10. **AC-10** `express.json()` middleware 已掛載，`Content-Type: application/json` POST 可正常解析 body。
