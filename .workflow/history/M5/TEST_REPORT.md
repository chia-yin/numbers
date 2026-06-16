RESULT: PASS

# M5 QA Test Report

## 新增/補強測試

- 新增 `test/m5.openai-adapter.test.js`
  - 驗證 `openaiAdapter.generateComment()` 會送出 OpenAI-compatible request。
  - 驗證 prompt placeholder 已被替換，不會把 `{{phone}}` 等原樣送出。
  - 驗證 `OPENAI_BASE_URL`、`OPENAI_MODEL` 預設值。
  - 驗證 provider HTTP 非 2xx 時會 throw，交由上層 adapter 降級。
- 補強 `test/m5.qa.test.js`
  - 新增 `?aiComment=true` 但未設定 `LLM_PROVIDER` 時，mounted Express route 回 HTTP 200 且 `aiComment:null`，並確認不呼叫 provider。
- 納入既有/本次 M5 測試：
  - `test/adapter.test.js`
  - `test/m5.qa.test.js`
  - `test/m5.openai-adapter.test.js`
  - 既有回歸 `npm test`

## 測試指令與結果

```bash
node --test test/m5.qa.test.js
```

結果：✅ 6 passed / 0 failed。

```bash
node --test test/adapter.test.js test/m5.openai-adapter.test.js test/api.test.js
```

結果：✅ 14 passed / 0 failed。

```bash
npm test
```

結果：✅ 63 passed / 0 failed。

## 驗收標準逐條驗證

| AC | 結果 | 證據 |
|---|---|---|
| AC1 `LLM_PROVIDER` 未設時，`POST /api/analyze` 回傳 `aiComment: null`，HTTP 200 | ✅ | `node --test test/m5.qa.test.js` 通過：`m5: aiComment=true without LLM_PROVIDER returns aiComment null with HTTP 200`。 |
| AC2 `?aiComment=true` 且 `LLM_PROVIDER=openai` 時，`aiComment` 為非空字串 | ✅ | `test/m5.qa.test.js` 使用 mock fetch 驗證 route 回傳 `這是一段測試用的口語解讀。`；`test/m5.openai-adapter.test.js` 驗證 OpenAI-compatible request 與回傳 content。 |
| AC3 `?aiComment=false` 或無 query param 時，不呼叫 LLM | ✅ | `test/m5.qa.test.js` 通過：設定 `LLM_PROVIDER=openai` 並讓 fetch 被呼叫就 throw，`/api/analyze` 與 `/api/analyze?aiComment=false` 皆 HTTP 200 且 `aiComment:null`。 |
| AC4 openaiAdapter 呼叫失敗時，`aiComment` 回傳 `null`，不讓 `/api/analyze` 報 500 | ✅ | `test/m5.qa.test.js` 通過：mock fetch throw `network down`，`/api/analyze?aiComment=true` 回 HTTP 200 且 `aiComment:null`。 |
| AC5 `prompts/phone-comment.txt` 存在，且包含全部 4 個 placeholder | ✅ | `grep -c '{{' prompts/phone-comment.txt` 輸出 `4`；M5 測試也逐一檢查 `{{phone}}`、`{{fiveGrid}}`、`{{score}}`、`{{extended}}`。 |
| AC6 `.env.example` 包含 `LLM_PROVIDER`、`OPENAI_API_KEY`、`OPENAI_BASE_URL`、`OPENAI_MODEL` | ✅ | `grep -c 'OPENAI' .env.example` 輸出 `3`；M5 測試也逐一檢查 4 個 env key。 |
| AC7 `npm test` 全綠 | ✅ | `npm test` 結果：63 passed / 0 failed。 |
| AC8 設定真實 `.env` 後 curl `?aiComment=true` 回傳非 null 字串 | ⚠️ 無法驗證(環境限制) | 本環境沒有真實 OpenAI-compatible API key；且直接 curl localhost 被沙箱擋住：`Immediate connect fail for 127.0.0.1: Operation not permitted`。已用 mock OpenAI integration test 覆蓋 API 行為。 |

## 失敗項目

無程式行為失敗。可自動驗證項目均通過。

## ⚠️ 無法驗證(環境限制)

- AC8 的真實 LLM 呼叫需要有效 `.env`：

```bash
LLM_PROVIDER=openai
OPENAI_API_KEY=<real key>
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
```

- 本次嘗試用 curl 連本機服務時，工具沙箱回應：

```text
Immediate connect fail for 127.0.0.1: Operation not permitted
curl: (7) Failed to connect to 127.0.0.1 port 3010
```

## Demo 步驟

```bash
npm start
```

1. 開啟 `http://localhost:3000`。
2. 輸入 `phone=0936102682`、`groups=3-3-4`。
3. 不勾選「AI 口語解讀」送出，應維持既有五格分析行為。
4. 設定真實 LLM `.env` 後，勾選「AI 口語解讀」送出，結果區底部應顯示一段繁體中文口語解讀。
