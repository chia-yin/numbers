# M5 SPEC：整合 LLM Adapter — AI 生成口語化整體解讀

## 1. 背景與目標

本里程碑在既有 `/api/analyze` 路由之上加入選用的 AI 口語解讀功能。
當 client 帶入 `?aiComment=true` query 參數時，後端呼叫 LLM 生成一段繁體中文口語說明，
填入 response 的 `aiComment` 欄位（目前固定為 `null`）。

LLM 呼叫預設**關閉**（需明確帶 query param），避免非預期費用。
若環境變數 `LLM_PROVIDER` 未設定，`aiComment` 維持 `null`，不報錯（graceful degradation）。

## 2. 不做什麼（Out of Scope）

- **不**更動五格計算邏輯（`src/engine/`）
- **不**更動評分邏輯（`src/engine/wuxingJudge.js`、scorer）
- **不**新增其他 LLM provider（本里程碑只實作 `openai`-compatible）
- **不**做 streaming response（一次性回傳完整字串）
- **不**在 UI 加入 AI 解讀的顯示區塊（UI 更新列入 FE 任務，僅顯示純文字即可）
- **不**加入 rate limiting 或費用控制（超出 scope）
- **不**快取 LLM 回應

## 3. 技術方案

### 3.1 新增/修改的檔案

```
prompts/
  phone-comment.txt        ← 新增：提示詞模板（可人工編輯）

src/llm/
  adapter.js               ← 新增：統一入口，依 LLM_PROVIDER 分派
  openaiAdapter.js         ← 新增：OpenAI-compatible API 實作

src/routes/
  analyze.js               ← 修改：讀 ?aiComment=true，非同步呼叫 adapter

.env.example               ← 修改：新增 LLM 相關變數

test/
  adapter.test.js          ← 新增：mock LLM 回傳，驗證整合邏輯
```

### 3.2 資料流

```
Client
  POST /api/analyze?aiComment=true
  body: { phone, groups? }
          │
          ▼
src/routes/analyze.js（router）
  1. analyzeHandler(phone, groups) → { status, body }  ← 同步，不動
  2. 若 query.aiComment === 'true' && status === 200：
       generateComment(body) → Promise<string|null>
  3. body.aiComment = comment（string 或 null）
  4. res.json(body)
          │
          ▼
src/llm/adapter.js
  - 讀 process.env.LLM_PROVIDER
  - 若未設定 → 回傳 null
  - 若 'openai' → 呼叫 openaiAdapter.generateComment(analysisResult)
          │
          ▼
src/llm/openaiAdapter.js
  - 讀 prompts/phone-comment.txt（fs/promises readFile）
  - 替換 placeholder → 組成 user message
  - 用內建 fetch 呼叫 OPENAI_BASE_URL/chat/completions
  - 回傳 choices[0].message.content（string）
```

### 3.3 環境變數（完整清單）

| 變數 | 預設值 | 說明 |
|------|--------|------|
| `PORT` | `3000` | Express 監聽 port（既有） |
| `LLM_PROVIDER` | （未設=停用）| 填 `openai` 啟用 AI 解讀 |
| `OPENAI_API_KEY` | — | OpenAI-compatible API key |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | 可替換為 proxy 或本地模型端點 |
| `OPENAI_MODEL` | `gpt-4o-mini` | 模型名稱 |

### 3.4 API 介面（變更點）

既有端點 `POST /api/analyze` 新增選用 query param：

```
POST /api/analyze?aiComment=true
Content-Type: application/json

{ "phone": "0936102682", "groups": [3,3,4] }
```

Response（`aiComment` 欄位由 `null` 變為字串）：

```json
{
  "input": "0936102682",
  "groups": ["036", "102", "682"],
  "groupSums": { "n1": 9, "n2": 3, "n3": 16 },
  "fiveGrid": { ... },
  "extended": { ... },
  "score": { "weighted": 83.75, "verdict": "吉" },
  "isPremium": true,
  "aiComment": "這組號碼整體來看相當不錯，總格屬金，與外格相輔相成……"
}
```

`?aiComment=true` 未帶或 `LLM_PROVIDER` 未設時，`aiComment` 為 `null`。

### 3.5 src/llm/adapter.js 模組介面

```js
// ESM，與專案其他模組一致
export async function generateComment(analysisResult, options = {}) {
  // analysisResult：來自 transformResult() 的完整 response body
  // options：預留，本里程碑不使用
  // 回傳 Promise<string|null>
}
```

### 3.6 src/llm/openaiAdapter.js 模組介面

