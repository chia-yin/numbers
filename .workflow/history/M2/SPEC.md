# SPEC — M2: 五格計算引擎

> 本文件為 M2 里程碑的完整實作規格。後續執行的 agent 看不到任何對話紀錄，所有上下文均已寫入此文件。

---

## 一、功能目標與範圍

### 目標
實作五格數字學計算引擎，以**純函式（pure functions）**封裝全部計算邏輯，無副作用、無 I/O，並通過 FORMULA.md 第七節的黃金測試範例。

### 本里程碑做什麼
- 新增 `src/engine/calculator.js`：所有計算純函式
- 新增 `src/engine/groupConfig.js`：預設分組設定
- 新增 `test/calculator.test.js`：黃金測試 + 邊界案例

### 本里程碑**不做**什麼
- 不實作五行吉凶判定（M3 負責）
- 不實作 API 路由（M4 負責）
- 不實作前端 UI（M4 負責）
- 不引入任何外部 npm 套件（使用 Node.js 20 內建能力）
- 不修改 `src/server.js`

---

## 二、公式規格（權威依據：reference/FORMULA.md）

### 2.1 輸入與分組

- 輸入：電話號碼字串（純數字）
- 按 `groupConfig`（整數陣列）切分，每個元素代表該組的字元長度
- 驗證：`phoneNumber.length` 必須等於 `groupConfig` 各元素的總和，否則拋出 `Error`

**預設分組（台灣手機 10 碼，groupConfig.js 的預設值）：** `[3, 3, 4]`
- 範例：`"0936102682"` → `["093", "610", "2682"]`

**黃金測試使用的分組：** `[3, 3, 3]`（9 碼）
- 輸入：`"036102682"`
- 切分結果：`["036", "102", "682"]`

### 2.2 每組加總（sumGroup）

- 將組內每個字元視為整數相加
- `"036"` → `0+3+6 = 9`
- `"102"` → `1+0+2 = 3`
- `"682"` → `6+8+2 = 16`

### 2.3 五格公式

設 N1、N2、N3 為三組加總後的整數值：

| 格名 | 公式 | 影響權重 |
|------|------|---------|
| 總格 | N1 + N2 + N3 | 50% |
| 天格 | N1 + 1 | 5% |
| 人格 | N1 + N2 | 15% |
| 地格 | N2 + N3 | 10% |
| 外格 | N3 + 1 | 25% |

> 注意：`calcFiveGrid` 回傳的是**未取個位**的原始整數值，由呼叫端使用 `toLastDigit` 取個位。

### 2.4 取個位數（toLastDigit）

```
toLastDigit(n) = n % 10
```

- 結果範圍：0–9
- 此函式不做四捨五入，純取餘數

### 2.5 個位 → 五行對應（toWuxing）

| 個位數 | 五行 |
|--------|------|
| 1, 2 | 木 |
| 3, 4 | 火 |
| 5, 6 | 土 |
| 7, 8 | 金 |
| 9, 0 | 水 |

### 2.6 延伸關係格（calcExtended）

| 格名 | 公式（以五格原始值計算，未取個位） |
|------|----------------------------------|
| 子息 | 天格 + 外格 |
| 健康 | 外格 + 地格 |
| 配偶 | 天格 + 人格 |
| 朋友 | 人格 + 地格 |

---

## 三、檔案規格

### 3.1 `src/engine/groupConfig.js`

```js
// ESM 模組（package.json 已設 "type": "module"）
export const DEFAULT_GROUP_CONFIG = [3, 3, 4]; // 台灣手機 10 碼
```

### 3.2 `src/engine/calculator.js`

匯出以下純函式（ESM named exports）：

#### `splitGroups(phoneNumber, groupConfig)`
- 參數：`phoneNumber: string`，`groupConfig: number[]`
- 驗證：若 `phoneNumber.length !== groupConfig.reduce((a,b)=>a+b,0)` → `throw new Error('號碼長度與分組設定不符')`
- 回傳：`string[]`，長度 === `groupConfig.length`
- 範例：`splitGroups("036102682", [3,3,3])` → `["036","102","682"]`

#### `sumGroup(group)`
- 參數：`group: string`（純數字字串）
- 回傳：`number`（整數）
- 範例：`sumGroup("036")` → `9`

#### `calcFiveGrid(n1, n2, n3)`
- 參數：三個整數（各組加總值）
- 回傳：`{ 總格: number, 天格: number, 人格: number, 地格: number, 外格: number }`（各為整數，**未取個位**）
- 範例：`calcFiveGrid(9,3,16)` → `{ 總格:28, 天格:10, 人格:12, 地格:19, 外格:17 }`

