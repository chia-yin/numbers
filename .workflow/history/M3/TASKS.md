# TASKS — M3: 五行吉凶判定與資料表

STATUS: DONE

> 本文件由架構師撰寫，對象是後續獨立執行的 AI agent（Cursor）。
> 所有介面規格以 `.workflow/SPEC.md` 為準，本文件為執行清單。
> 角色執行順序：ART → BE → FE → INFRA（本 M3 只有 BE 任務）。

---

## 角色說明（本里程碑）

本 M3 為純後端計算邏輯，無畫面、無 HTTP 端點、無部署變更。
只有 `[BE]` 任務，不需要 `[ART]`、`[FE]`、`[INFRA]`。

---

## BE 任務清單

### 任務 1：建立 `src/engine/wuxingJudge.js`（五行生克 + 數理查表核心）

- [x] [BE] 新增 `src/engine/wuxingJudge.js`

  **要做什麼：**
  1. 使用 `createRequire` 載入 `reference/81數理.json`（路徑：`../../reference/81數理.json` 相對於本檔）：
     ```js
     import { createRequire } from 'node:module';
     const require = createRequire(import.meta.url);
     const numerologyData = require('../../reference/81數理.json');
     ```
  2. 實作並 `export` 以下函式（詳見 SPEC.md 第 4、7 節）：

     **`normalizeNumerologyKey(value)`**
     - 輸入任意整數 value
     - 若 value 在 1~81（含），直接回傳 value
     - 否則：`return ((((value - 1) % 80) + 80) % 80) + 1`
     - 回傳值保證在 1~81

     **`lookupNumerology(value)`**
     - 呼叫 `normalizeNumerologyKey(value)` 取得 key
     - 回傳 `numerologyData[String(key)]`，即 `{ symbol, luck, text }`

     **`getWuxingRelation(source, target)`**
     - source = 本體五行（總格），target = 另一格五行
     - 五行字串為 `'木'`/`'火'`/`'土'`/`'金'`/`'水'`
     - 生的循環：木→火→土→金→水→木
     - 剋的循環：木→土→水→火→金→木
     - 回傳字串：`'比和'` / `'X生本體'` / `'本體生X'` / `'X剋本體'` / `'本體剋X'`
     - 邏輯（推薦用 Map 或 object 寫死生/剋對應，避免 if-else 過長）：
       ```
       生: { '木':'火', '火':'土', '土':'金', '金':'水', '水':'木' }
       剋: { '木':'土', '土':'水', '水':'火', '火':'金', '金':'木' }
       ```
       - source === target → '比和'
       - generates[source] === target → '本體生X'
       - generates[target] === source → 'X生本體'
       - restricts[source] === target → '本體剋X'
       - restricts[target] === source → 'X剋本體'

     **`calcWeightedScore(numerologyMap)`**
     - 輸入：`{ 總格: { symbol }, 天格: { symbol }, 人格: { symbol }, 地格: { symbol }, 外格: { symbol } }`
     - symbol → 分數：`'○'` = 2，`'▲'` = 1，`'X'` = 0（其他符號視為 0）
     - 公式：`(總格×0.50 + 外格×0.25 + 人格×0.15 + 地格×0.10 + 天格×0.05) / 2 × 100`
     - 精度：`Math.round(raw * 10) / 10`（小數點後一位）

     **`calcLevel(score)`**
     - score 0~100 → 等級字串
     - `≥ 80` → `'大吉'`；`≥ 60` → `'吉'`；`≥ 40` → `'半吉'`；`≥ 20` → `'凶'`；`< 20` → `'大凶'`

     **`judgeAll(phoneNumber, groupConfig = DEFAULT_GROUP_CONFIG)`**
     - 從 `./calculator.js` import `analyze`；從 `./groupConfig.js` import `DEFAULT_GROUP_CONFIG`
     - 呼叫 `analyze(phoneNumber, groupConfig)` 取得 base result
     - 建構並回傳 SPEC.md 第 5 節的完整 `JudgeResult` 物件：
       - 展開所有 M2 欄位（`input`, `groups`, `groupSums`, `fiveGrid`, `extended`）
       - 新增 `numerology`：對 `fiveGrid` 的五個格各呼叫 `lookupNumerology(格.value)`
       - 新增 `wuxingRelations`：
         - `本體` = `fiveGrid.總格.wuxing`
         - 天格/人格/地格/外格 → 從 `fiveGrid` 取 wuxing，呼叫 `getWuxingRelation(本體, 格.wuxing)`
         - 子息/健康/配偶/朋友 → 從 `extended` 取 wuxing，同上
       - 新增 `score`：呼叫 `calcWeightedScore(numerology)` 和 `calcLevel`
       - 新增 `isPremium`：`numerology.總格.symbol === '○' && numerology.外格.symbol === '○'`

  **完成判斷：** `node --test test/m3.qa.test.js`（下一個任務新增後）全部通過；且本檔不含 `express`/`node:http`/`fetch(`。