```js
export async function generateComment(analysisResult) {
  // 讀 prompts/phone-comment.txt
  // 替換 placeholder（見 3.7）
  // fetch OPENAI_BASE_URL/chat/completions
  // 回傳 string（LLM 回應文字）
  // 若 fetch 失敗 → throw Error（由 adapter.js 捕捉後回傳 null）
}
```

### 3.7 prompts/phone-comment.txt — Placeholder 規格

檔案為純文字，可被使用者直接編輯。Placeholder 使用雙大括號格式：

| Placeholder | 替換來源 | 說明 |
|-------------|---------|------|
| `{{phone}}` | `analysisResult.input` | 原始電話號碼 |
| `{{fiveGrid}}` | JSON.stringify(analysisResult.fiveGrid, null, 2) | 五格完整資料 |
| `{{score}}` | JSON.stringify(analysisResult.score) | 加權分與評語 |
| `{{extended}}` | JSON.stringify(analysisResult.extended) | 延伸關係格 |

替換方式：對每個 placeholder 做 `String.prototype.replaceAll`（不用 regex）。

### 3.8 提示詞設計原則（必須寫入 phone-comment.txt）

- 明確說明「數理計算結果為準，AI 僅補充口語說明，不得更改數值」
- 要求輸出繁體中文，語氣親切口語，**100–200 字**
- 不要列表、不要標題，一段話
- 不要提及「AI」或「語言模型」

## 4. 驗收標準（Acceptance Criteria）

| # | 條件 | 測試方式 |
|---|------|---------|
| AC1 | `LLM_PROVIDER` 未設時，`POST /api/analyze` 回傳 `aiComment: null`，HTTP 200 | `test/adapter.test.js` |
| AC2 | `?aiComment=true` 且 `LLM_PROVIDER=openai` 時，`aiComment` 為非空字串 | mock openaiAdapter，unit test |
| AC3 | `?aiComment=false` 或無 query param 時，不呼叫 LLM（即使已設定 env） | `test/adapter.test.js` |
| AC4 | openaiAdapter 呼叫失敗（fetch throw）時，`aiComment` 回傳 `null`，不讓整個 `/api/analyze` 報 500 | `test/adapter.test.js` |
| AC5 | `prompts/phone-comment.txt` 存在，且包含全部 4 個 placeholder | 目視 / grep |
| AC6 | `.env.example` 包含 `LLM_PROVIDER`、`OPENAI_API_KEY`、`OPENAI_BASE_URL`、`OPENAI_MODEL` | 目視 |
| AC7 | `npm test` 全綠（包含既有測試不破壞） | `npm test` |
| AC8 | 設定真實 `.env` 後，`curl -X POST "http://localhost:3000/api/analyze?aiComment=true" -H "Content-Type: application/json" -d '{"phone":"0936102682"}'` 回傳非 null 的 `aiComment` 字串 | 手動驗收 |

## 5. 模組依賴關係（import 方向）

```
src/routes/analyze.js
  └─ imports ─► src/llm/adapter.js
                  └─ imports ─► src/llm/openaiAdapter.js
                                  └─ reads ──► prompts/phone-comment.txt（fs/promises）
                                  └─ fetch ──► OPENAI_BASE_URL（外部網路）
```

`adapter.js` 只在呼叫時才動態 import `openaiAdapter.js`（或直接 static import，兩者皆可），
但**不在模組載入時就呼叫 API**，避免 test 環境副作用。

## 6. 測試策略

`test/adapter.test.js` 使用 Node.js 內建 `node:test` + `node:assert/strict`，
**不**啟動 HTTP server，直接 import 函式做 unit test。

測試要 mock `openaiAdapter.generateComment`：在 test 檔中建立 fake module 或直接
monkey-patch `adapter` 的 provider 分派邏輯。

**推薦做法**：`adapter.js` 匯出一個額外的 `_setProvider(fn)` 或接受 `options.provider` 覆寫，
讓 test 可注入 fake LLM function，無需 mock ESM module（ESM mock 在 node:test 有限制）。

具體方式：

```js
// src/llm/adapter.js
let _overrideProvider = null;
export function _setProviderForTest(fn) { _overrideProvider = fn; }

export async function generateComment(analysisResult, options = {}) {
  const providerFn = _overrideProvider ?? resolveProvider();
  if (!providerFn) return null;
  try {
    return await providerFn(analysisResult);
  } catch {
    return null;
  }
}
```

`_setProviderForTest` 僅供測試使用，production code 不呼叫。
