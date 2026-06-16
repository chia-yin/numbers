VERDICT: APPROVE

# M5 Code Review — LLM Adapter Integration

**Reviewer:** Staff Engineer (automated review)
**Date:** 2026-06-16
**Scope:** M5 SPEC — AI 口語解讀整合

---

## 摘要

整體實作乾淨、符合 SPEC。接縫處（前後端、adapter 分層、測試注入機制）均正確對齊。
全部 AC1–AC7 通過，AC8 因沙箱限制無法自動驗證（已知，屬環境限制非實作問題）。
無 blocker、無 major，列出 5 項 minor 供後續參考。

---

## 逐檔審查

### `src/routes/analyze.js`

- **正確性：** `status === 200 && req.query.aiComment === 'true'` 條件正確。非 200 時（如 400）不呼叫 LLM，response body 不含 `aiComment` 欄位（純錯誤物件），符合預期。
- **範圍：** 改動最小化，僅加 import 與 4 行邏輯，未動 `analyzeHandler` 本體。✅
- **安全：** 無注入風險；`generateComment` 內部已 try/catch，不會讓 handler throw。✅

### `src/llm/adapter.js`

- **正確性：** `_overrideProvider ?? (await resolveProvider())` 邏輯正確。`resolveProvider()` 以 dynamic import 延遲載入 openaiAdapter，避免模組初始化時副作用。✅
- **測試注入：** `_setProviderForTest` 機制符合 SPEC 6 節建議做法。✅

### `src/llm/openaiAdapter.js`

- **正確性：** URL 解析 `new URL('../../prompts/phone-comment.txt', import.meta.url)` 路徑正確（`src/llm/` → 上兩層 → 專案根目錄）。✅
- **Placeholder 替換：** 使用 `replaceAll`（非 regex），符合 SPEC 3.7。✅
- **HTTP 錯誤處理：** 非 2xx 時 `throw new Error`，由 adapter 的 catch 接住回傳 null。✅

### `prompts/phone-comment.txt`

- 包含全部 4 個 placeholder：`{{phone}}`、`{{fiveGrid}}`、`{{score}}`、`{{extended}}`。✅
- 明確指示「不得更改任何數值」、繁體中文、100–200 字、一段話、不提 AI。✅

### `public/index.html`

- `#aiCommentToggle`、`#aiCommentSection`、`#aiCommentText` 均已加入。✅
- 勾選時 URL 正確附加 `?aiComment=true`；未勾選時不附加。✅
- Loading 文字 `AI 解讀生成中…` 在等待期間顯示。✅
- **XSS 安全：** LLM 回傳文字使用 `aiCommentText.textContent`（非 `innerHTML`），正確。✅

### `.env.example`

- 包含 `LLM_PROVIDER`、`OPENAI_API_KEY`、`OPENAI_BASE_URL`、`OPENAI_MODEL`。✅
- 所有 key 值均為空值，無 secrets 誤入版本控制。✅

### 測試檔案

- `test/adapter.test.js`：4 個 AC 測試 + AC5 prompt 檔案檢查 + AC6 .env.example 檢查 + FE HTML 結構驗證，共 7 個。✅
- `test/m5.openai-adapter.test.js`：request 結構驗證、placeholder 替換確認、預設值驗證、非 2xx throw 驗證，共 3 個。✅
- `test/m5.qa.test.js`：6 個整合測試，覆蓋所有 AC。✅

---

## 問題列表

### Minor（不擋 APPROVE）

**M1** `src/llm/adapter.js` — 無錯誤記錄
- **位置：** `adapter.js:22–26`（catch block）
- **描述：** LLM 呼叫失敗時靜默回傳 `null`，無任何日誌輸出。線上環境難以診斷是 key 失效、網路中斷還是 API 限流。
- **建議：** 在 catch 區塊加 `console.error('[LLM]', err.message)` 即可，不影響行為。

**M2** `src/llm/openaiAdapter.js:38` — 未防禦 choices 空陣列
- **位置：** `return data.choices[0].message.content`
- **描述：** 若 OpenAI 回傳 `choices: []`（極少見但合法），存取 `[0]` 會 throw TypeError，最終由 adapter catch 後回傳 null（graceful degradation 仍成立）。但錯誤訊息不夠明確。
- **建議：** `if (!data.choices?.[0]?.message?.content) throw new Error('empty choices')` 讓錯誤訊息更具體；或保持現狀接受 catch 兜底。

**M3** `src/llm/openaiAdapter.js:7` — `input` 的 nullish fallback 不完整
- **位置：** `buildPrompt` 函式
- **描述：** `analysisResult.input ?? ''` 有 fallback，但 `fiveGrid`、`score`、`extended` 若為 `undefined`，`JSON.stringify(undefined)` 會回傳 `undefined`（JS 值），`replaceAll` 會將 placeholder 替換為字串 `"undefined"`。實際上這些欄位在正常流程必定存在，非真實風險。
- **建議：** 保持現狀即可，或加 `?? {}` 確保萬無一失。

**M4** `src/llm/adapter.js` — `_overrideProvider` 為模組層級可變狀態
- **位置：** `adapter.js:1`
- **描述：** 若未來測試改用 `--test-concurrency` 並行執行，共享狀態可能導致 race condition。目前 `node:test` 預設序列執行，`afterEach` 也有清除，實際上安全。
- **建議：** 記錄此限制於測試說明；若未來啟用並行測試需重新評估。

**M5** `public/index.html:119–128` — `innerHTML` 注入 API 回應值
- **位置：** `renderFiveGrid`、`renderExtended` 中的 `tr.innerHTML = [...]`
- **描述：** `grid.wuxing`、`grid.luck`、`grid.symbol`、`grid.relation` 等值以字串插值注入 innerHTML。這些值來自伺服器靜態查找表（非使用者輸入），實際無 XSS 風險，但若未來後端來源改變需注意。
- **建議：** 本里程碑不需改動；後續若有動態內容需評估是否改用 `textContent`。

---

## 接縫核對

| 項目 | 狀態 |
|------|------|
| 前後端 query param 一致（`?aiComment=true`） | ✅ |
| adapter → openaiAdapter import 鏈正確 | ✅ |
| prompts/ 路徑解析（相對 import.meta.url）| ✅ |
| `.env.example` 涵蓋所有 SPEC 3.3 環境變數 | ✅ |
| 無 secrets 進版本控制 | ✅ |
| `aiComment` 在 LLM 未設定或失敗時均為 `null` | ✅ |
| 既有引擎/評分邏輯未被更動（SPEC 2 Out of Scope）| ✅ |
| `npm test` 63 passed / 0 failed | ✅ |
