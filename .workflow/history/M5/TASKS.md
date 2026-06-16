# M5 TASKS：整合 LLM Adapter

> 執行前必讀：`.workflow/SPEC.md`——所有介面定義、資料模型、環境變數均在該文件。
> 本里程碑無 [ART] / [INFRA] 任務，只有 [BE] 與 [FE]。
> 執行順序：BE → FE（FE 依賴 BE 的 API 行為）。

---

## [BE] 任務清單

### BE-1｜建立提示詞模板 `prompts/phone-comment.txt`

**檔案：** `prompts/phone-comment.txt`（新增，目錄 `prompts/` 也需建立）

**內容需求：**
- 向 LLM 說明任務：根據五格數理計算結果，生成一段繁體中文口語解讀
- **必須包含**以下 4 個 placeholder（順序不限）：
  - `{{phone}}`
  - `{{fiveGrid}}`
  - `{{score}}`
  - `{{extended}}`
- 明確指示：「數理計算結果為準，你的任務是補充口語說明，不得更改任何數值」
- 要求輸出：繁體中文、100–200 字、一段話、不用條列、不提「AI」或「語言模型」
- 語氣：親切、口語，像命理師解讀

**完成判斷：** 檔案存在；`grep -c '{{' prompts/phone-comment.txt` 輸出 `4`（四行各含一個 placeholder）

---

### BE-2｜實作 `src/llm/openaiAdapter.js`

**檔案：** `src/llm/openaiAdapter.js`（新增，目錄 `src/llm/` 也需建立）

**模組規格（ESM）：**

```js
// 唯一對外匯出
export async function generateComment(analysisResult) { ... }
```

**實作細節：**
1. 用 `fs/promises` 讀取 `prompts/phone-comment.txt`（路徑相對於專案根目錄，建議用 `new URL('../../prompts/phone-comment.txt', import.meta.url)` 解析絕對路徑）
2. 依序替換 placeholder（`String.prototype.replaceAll`，非 regex）：
   - `{{phone}}` → `analysisResult.input`
   - `{{fiveGrid}}` → `JSON.stringify(analysisResult.fiveGrid, null, 2)`
   - `{{score}}` → `JSON.stringify(analysisResult.score)`
   - `{{extended}}` → `JSON.stringify(analysisResult.extended)`
3. 用內建 `fetch` 呼叫 OpenAI-compatible API：
   - URL：`${process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1'}/chat/completions`
   - Method：POST
   - Headers：`Content-Type: application/json`、`Authorization: Bearer ${process.env.OPENAI_API_KEY}`
   - Body：`{ model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini', messages: [{ role: 'user', content: <組好的prompt> }], max_tokens: 400 }`
4. 解析回應：`data.choices[0].message.content`（string）
5. 若 HTTP status 非 2xx，throw Error（由上層 adapter 捕捉）

**完成判斷：** 模組可被 import 不報錯；`generateComment` 為 async function

---

### BE-3｜實作 `src/llm/adapter.js`

**檔案：** `src/llm/adapter.js`（新增）

**模組規格（ESM）：**

```js
export async function generateComment(analysisResult, options = {}) { ... }
export function _setProviderForTest(fn) { ... }  // 僅供測試
```

**實作細節：**
1. 模組頂層宣告 `let _overrideProvider = null`
2. `_setProviderForTest(fn)` 設定 `_overrideProvider`（fn 為 null 時清除）
3. `generateComment` 內部邏輯：
   ```
   providerFn = _overrideProvider ?? resolveProvider()
   if (!providerFn) return null
   try {
     return await providerFn(analysisResult)
   } catch {
     return null
   }
   ```
4. `resolveProvider()`（內部 helper）：
   - 讀 `process.env.LLM_PROVIDER`
   - 若 `'openai'`：dynamic import `./openaiAdapter.js`，回傳其 `generateComment`
   - 其他值或未設：回傳 `null`

**完成判斷：** `_setProviderForTest(fn)` 可注入 fake；未設 env 時 `generateComment()` 回傳 `null`

---

### BE-4｜修改 `src/routes/analyze.js` 整合 LLM 呼叫

**檔案：** `src/routes/analyze.js`（修改）

**變更範圍（最小化）：** 只改 router 的 async handler，不動 `analyzeHandler` 函式本身

**目前 router handler（第 101–104 行）：**

```js
router.post('/', async (req, res) => {
  const { status, body } = analyzeHandler(req.body?.phone, req.body?.groups);
  res.status(status).json(body);
});
```

**改後：**

