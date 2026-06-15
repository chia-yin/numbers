STATUS: DONE

# TASKS — M2: 五格計算引擎

> 每項任務可在 30 分鐘內獨立完成。執行角色：僅 [BE]（純後端，無前端/美術/INFRA 任務）。
> 完整介面規格請參閱 `.workflow/SPEC.md`。

---

## 任務清單

- [x] [BE] Task 1 — 建立 `src/engine/groupConfig.js`
  - **檔案**：新建 `src/engine/groupConfig.js`
  - **做什麼**：匯出常數 `DEFAULT_GROUP_CONFIG = [3, 3, 4]`（台灣手機 10 碼預設分組）
  - **完成判斷**：檔案存在，可 `import { DEFAULT_GROUP_CONFIG } from './groupConfig.js'` 不報錯

- [x] [BE] Task 2 — 實作 `splitGroups` 與 `sumGroup`
  - **檔案**：新建 `src/engine/calculator.js`
  - **做什麼**：
    - 實作並匯出 `splitGroups(phoneNumber, groupConfig)`：依 groupConfig 切分字串，長度不符則拋錯
    - 實作並匯出 `sumGroup(group)`：將字串各字元視為整數相加
  - **規格**：見 SPEC.md 第三節 3.2
  - **完成判斷**：`splitGroups("036102682",[3,3,3])` → `["036","102","682"]`；`sumGroup("682")` → `16`；`splitGroups("12345",[3,3,3])` 拋 Error

- [x] [BE] Task 3 — 實作 `toLastDigit` 與 `toWuxing`
  - **檔案**：`src/engine/calculator.js`（接續 Task 2）
  - **做什麼**：
    - 實作並匯出 `toLastDigit(n)`：回傳 `n % 10`
    - 實作並匯出 `toWuxing(digit)`：依對照表回傳五行字串，超出 0–9 拋錯
  - **對照表**：1,2→木 / 3,4→火 / 5,6→土 / 7,8→金 / 9,0→水（見 SPEC.md 2.5）
  - **完成判斷**：`toLastDigit(28)` → `8`；`toWuxing(8)` → `"金"`；`toWuxing(0)` → `"水"`；`toWuxing(10)` 拋 Error

- [x] [BE] Task 4 — 實作 `calcFiveGrid` 與 `calcExtended`
  - **檔案**：`src/engine/calculator.js`（接續 Task 3）
  - **做什麼**：
    - 實作並匯出 `calcFiveGrid(n1, n2, n3)`：依公式計算五格原始值（**不取個位**）
    - 實作並匯出 `calcExtended(fiveGrid)`：計算延伸四格原始值（**不取個位**）
  - **公式**：
    - 總格=N1+N2+N3、天格=N1+1、人格=N1+N2、地格=N2+N3、外格=N3+1
    - 子息=天格+外格、健康=外格+地格、配偶=天格+人格、朋友=人格+地格
  - **完成判斷**：`calcFiveGrid(9,3,16)` → `{ 總格:28, 天格:10, 人格:12, 地格:19, 外格:17 }`；`calcExtended({天格:10,人格:12,地格:19,外格:17})` → `{ 子息:27, 健康:36, 配偶:22, 朋友:31 }`

- [x] [BE] Task 5 — 實作 `analyze` 整合函式
  - **檔案**：`src/engine/calculator.js`（接續 Task 4）
  - **做什麼**：
    - 實作並匯出 `analyze(phoneNumber, groupConfig?)`
    - 若 `groupConfig` 未傳，使用 `DEFAULT_GROUP_CONFIG`（從 `groupConfig.js` import）
    - 組合所有子函式，回傳完整結果物件（格式見 SPEC.md 3.3）
    - 結果物件中每個格均含 `{ value, digit, wuxing }` 三欄
  - **完成判斷**：`analyze("036102682",[3,3,3])` 回傳符合 SPEC.md 3.3 範例的物件

- [x] [BE] Task 6 — 撰寫 `test/calculator.test.js`
  - **檔案**：新建 `test/calculator.test.js`
  - **做什麼**：使用 `node:test` + `node:assert/strict`，撰寫以下測試：
    1. **黃金測試**：`analyze("036102682",[3,3,3])` 逐一 assert 所有五格 value/digit/wuxing 與四個延伸格（見 SPEC.md 4.2 完整表格）
    2. **全零號碼**：`analyze("000000000",[3,3,3])` 不拋錯，天格=0+1=1、外格=0+1=1
    3. **長度不符錯誤**：`assert.throws(() => splitGroups("12345",[3,3,3]))`
    4. **toWuxing 超界錯誤**：`assert.throws(() => toWuxing(10))`
  - **注意**：測試檔使用 ESM `import`，路徑為 `'../src/engine/calculator.js'`
  - **完成判斷**：`npm test` 全綠（exit code 0），`test/smoke.test.js` 也須仍然通過

---

## 執行順序建議

Task 1 → Task 2 → Task 3 → Task 4 → Task 5（全在 calculator.js 中，循序完成）→ Task 6（測試）

Task 1–5 必須全部完成後，Task 6 才能驗證。

---

## 測試指令

```bash
# 執行全部測試（含既有 smoke.test.js 與新增 calculator.test.js）
npm test

# 只跑 calculator 測試（開發時快速驗證）
node --test test/calculator.test.js
```

**驗收通過條件**：`npm test` 輸出 `pass` 涵蓋所有 test case，無任何 `fail`，exit code 為 0。
