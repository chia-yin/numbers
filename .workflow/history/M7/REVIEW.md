VERDICT: APPROVE

# Code Review — M7: 好號碼篩選與排名頁

審查者：Staff Engineer
日期：2026-06-16
基準文件：`.workflow/SPEC.md`、`.workflow/TASKS.md`、`.workflow/TEST_REPORT.md`

---

## 總覽

實作完整度高，所有 AC 均有測試覆蓋，核心邏輯正確，無 blocker 或 major 問題。
以下列出 minor 問題供後續追蹤。

---

## 問題列表

### minor-1｜API 回應欄位名稱與 SPEC 範例不一致

**檔案**：`src/routes/analyze.js:48`、`SPEC.md:111`

`analyzeHandler` 的 `transformResult` 回傳的是 `input` 欄位（`input: result.input`），但 SPEC 3.1 的 Response 範例顯示 `"phone": "0987654321"`。

影響：
- `rank.html:274` 以 `item.phone ?? item.input` 做 fallback，目前不會出錯。
- `test/m7.qa-acceptance.test.js:123` 同樣使用 `item.phone ?? item.input`，代表 QA 已知此差異。

建議：將 SPEC.md 範例的 `phone` 欄位修正為 `input`，或在 `rankHandler` 顯式做欄位重新命名（`phone: item.input`）使 API 合約明確，避免未來消費方混淆。

---

### minor-2｜`sources.js` 未處理檔案讀取例外

**檔案**：`src/routes/sources.js:29–30`

`readFileSync` 與 `JSON.parse` 皆有可能拋出（`sources.json` 不存在、JSON 格式錯誤）。Express 會捕捉到並回傳 500，但預設的錯誤 middleware 可能把 stack trace（含檔案絕對路徑）包進回應，造成內部資訊外洩。

建議：
```js
router.get('/', (req, res) => {
  try {
    const raw = readFileSync(sourcesPath, 'utf8')
    const allSources = JSON.parse(raw)
    // ...
    res.status(200).json({ sources })
  } catch {
    res.status(500).json({ error: 'failed to load sources' })
  }
})
```

---

### minor-3｜進度提示未達 SPEC 範例的逐筆更新

**檔案**：`public/rank.html:350`、`SPEC.md:178`

SPEC 載入提示範例為「分析中... 50/100」，暗示逐筆進度。實作為單一 `POST /api/rank` 呼叫，只顯示總筆數（`分析中…（共 N 筆）`），無法做逐筆更新。

這在架構上無法避免（批次 API 設計），可接受，但若未來有效能需求可考慮 streaming 或分批送出。目前行為不影響功能正確性。

---

### minor-4｜前端 `groups` 欄位缺乏輸入驗證

**檔案**：`public/rank.html:345–347`

`groupsInput.value.split('-').map((part) => Number(part.trim()))` 在輸入空字串或非數字片段時，會產生 `NaN`，後端 `analyzeHandler` 會回傳 400，但前端只顯示通用錯誤訊息，使用者無法得知是分組規則格式錯誤。

建議在送出前檢查 `groups.every(Number.isFinite)` 並提早顯示提示，提升 UX。

---

## 合規性確認

| 項目 | 結果 |
|------|------|
| SPEC 3.1 驗證規則（400 三種情境）| ✅ `src/routes/rank.js:12–31` |
| SPEC 3.1 `filtered` 計算定義 | ✅ `successCount - ranked.length` 與 SPEC 一致 |
| SPEC 3.1 `aiComment` 從結果移除 | ✅ 解構賦值剔除 `rank.js:43` |
| SPEC 3.2 `GET /api/sources` 過濾邏輯 | ✅ `sources.js:33` |
| SPEC 3.2 `note`/`enabled`/`description` 不外露 | ✅ `toPublicSource` 白名單 |
| SPEC 4.1 crawl request 格式 | ✅ `rank.html:316–318` |
| SPEC 4.2 `index.html` ?phone 自動送出 | ✅ `index.html:203–208` |
| 不修改 `/api/analyze` 或 `/api/crawl` | ✅ 未動到 |
| 不實作資料庫/持久化/認證 | ✅ |
| `npm test` 全綠（103 tests pass） | ✅ TEST_REPORT |
| 無 secrets 進版控 | ✅ |