```js
import { generateComment } from '../llm/adapter.js';

router.post('/', async (req, res) => {
  const { status, body } = analyzeHandler(req.body?.phone, req.body?.groups);

  if (status === 200 && req.query.aiComment === 'true') {
    body.aiComment = await generateComment(body);
  }

  res.status(status).json(body);
});
```

**注意：**
- `import` 陳述式加到檔案頂端
- `body.aiComment` 預設已是 `null`（`transformResult` 已設定），只在條件成立時覆寫
- `generateComment` 內部已做 try/catch，失敗回傳 `null`，不會讓此 handler throw

**完成判斷：** 不帶 `?aiComment=true` 時行為與 M4 完全相同（現有 api.test.js 全通）

---

### BE-5｜更新 `.env.example`

**檔案：** `.env.example`（修改，在現有 `PORT=3000` 之後新增）

**新增內容：**

```
# LLM 解讀功能（選用）
# 設定 LLM_PROVIDER 後，?aiComment=true 才會呼叫 AI
# 目前支援：openai（相容 OpenAI API 格式的任意服務）
LLM_PROVIDER=

# OpenAI-compatible API 設定（LLM_PROVIDER=openai 時必填）
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
```

**完成判斷：** `grep -c 'OPENAI' .env.example` 輸出 `3`

---

### BE-6｜撰寫 `test/adapter.test.js`

**檔案：** `test/adapter.test.js`（新增）

**使用 `node:test` + `node:assert/strict`，不啟動 HTTP server**

必須包含以下測試案例：

```
test('LLM_PROVIDER 未設定時，generateComment 回傳 null')
  - 確保 _setProviderForTest(null) 清除 override
  - 確保 LLM_PROVIDER 環境變數未設定（或存原值後 delete，測完還原）
  - assert generateComment({}) === null

test('注入 fake provider，generateComment 回傳 provider 的字串')
  - _setProviderForTest(async () => '這是測試解讀')
  - const result = await generateComment({ input: '0936102682', fiveGrid: {}, score: {}, extended: {} })
  - assert result === '這是測試解讀'
  - afterEach: _setProviderForTest(null) 清除

test('fake provider throw 時，generateComment 回傳 null（不拋出）')
  - _setProviderForTest(async () => { throw new Error('LLM error') })
  - assert await generateComment({}) === null

test('?aiComment 未帶時，路由回傳 aiComment: null（整合驗證）')
  - import { analyzeHandler } from '../src/routes/analyze.js'
  - const { body } = analyzeHandler('0936102682', [3,3,4])
  - assert body.aiComment === null
```

**完成判斷：** `npm test` 全綠，adapter.test.js 四個測試全通

---

## [FE] 任務清單

### FE-1｜在 `public/index.html` 加入「AI 解讀」勾選與顯示區塊

**檔案：** `public/index.html`（修改）

**需求：**
1. 在送出按鈕附近加入 checkbox：
   ```html
   <label>
     <input type="checkbox" id="aiCommentToggle"> AI 口語解讀（需設定 LLM）
   </label>
   ```
2. 在結果區塊底部加入 AI 解讀顯示區（預設隱藏）：
   ```html
   <section id="aiCommentSection" style="display:none">
     <h3>AI 口語解讀</h3>
     <p id="aiCommentText"></p>
   </section>
   ```
3. 修改現有的 `fetch POST /api/analyze` 邏輯：
   - 若 checkbox 已勾選，URL 改為 `/api/analyze?aiComment=true`
   - response 的 `aiComment` 若非 null，顯示 `#aiCommentSection` 並填入 `#aiCommentText`
   - 若 `aiComment` 為 null，隱藏 `#aiCommentSection`
4. 送出時（等待 LLM 回應期間）可在 `#aiCommentText` 顯示「AI 解讀生成中…」loading 文字

**完成判斷：** 手動在瀏覽器勾選「AI 口語解讀」並送出，若後端有設定 LLM 則顯示解讀文字；未勾選時行為與 M4 一致

---

## 測試指令

```bash
# 單元測試（全部）
npm test

# 只跑 M5 相關測試
node --test test/adapter.test.js

# 既有測試確認不破壞（重要）
node --test test/api.test.js

# 手動驗收：不帶 aiComment（應回傳 null）
curl -s -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"phone":"0936102682"}' | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); console.log(JSON.parse(d).aiComment)"

# 手動驗收：帶 aiComment=true（需 .env 設定 LLM_PROVIDER=openai 及 key）
curl -s -X POST "http://localhost:3000/api/analyze?aiComment=true" \
  -H "Content-Type: application/json" \
  -d '{"phone":"0936102682"}' | node -e "process.stdin.resume(); let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>console.log(JSON.parse(d).aiComment))"
```
