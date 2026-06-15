VERDICT: APPROVE

# REVIEW — M2: 五格計算引擎

**審查日期**：2026-06-15
**審查範圍**：`src/engine/groupConfig.js`、`src/engine/calculator.js`、`test/calculator.test.js`、`test/m2.qa.test.js`

---

## 摘要

實作邏輯正確，公式與 SPEC 完全一致，黃金測試全綠，無安全疑慮，無超出範圍的改動。

---

## 逐項核對

### 正確性

- `splitGroups`：長度驗證正確（`reduce` 總和比對），切片邏輯無誤。
- `sumGroup`：展開字元逐一 `Number(char)` 相加，語意清晰。
- `calcFiveGrid`：五格公式（總格/天格/人格/地格/外格）與 SPEC 2.3 完全對應。
- `toLastDigit`：`n % 10`，符合規格。
- `toWuxing`：邊界檢查 `digit < 0 || digit > 9`，對照表對應正確（含 0→水、9→水）。
- `calcExtended`：四個延伸格公式與 SPEC 2.6 對應正確。
- `analyze`：正確組合所有子函式，`enrichGrid` 輔助函式語意清晰，回傳結構符合 SPEC 3.3 資料模型。
- `server.js`：未被修改（符合 SPEC 不做事項）。

### 安全性

- 無 secrets 進入版控。
- 所有模組為純函式，無 I/O、無全域狀態、無非同步（已由 `m2.qa.test.js` 靜態驗證）。
- 無注入風險（純字串切分，無 eval/動態執行）。

### 一致性

- 全程使用 ESM (`import`/`export`)，與 `package.json "type": "module"` 一致。
- `enrichGrid` 為未匯出的內部輔助函式，符合「只匯出 SPEC 要求的函式」原則。

### 測試覆蓋

- `test/calculator.test.js`：覆蓋黃金案例、全零邊界、長度不符錯誤、toWuxing 超界。
- `test/m2.qa.test.js`（QA agent 額外新增）：deepEqual 完整資料模型、預設分組、error message 語意、0–9 邊界表、重入性、不 mutate config、ESM 靜態檢查，覆蓋品質高。

---

## 問題列表

### minor

1. **`test/m2.qa.test.js` 超出 SPEC 規定範圍**
   - 檔案：`test/m2.qa.test.js`（整個檔案）
   - SPEC 3 節僅要求新增 `test/calculator.test.js`，QA agent 額外新增了 `m2.qa.test.js`。
   - 影響：額外增加測試覆蓋，為良性超出範圍。測試不影響功能正確性，不構成阻擋。
   - 建議：在 TASKS.md 或下一個 SPEC 里程碑中補記此測試檔的存在，避免後續 agent 誤刪。

2. **`analyze` 未驗證 `groupConfig.length >= 3`**
   - 檔案：`src/engine/calculator.js:63–65`
   - 若傳入 `groupConfig = [10]`，`groups[1]` 與 `groups[2]` 為 `undefined`，`sumGroup(undefined)` 會拋出非預期錯誤而非語意明確的 Error。
   - SPEC 未要求此驗證，屬超出範圍的邊界案例，暫不擋 APPROVE。
   - 建議：M4 串接 API 時，在輸入驗證層處理（API 邊界驗證比引擎內部更適合）。

3. **`toLastDigit` 對負數回傳負值**
   - 檔案：`src/engine/calculator.js:33`
   - JS 的 `%` 對負數保留符號（`-1 % 10 === -1`），隨後 `toWuxing(-1)` 會正確拋出 Error（fail-fast），不會靜默錯誤。
   - SPEC 明示參數為「非負整數」，行為符合規格，不構成 bug。列出供後續 M3 注意。