---

### 任務 2：新增 `test/m3.qa.test.js`（M3 驗收測試）

- [x] [BE] 新增 `test/m3.qa.test.js`

> 註：`calcWeightedScore` 僅總格為 ○ 的預期值依公式為 50（非 TASKS 草稿中的 25）；全 ○ 時權重合計 105%，以 `Math.min(100, raw)` 符合 SPEC 上限 100。

  **要做什麼：**  
  參考 `test/m2.qa.test.js` 的風格（`import { test } from 'node:test'`；`import assert from 'node:assert/strict'`）。  
  引入以下函式：
  ```js
  import {
    normalizeNumerologyKey,
    lookupNumerology,
    getWuxingRelation,
    calcWeightedScore,
    calcLevel,
    judgeAll,
  } from '../src/engine/wuxingJudge.js';
  import { readFile } from 'node:fs/promises';
  ```

  **Test case 1 — `normalizeNumerologyKey` 邊界**  
  - `normalizeNumerologyKey(1)` === 1  
  - `normalizeNumerologyKey(81)` === 81  
  - `normalizeNumerologyKey(0)` === 80  
  - `normalizeNumerologyKey(82)` === 2  
  - `normalizeNumerologyKey(161)` === 1

  **Test case 2 — `lookupNumerology` 查表**  
  從 `reference/81數理.json` 讀檔取得 data，確認：  
  - `lookupNumerology(1)` deepEqual `data["1"]`  
  - `lookupNumerology(28)` deepEqual `data["28"]`  
  - `lookupNumerology(82)` deepEqual `data["2"]`  
  - 回傳物件有 `symbol`、`luck`、`text` 三個字串欄位

  **Test case 3 — `getWuxingRelation` 生克規則**  
  ```
  getWuxingRelation('木', '木') === '比和'
  getWuxingRelation('木', '火') === '本體生X'
  getWuxingRelation('木', '土') === '本體剋X'
  getWuxingRelation('木', '金') === 'X剋本體'
  getWuxingRelation('木', '水') === 'X生本體'
  getWuxingRelation('金', '水') === '本體生X'
  getWuxingRelation('金', '木') === '本體剋X'
  getWuxingRelation('金', '火') === 'X剋本體'
  getWuxingRelation('金', '土') === 'X生本體'
  ```

  **Test case 4 — `calcWeightedScore` 計算**  
  ```js
  // 全 ○ → 100
  calcWeightedScore({ 總格:{symbol:'○'}, 外格:{symbol:'○'}, 人格:{symbol:'○'}, 地格:{symbol:'○'}, 天格:{symbol:'○'} }) === 100
  // 全 X → 0
  calcWeightedScore({ 總格:{symbol:'X'}, 外格:{symbol:'X'}, 人格:{symbol:'X'}, 地格:{symbol:'X'}, 天格:{symbol:'X'} }) === 0
  // 只有總格 ○ → 0.50/2*100 = 25（其餘 X）
  calcWeightedScore({ 總格:{symbol:'○'}, 外格:{symbol:'X'}, 人格:{symbol:'X'}, 地格:{symbol:'X'}, 天格:{symbol:'X'} }) === 25
  ```

  **Test case 5 — `calcLevel` 閾值**  
  ```
  calcLevel(100) === '大吉'
  calcLevel(80)  === '大吉'
  calcLevel(79.9) === '吉'
  calcLevel(60)  === '吉'
  calcLevel(59.9) === '半吉'
  calcLevel(40)  === '半吉'
  calcLevel(39.9) === '凶'
  calcLevel(20)  === '凶'
  calcLevel(19.9) === '大凶'
  calcLevel(0)   === '大凶'
  ```

  **Test case 6 — `judgeAll` 黃金案例（036-102-682）**  
  呼叫 `judgeAll('036102682', [3, 3, 3])`，驗證：
  - `result.input === '036102682'`
  - `result.fiveGrid.總格` deepEqual `{ value: 28, digit: 8, wuxing: '金' }`
  - `result.wuxingRelations.本體 === '金'`
  - `result.wuxingRelations.天格` deepEqual `{ wuxing: '水', relation: '本體生X' }`
  - `result.wuxingRelations.人格` deepEqual `{ wuxing: '木', relation: '本體剋X' }`
  - `result.wuxingRelations.地格` deepEqual `{ wuxing: '水', relation: '本體生X' }`
  - `result.wuxingRelations.外格` deepEqual `{ wuxing: '金', relation: '比和' }`
  - `result.wuxingRelations.子息` deepEqual `{ wuxing: '金', relation: '比和' }`
  - `result.wuxingRelations.健康` deepEqual `{ wuxing: '土', relation: 'X生本體' }`
  - `result.wuxingRelations.配偶` deepEqual `{ wuxing: '木', relation: '本體剋X' }`
  - `result.wuxingRelations.朋友` deepEqual `{ wuxing: '木', relation: '本體剋X' }`
  - `result.numerology.總格` deepEqual（從 `reference/81數理.json` 讀取 key "28" 比對）
  - `result.numerology.外格` deepEqual（key "17"）
  - `typeof result.score.weighted === 'number'`
  - `['大吉','吉','半吉','凶','大凶'].includes(result.score.level) === true`
  - `typeof result.isPremium === 'boolean'`

  **Test case 7 — `wuxingJudge.js` 原始碼無 I/O side-effect**  
  讀取 `src/engine/wuxingJudge.js` 原始碼，確認：
  - 不含 `from 'express'`
  - 不含 `from 'node:http'`
  - 不含 `fetch(`（防止意外呼叫外部 API）
  - 含有 `export function judgeAll`
  - 含有 `export function getWuxingRelation`

  **完成判斷：** 新增後執行 `node --test test/m3.qa.test.js`，7 個 test 全 pass。

