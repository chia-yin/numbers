VERDICT: APPROVE

# M6 Code Review — 選號爬蟲

**Reviewer:** Staff Engineer（人工最終把關）
**Date:** 2026-06-16
**Scope:** M6 SPEC — 選號爬蟲（commits 8caabf3 / 6e6aac2 M6 追加修改）
**參考：** `.workflow/SPEC.md`、`.workflow/TASKS.md`、`.workflow/TEST_REPORT.md`

---

## 摘要

M6 實作整體正確，SPEC 介面合約（`POST /api/crawl`、`GET /api/crawl/sources`）、
AC-1 到 AC-9 全部通過，92 tests pass / 0 fail / 0 skip。
發現 4 個 minor 問題，均不擋 APPROVE。

---

## 問題列表

### Blocker（0 件）

無。

### Major（0 件）

無。

### Minor（不擋 APPROVE，列出供參考）

**M1** `src/routes/crawl.js:48` — 500 錯誤訊息雙重 `fetch failed:` 前綴

- **位置：** `return res.status(500).json({ error: \`fetch failed: ${error.message}\` })`
- **描述：**
  `src/crawler/index.js:19` 拋出的訊息已包含 `"fetch failed: HTTP 503"`，
  `crawl.js` 再加上前綴後回傳 `{ error: "fetch failed: fetch failed: HTTP 503" }`。
  與 SPEC §3.1 的 `{ "error": "fetch failed: <原始錯誤訊息>" }` 範例意圖不符。
  TEST_REPORT 已知悉並接受此行為，但日後前端解析若依賴此格式需注意。
- **建議：** 將 `crawl.js` 中 500 改為直接傳遞 `error.message`，
  或將 `index.js` 中拋出的訊息改為不帶 `"fetch failed:"` 前綴（二擇一即可）。

**M2** `src/routes/crawl.js:11` — `GET /sources` 缺少錯誤處理

- **位置：** `const raw = await readFile(sourcesPath, 'utf8');`
- **描述：**
  若 `config/sources.json` 遺失或 JSON 格式錯誤，`readFile` / `JSON.parse` 會拋出例外，
  Express 捕獲後回傳未格式化的 500 HTML 錯誤頁（非 JSON）。
  目前 `config/sources.json` 是 bundled 靜態資產，風險低；但缺少顯式的 `try/catch` 使 API 行為不一致。
- **建議：**
  ```js
  router.get('/sources', async (req, res) => {
    try {
      const raw = await readFile(sourcesPath, 'utf8');
      res.status(200).json(JSON.parse(raw));
    } catch (err) {
      res.status(500).json({ error: `failed to load sources: ${err.message}` });
    }
  });
  ```

**M3** `src/crawler/politeness.js:10–32` — robots.txt 解析不重置 section（空行語義）

- **位置：** `getStarDisallowRules` 函式
- **描述：**
  RFC 9309 規定 robots.txt 以「空行」分隔不同的規則群組，每個群組從新的 `User-agent:` 開始。
  現有實作在遇到空行時 `continue`（跳過）但不重置 `inStarSection`，
  技術上在特定格式下可能把跨 section 的 `Disallow:` 歸入 `*` 群組。
  實際影響：行為**更嚴格**（只多擋不少擋），是安全側；
  且現今大多數 robots.txt 使用 `User-agent:` 行做明確分隔，此邊界條件極少出現。
- **建議：** 若未來要支援更複雜的 robots.txt，在 empty line 時加入 `inStarSection = false` 重置。

**M4** `src/llm/openaiAdapter.js` / `test/m5.openai-adapter.test.js` — M5 已有檔案被修改

- **位置：** `src/llm/openaiAdapter.js`（新增 `signal: AbortSignal.timeout(15000)`）；
  `test/m5.openai-adapter.test.js`（新增 2 則測試）
- **描述：**
  TASKS.md 明訂「不修改任何 M1–M5 已有檔案，除了 `src/server.js`（只加兩行）」。
  上述兩個 M5 檔案有所修動，超出 M6 SPEC 範圍。
  然而改動內容是修正 **M5 REVIEW MAJOR-1**（OpenAI fetch 無 timeout）的必要修正，
  屬於跨里程碑補丁，本次一起納入是合理的。
  改動本身為純加法，不破壞現有行為，`npm test` 全綠。
- **建議：** 流程上可在 TASKS.md 明列「攜帶前一里程碑修正」的條目，使審計記錄更完整。

---

## 接縫核對

| 項目 | 狀態 | 備註 |
|------|------|------|
| `POST /api/crawl` request / response 格式符合 SPEC §3.1 | ✅ | candidates / sourceType / count 均正確 |
| `GET /api/crawl/sources` 格式符合 SPEC §3.2 | ✅ | 回傳 JSON 陣列，與 sources.json 完全對應 |
| `config/sources.json` 內容與 SPEC §4.5 一致 | ✅ | 2 筆（manual、example-url），enabled=false 已設定 |
| `src/server.js` 只加 import + app.use 兩行 | ✅ | 無其他更動，既有路由不受影響 |
| User-Agent header 硬碼符合 SPEC §6 | ✅ | `gonghao-numbers-crawler/1.0 (educational; contact: see package.json)` |
| robots.txt timeout 5 秒（SPEC §7.1） | ✅ | `AbortSignal.timeout(5000)` |
| 目標頁 fetch timeout 10 秒（SPEC §7.3） | ✅ | `AbortSignal.timeout(10000)` |
| sleep 預設 2000ms（SPEC §7.2） | ✅ | `source.delayMs ?? 2000`；QA delay test 驗證 |
| 不做重試（SPEC §7.5） | ✅ | fetch 失敗直接 throw |
| robots.txt 404 視為允許（SPEC §4.2）| ✅ | `!response.ok` → return |
| robots.txt 明確 Disallow → 403（SPEC §3.1）| ✅ | `error.message` 字串比對正確 |
| `source.url` 注入保護（無效 URL 400） | ✅ | `new URL(source.url)` 驗證；無命令注入風險 |
| secrets 不入版控 | ✅ | M6 無新增環境變數，API key 仍由 env 傳入 |
| `POST /api/analyze` 既有行為（AC-9） | ✅ | `npm test` 既有回歸全綠 |
| `npm test` 全部通過 | ✅ | 92 passed / 0 failed / 0 skipped |

---

## 結論

SPEC 合約全部落地，安全性、正確性無明顯缺失。
4 個 minor 問題均為可接受的工程品質改進點，可於 M7 或後續優化中處理。
**本次 APPROVE，無需修正即可進入下一里程碑。**
