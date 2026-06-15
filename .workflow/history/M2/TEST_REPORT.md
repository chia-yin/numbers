RESULT: PASS

# TEST REPORT — M2 五格計算引擎

## 測試範圍

- 規格來源：`.workflow/SPEC.md`
- 任務測試指令來源：`.workflow/TASKS.md`
- 新增測試檔：`test/m2.qa.test.js`
- 未修改實作程式碼

## 自動化測試結果

✅ `npm test` 全綠，exit code 0。

指令：

```bash
npm test
```

關鍵輸出：

```text
tests 20
pass 20
fail 0
duration_ms 150.197458
```

本次新增 QA 測試覆蓋：

- 完整黃金案例回傳物件 deepEqual
- 預設 `[3,3,4]` 台灣手機 10 碼全零號碼
- `splitGroups("12345", [3,3,3])` 錯誤訊息語意
- `toLastDigit` 與 `toWuxing` 0–9 邊界表、-1/10 超界
- 函式同步、可重入、不 mutate `groupConfig`
- engine 模組維持 ESM，未匯入 fs/http/express/fetch 等 I/O 或 server library

## 驗收標準逐條驗證

1. ✅ `npm test` 全綠，包含既有 `test/smoke.test.js` 與新增/現有 calculator 測試

證據：

```text
✔ smoke: server module exports app
✔ smoke: basic assertion
✔ golden: analyze("036102682", [3,3,3])
✔ M2 QA: golden analyze result matches the full published data model exactly
✔ M2 QA: default Taiwan mobile grouping handles a 10-digit all-zero number
ℹ tests 20
ℹ pass 20
ℹ fail 0
```

2. ✅ `analyze("036102682", [3,3,3])` 與黃金測試表格完全一致

證據指令：

```bash
node --input-type=module -e "import { analyze } from './src/engine/calculator.js'; console.log(JSON.stringify(analyze('036102682',[3,3,3]), null, 2));"
```

觀察結果摘要：

```json
{
  "groups": ["036", "102", "682"],
  "groupSums": { "n1": 9, "n2": 3, "n3": 16 },
  "fiveGrid": {
    "總格": { "value": 28, "digit": 8, "wuxing": "金" },
    "天格": { "value": 10, "digit": 0, "wuxing": "水" },
    "人格": { "value": 12, "digit": 2, "wuxing": "木" },
    "地格": { "value": 19, "digit": 9, "wuxing": "水" },
    "外格": { "value": 17, "digit": 7, "wuxing": "金" }
  },
  "extended": {
    "子息": { "value": 27, "digit": 7, "wuxing": "金" },
    "健康": { "value": 36, "digit": 6, "wuxing": "土" },
    "配偶": { "value": 22, "digit": 2, "wuxing": "木" },
    "朋友": { "value": 31, "digit": 1, "wuxing": "木" }
  }
}
```

3. ✅ `analyze("0000000000", [3,3,4])` 不拋錯，能正常計算

證據指令：

```bash
node --input-type=module -e "import { analyze } from './src/engine/calculator.js'; const r = analyze('0000000000',[3,3,4]); console.log(JSON.stringify({groups:r.groups, groupSums:r.groupSums, fiveGrid:r.fiveGrid, extended:r.extended}, null, 2));"
```

觀察結果：

```json
{
  "groups": ["000", "000", "0000"],
  "groupSums": { "n1": 0, "n2": 0, "n3": 0 },
  "fiveGrid": {
    "總格": { "value": 0, "digit": 0, "wuxing": "水" },
    "天格": { "value": 1, "digit": 1, "wuxing": "木" },
    "人格": { "value": 0, "digit": 0, "wuxing": "水" },
    "地格": { "value": 0, "digit": 0, "wuxing": "水" },
    "外格": { "value": 1, "digit": 1, "wuxing": "木" }
  },
  "extended": {
    "子息": { "value": 2, "digit": 2, "wuxing": "木" },
    "健康": { "value": 1, "digit": 1, "wuxing": "木" },
    "配偶": { "value": 1, "digit": 1, "wuxing": "木" },
    "朋友": { "value": 0, "digit": 0, "wuxing": "水" }
  }
}
```

4. ✅ `splitGroups("12345", [3,3,3])` 拋出 `Error`

證據指令：

```bash
node --input-type=module -e "import { splitGroups } from './src/engine/calculator.js'; try { splitGroups('12345',[3,3,3]); console.log('NO_ERROR'); process.exitCode = 1; } catch (error) { console.log(error.name + ': ' + error.message); }"
```

輸出：

```text
Error: 號碼長度與分組設定不符
```

5. ✅ 所有函式為純函式（無全域狀態、無 I/O、無非同步）

證據：

- `test/m2.qa.test.js` 驗證 `analyze` 重複呼叫結果一致、未改動傳入的 `groupConfig`。
- `test/m2.qa.test.js` 驗證主要函式回傳值不是 `Promise`。
- 靜態檢查 `src/engine/calculator.js` 未匯入 `fs`、`http`、`express`，也未呼叫 `fetch`。

指令摘要：

```bash
node --input-type=module -e "import * as calculator from './src/engine/calculator.js'; console.log(Object.keys(calculator).sort().join(',')); console.log(calculator.analyze('036102682',[3,3,3]) instanceof Promise);"
```

輸出：

```text
analyze,calcExtended,calcFiveGrid,splitGroups,sumGroup,toLastDigit,toWuxing
false
```

6. ✅ 所有新增程式碼使用 ESM (`import`/`export`)，與 `package.json` `"type": "module"` 一致

證據：

- `package.json` 已設定 `"type": "module"`。
- `src/engine/groupConfig.js` 使用 `export const DEFAULT_GROUP_CONFIG = [3, 3, 4];`
- `src/engine/calculator.js` 使用 ESM import/export。
- `test/m2.qa.test.js` 使用 ESM import。

## 失敗項目

無。

## 無法驗證（環境限制）

無。本里程碑為純計算引擎，無需真實瀏覽器、外部服務或人工視覺驗證。

## Demo 步驟

1. 安裝依賴：

```bash
npm install
```

2. 跑完整測試：

```bash
npm test
```

3. 手動查看黃金案例：

```bash
node --input-type=module -e "import { analyze } from './src/engine/calculator.js'; console.log(JSON.stringify(analyze('036102682',[3,3,3]), null, 2));"
```