---

### 任務 3：回歸測試確認

- [x] [BE] 執行完整測試套件，確認所有 M1/M2 測試繼續通過

  **要做什麼：**  
  執行 `node --test test/**/*.test.js`，確認 exit code = 0。  
  若有 M1/M2 test 失敗，檢查是否不小心改動了 `calculator.js` 或 `groupConfig.js`（這兩個檔案在 M3 不應有任何修改）。

  **完成判斷：** 所有 test pass，無 error 輸出。

---

## 測試指令

```bash
# 執行 M3 新測試（開發期間快速驗證）
node --test test/m3.qa.test.js

# 執行完整回歸測試（提交前必跑）
node --test test/**/*.test.js
```

預期：全部 pass，exit code 0。

---

## 檔案異動摘要

| 動作 | 檔案路徑 | 備註 |
|------|----------|------|
| 新增 | `src/engine/wuxingJudge.js` | 核心新增 |
| 新增 | `test/m3.qa.test.js` | M3 驗收測試 |
| 不動 | `src/engine/calculator.js` | M2 合約，禁止修改 |
| 不動 | `src/engine/groupConfig.js` | M2 合約，禁止修改 |
| 不動 | `reference/81數理.json` | 原始資料，只讀 |
| 不動 | `test/m2.qa.test.js` | 回歸測試，禁止修改 |