#### `toLastDigit(n)`
- 參數：`n: number`（非負整數）
- 回傳：`number`（0–9）
- 範例：`toLastDigit(28)` → `8`，`toLastDigit(10)` → `0`

#### `toWuxing(digit)`
- 參數：`digit: number`（0–9）
- 回傳：`'木'|'火'|'土'|'金'|'水'`
- 超出 0–9 範圍：`throw new Error('digit 必須在 0–9')`

#### `calcExtended(fiveGrid)`
- 參數：`fiveGrid` 物件，需含 `{ 天格, 人格, 地格, 外格 }`（原始整數值，非個位）
- 回傳：`{ 子息: number, 健康: number, 配偶: number, 朋友: number }`（**未取個位**的整數）
- 範例：`calcExtended({ 天格:10, 人格:12, 地格:19, 外格:17 })` → `{ 子息:27, 健康:36, 配偶:22, 朋友:31 }`

#### `analyze(phoneNumber, groupConfig?)`
- 參數：
  - `phoneNumber: string`
  - `groupConfig?: number[]`（選填，預設使用 `DEFAULT_GROUP_CONFIG`，即 `[3,3,4]`）
- 回傳完整結果物件（見下方資料模型）
- 內部呼叫上述所有函式，組合結果

### 3.3 資料模型（`analyze()` 回傳格式）

```json
{
  "input": "036102682",
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

欄位說明：
- `value`：原始整數（未取個位）
- `digit`：個位數（`value % 10`）
- `wuxing`：五行屬性（由 `toWuxing(digit)` 得出）

---

## 四、測試規格

### 4.1 測試框架
- `node:test` + `node:assert/strict`（Node.js 20 內建，**不需安裝任何套件**）
- 執行指令：`npm test`（package.json 已設定 `"test": "node --test test/**/*.test.js"`）

### 4.2 黃金測試案例（必測，逐一 assert）

輸入：`analyze("036102682", [3,3,3])`

| 項目 | 期望值 |
|------|--------|
| groups | `["036","102","682"]` |
| groupSums.n1 | `9` |
| groupSums.n2 | `3` |
| groupSums.n3 | `16` |
| fiveGrid.總格.value | `28` |
| fiveGrid.總格.digit | `8` |
| fiveGrid.總格.wuxing | `"金"` |
| fiveGrid.天格.value | `10` |
| fiveGrid.天格.digit | `0` |
| fiveGrid.天格.wuxing | `"水"` |
| fiveGrid.人格.value | `12` |
| fiveGrid.人格.digit | `2` |
| fiveGrid.人格.wuxing | `"木"` |
| fiveGrid.地格.value | `19` |
| fiveGrid.地格.digit | `9` |
| fiveGrid.地格.wuxing | `"水"` |
| fiveGrid.外格.value | `17` |
| fiveGrid.外格.digit | `7` |
| fiveGrid.外格.wuxing | `"金"` |
| extended.子息.value | `27` |
| extended.子息.wuxing | `"金"` |
| extended.健康.value | `36` |
| extended.健康.wuxing | `"土"` |
| extended.配偶.value | `22` |
| extended.配偶.wuxing | `"木"` |
| extended.朋友.value | `31` |
| extended.朋友.wuxing | `"木"` |

### 4.3 邊界案例

| 案例 | 輸入 | 期望行為 |
|------|------|---------|
| 全零號碼 | `analyze("000000000", [3,3,3])` | 正常回傳，所有 value=1(天/外格)+0，wuxing 依公式正確 |
| 長度不符 | `analyze("12345", [3,3,3])` | 拋出 `Error`，message 包含「長度」或「不符」 |
| toWuxing 超界 | `toWuxing(10)` | 拋出 `Error` |

---

## 五、驗收標準（Acceptance Criteria）

1. `npm test` 全綠（exit code 0），包含既有 `test/smoke.test.js` 與新增的 `test/calculator.test.js`
2. `analyze("036102682", [3,3,3])` 的回傳結果與第四節黃金測試表格完全一致
3. `analyze("0000000000", [3,3,4])` 不拋錯，能正常計算
4. `splitGroups("12345", [3,3,3])` 拋出 `Error`
5. 所有函式為純函式（無全域狀態、無 I/O、無非同步）
6. 所有新增程式碼使用 ESM (`import`/`export`)，與 package.json `"type": "module"` 一致
