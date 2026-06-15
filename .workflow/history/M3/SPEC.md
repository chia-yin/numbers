# SPEC — M3: 五行吉凶判定與資料表

> 本文件由架構師撰寫，對象是後續獨立執行的 AI agent（Cursor）。
> 請勿假設任何對話上下文——所有資訊均已寫在本文件中。

---

## 1. 專案背景

**專案名稱：** gonghao-numbers  
**用途：** 電話號碼五格數字學工具（中國數字命理）  
**Runtime：** Node.js，ESM（`"type": "module"`），Express 5  
**測試框架：** Node.js 內建 `node:test`，指令：`node --test test/**/*.test.js`  
**工作目錄：** `/Users/ocean/projects/gonghao-numbers`（或等效路徑）

---

## 2. 已完成的基礎（M1 / M2）

下列檔案已存在，**不得修改**（除非本 SPEC 明確說明）：

| 檔案 | 說明 |
|------|------|
| `src/engine/calculator.js` | 核心計算引擎：`splitGroups`, `sumGroup`, `calcFiveGrid`, `toLastDigit`, `toWuxing`, `calcExtended`, `analyze` |
| `src/engine/groupConfig.js` | `DEFAULT_GROUP_CONFIG = [3, 3, 4]`（台灣手機預設） |
| `reference/81數理.json` | 完整 81 條數理資料（key = "1"~"81"，value = `{ symbol, luck, text }`） |
| `test/m2.qa.test.js` | M2 驗收測試，必須繼續通過 |

### `analyze()` 回傳結構（M2 合約，不可改變）

```js
{
  input: String,
  groups: [String, String, String],
  groupSums: { n1: Number, n2: Number, n3: Number },
  fiveGrid: {
    總格: { value: Number, digit: Number, wuxing: String },
    天格: { value: Number, digit: Number, wuxing: String },
    人格: { value: Number, digit: Number, wuxing: String },
    地格: { value: Number, digit: Number, wuxing: String },
    外格: { value: Number, digit: Number, wuxing: String },
  },
  extended: {
    子息: { value: Number, digit: Number, wuxing: String },
    健康: { value: Number, digit: Number, wuxing: String },
    配偶: { value: Number, digit: Number, wuxing: String },
    朋友: { value: Number, digit: Number, wuxing: String },
  },
}
```

---

## 3. M3 功能目標與範圍

### 做什麼
1. **81 數理查表**：對五格（總格/天格/人格/地格/外格）各自查詢 `reference/81數理.json`，取得 `symbol`/`luck`/`text`。
2. **五行生克判定**：以總格五行為「本體」，判斷其餘各格（天格/人格/地格/外格）及延伸格（子息/健康/配偶/朋友）與本體的生克關係。
3. **加權評分**：依各格影響權重，計算整體吉凶百分制分數（0~100）與等級文字。
4. **`judgeAll()` 函式**：整合 `analyze()` 結果與上述三項判定，輸出完整資料物件。
5. **新增單元測試** `test/m3.qa.test.js`，驗收黃金案例（見第 6 節）。

### 不做什麼
- **不修改 `analyze()`**（M2 合約），不改動任何 M1/M2 原有測試。
- **不實作 API endpoint**（HTTP 路由留給 M4）。
- **不實作前端 / UI**。
- **不呼叫外部 API / LLM**；所有判定為純函式、純資料。
- **不產生建議文字**（「口語解讀」留給後續里程碑）。
- **不考慮英文字母輸入**（只處理電話數字）。

---

## 4. 技術方案

### 4.1 新增檔案

```
src/engine/wuxingJudge.js   ← 核心新增（純函式，禁止 I/O 以外的 JSON 載入）
test/m3.qa.test.js          ← M3 驗收測試
```

**禁止**在 `src/engine/wuxingJudge.js` 裡 `import express`、`import fs`（除了載入 JSON 使用 `createRequire`，見 4.2）、或任何非同步 I/O 在函式呼叫期間發生。

### 4.2 JSON 載入方式

使用 `createRequire`（Node.js ESM 環境最廣相容的同步 JSON 載入方式）：

```js
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const numerologyData = require('../../reference/81數理.json');
```

路徑相對於 `src/engine/wuxingJudge.js`，所以是 `../../reference/81數理.json`。

### 4.3 五行生克規則（寫死）

**相生（→ 表示「生」）：**
```
木 → 火 → 土 → 金 → 水 → 木（循環）
```

**相剋（→ 表示「剋」）：**
```
木 → 土 → 水 → 火 → 金 → 木（循環）
```

五種生克關係（用於 `wuxingRelation` 欄位字串）：

| 關係 | 條件 | 字串值 |
|------|------|--------|
| 比和 | source === target | `"比和"` |
| X生本體 | target 生 source（target → source） | `"X生本體"` |
| 本體生X | source 生 target（source → target） | `"本體生X"` |
| X剋本體 | target 剋 source（target → source） | `"X剋本體"` |
| 本體剋X | source 剋 target（source → target） | `"本體剋X"` |

其中 source = 本體五行（總格），target = 該格五行。

### 4.4 81 數理映射

- 直接以格的 `value`（整數）轉為字串當 key 查 `numerologyData`。
- **若 `value > 81`**：映射公式 `((value - 1) % 80) + 1`，結果必在 1~81。
- **若 `value === 0`**：映射為 81（慣例：0 視同 81 數理結尾，實作時直接用 `((value - 1 + 80) % 80) + 1` 相同公式即可得 `((−1) % 80 + 80) % 80 + 1 = 80`）。

> **架構師決定（理由）**：value=0 在實際電話號碼中極罕見（需三組全為 0），以 `((n-1) % 80) + 1` 統一處理可避免 if-else。具體：`((0-1) % 80 + 80) % 80 + 1 = 80`（JS 的 % 可能回負數，需加 80 取模）。
>
> 安全公式：`const key = ((((value - 1) % 80) + 80) % 80) + 1;`

### 4.5 各格影響權重

| 格 | 權重 |
|----|------|
| 總格 | 0.50 |
| 外格 | 0.25 |
| 人格 | 0.15 |
| 地格 | 0.10 |
| 天格 | 0.05 |

**只有五格（不含延伸格）參與評分。**

### 4.6 Symbol → 分數映射

| symbol | 分數 |
|--------|------|
| `"○"` | 2 |
| `"▲"` | 1 |
| `"X"` | 0 |

**加權分數（0~100）：**
```
weightedScore = (總格_分數 × 0.50 + 外格_分數 × 0.25 + 人格_分數 × 0.15 + 地格_分數 × 0.10 + 天格_分數 × 0.05) / 2 × 100
```

最高 100（全 ○），最低 0（全 X）。

### 4.7 吉凶等級閾值

| 等級 | 條件 |
|------|------|
| `"大吉"` | weightedScore ≥ 80 |
| `"吉"` | 60 ≤ weightedScore < 80 |
| `"半吉"` | 40 ≤ weightedScore < 60 |
| `"凶"` | 20 ≤ weightedScore < 40 |
| `"大凶"` | weightedScore < 20 |

> **架構師決定（理由）**：等分 5 級，每 20 分一級，符合命理工具「一眼看出好壞」的直覺需求；無需使用者確認。

### 4.8 `isPremium`（好號碼）

```js
isPremium = numerology['總格'].symbol === '○' && numerology['外格'].symbol === '○'
```

理由：FORMULA.md 第 6(C) 節明訂「重點格（總格 50%、外格 25%）為 ○（吉）→ 必要條件」。

---

## 5. `judgeAll()` 輸出介面（完整 TypeScript-style Schema）

**匯出位置：** `src/engine/wuxingJudge.js`

**函式簽名：**
```js
export function judgeAll(phoneNumber: string, groupConfig?: number[]): JudgeResult
```

**`JudgeResult` 結構：**

```ts
{
  // === M2 原始欄位（直接從 analyze() 複製過來，結構不變）===
  input: string,
  groups: string[],
  groupSums: { n1: number, n2: number, n3: number },
  fiveGrid: {
    [格名: string]: { value: number, digit: number, wuxing: string }
    // 格名: 總格/天格/人格/地格/外格
  },
  extended: {
    [格名: string]: { value: number, digit: number, wuxing: string }
    // 格名: 子息/健康/配偶/朋友
  },

  // === M3 新增欄位 ===

  // 81 數理查表結果（只有五格，不含延伸格）
  numerology: {
    總格: { symbol: string, luck: string, text: string },
    天格: { symbol: string, luck: string, text: string },
    人格: { symbol: string, luck: string, text: string },
    地格: { symbol: string, luck: string, text: string },
    外格: { symbol: string, luck: string, text: string },
  },

  // 五行生克（本體 = 總格五行；涵蓋五格中的天/人/地/外 + 延伸四格）
  wuxingRelations: {
    本體: string,                    // 總格的 wuxing，e.g. "金"
    天格: { wuxing: string, relation: string },
    人格: { wuxing: string, relation: string },
    地格: { wuxing: string, relation: string },
    外格: { wuxing: string, relation: string },
    子息: { wuxing: string, relation: string },
    健康: { wuxing: string, relation: string },
    配偶: { wuxing: string, relation: string },
    朋友: { wuxing: string, relation: string },
  },

  // 整體評分
  score: {
    weighted: number,   // 0~100，無條件捨去至小數點後一位（Math.round * 10 / 10）
    level: string,      // "大吉" | "吉" | "半吉" | "凶" | "大凶"
  },

  // 好號碼旗標
  isPremium: boolean,
}
```

> **`relation` 字串只允許以下五種值：** `"比和"` / `"X生本體"` / `"本體生X"` / `"X剋本體"` / `"本體剋X"`

---

## 6. 驗收標準（Acceptance Criteria）

所有條件以 `node --test test/**/*.test.js` 全通過為準。

### AC-1：黃金案例完整輸出（036-102-682）

輸入 `judgeAll('036102682', [3, 3, 3])` 必須符合以下固定值：

**M2 基礎部分**（與 M2 黃金案例一致）：
- `groupSums` = `{ n1: 9, n2: 3, n3: 16 }`
- `fiveGrid.總格` = `{ value: 28, digit: 8, wuxing: '金' }`
- `fiveGrid.天格` = `{ value: 10, digit: 0, wuxing: '水' }`
- `fiveGrid.人格` = `{ value: 12, digit: 2, wuxing: '木' }`
- `fiveGrid.地格` = `{ value: 19, digit: 9, wuxing: '水' }`
- `fiveGrid.外格` = `{ value: 17, digit: 7, wuxing: '金' }`

**M3 新增部分**：

五行生克（本體 = 金）：

| 格 | wuxing | relation |
|----|--------|----------|
| 天格 | 水 | 本體生X |
| 人格 | 木 | 本體剋X |
| 地格 | 水 | 本體生X |
| 外格 | 金 | 比和 |
| 子息 | 金 | 比和 |
| 健康 | 土 | X生本體 |
| 配偶 | 木 | 本體剋X |
| 朋友 | 木 | 本體剋X |

81 數理（從 `reference/81數理.json` 查表，key = value 的字串）：
- `numerology.總格` → key `"28"` 的 symbol/luck/text
- `numerology.天格` → key `"10"` 的 symbol/luck/text
- `numerology.人格` → key `"12"` 的 symbol/luck/text
- `numerology.地格` → key `"19"` 的 symbol/luck/text
- `numerology.外格` → key `"17"` 的 symbol/luck/text

（測試直接從 `reference/81數理.json` 讀取對應 key 比對，不要在測試裡硬寫文字內容）

### AC-2：M2 測試全部繼續通過

`test/m2.qa.test.js` 全部 pass（`analyze()` 輸出不變）。

### AC-3：五行生克規則正確

以下生克判定必須正確（可寫成獨立 test case）：

| source（本體） | target | 預期 relation |
|----------------|--------|---------------|
| 木 | 木 | 比和 |
| 木 | 火 | 本體生X |
| 木 | 土 | 本體剋X |
| 木 | 金 | X剋本體 |
| 木 | 水 | X生本體 |
| 金 | 水 | 本體生X |
| 金 | 木 | 本體剋X |
| 金 | 火 | X剋本體 |
| 金 | 土 | X生本體 |

### AC-4：`value > 81` 的數理映射

- `lookupNumerology(82)` 回傳與 key `"1"` 相同的結果（`((82-1) % 80) + 1 = 1`）。
- `lookupNumerology(161)` 回傳與 key `"80"` 相同的結果（`((161-1) % 80) + 1 = 80`（160 % 80 = 0，+1 = 1`）⚠️ 先計算：`((161-1)%80)+1 = (160%80)+1 = 0+1 = 1`，所以應為 key `"1"`）。

> 修正後安全公式：`((((value - 1) % 80) + 80) % 80) + 1`
> - value=82: `(((81 % 80) + 80) % 80) + 1 = ((1+80)%80)+1 = 1+1 = 2`。再算一次：`81 % 80 = 1`，`(1+80)%80 = 81%80 = 1`，`+1 = 2`。**→ key "2"**
> - value=81: `(((80 % 80) + 80) % 80) + 1 = ((0+80)%80)+1 = 0+1 = 1`⚠️ 這不對，81 應該對應 key "81"
>
> **最終正確公式（架構師決定）**：
> ```js
> function normalizeNumerologyKey(value) {
>   if (value >= 1 && value <= 81) return value;
>   // value=0 或 >81 的情況
>   return ((((value - 1) % 80) + 80) % 80) + 1;
> }
> ```
> 驗算：
> - value=1~81 → 直接回傳（不進入計算）
> - value=0 → `(((-1%80)+80)%80)+1 = ((79)%80)+1 = 79+1 = 80` → key "80"
> - value=82 → `(((81%80)+80)%80)+1 = ((1+80)%80)+1 = (81%80)+1 = 1+1 = 2` → key "2"
> - value=161 → `(((160%80)+80)%80)+1 = ((0+80)%80)+1 = 0+1 = 1` → key "1"
>
> 測試必須驗證 `normalizeNumerologyKey(0) === 80` 與 `normalizeNumerologyKey(82) === 2`。

### AC-5：`wuxingJudge.js` 為純 ESM，不直接呼叫 HTTP / express

測試讀取 `src/engine/wuxingJudge.js` 原始碼，確認不含 `from 'express'`、`from 'node:http'`、`fetch(`。

### AC-6：`score.weighted` 精度

`score.weighted` 必須是精確到小數點後一位的數字（`Math.round(raw * 10) / 10`）。

---

## 7. `src/engine/wuxingJudge.js` 需匯出的函式

| 函式 | 說明 |
|------|------|
| `normalizeNumerologyKey(value)` | 將任意整數映射到 1~81（見 4.4） |
| `lookupNumerology(value)` | 查 81數理.json，回傳 `{ symbol, luck, text }` |
| `getWuxingRelation(source, target)` | 兩五行 → 生克關係字串 |
| `calcWeightedScore(numerologyMap)` | 輸入 `{ 總格, 天格, 人格, 地格, 外格 }`（各含 symbol）→ 0~100 |
| `calcLevel(score)` | 0~100 → 等級字串 |
| `judgeAll(phoneNumber, groupConfig?)` | 主要對外函式，回傳完整 JudgeResult |

> 所有函式須 `export`（以便測試單獨驗證）。

---

## 8. 測試指令

```bash
# 執行所有測試（包含 M1/M2 回歸 + M3 新增）
node --test test/**/*.test.js

# 只跑 M3
node --test test/m3.qa.test.js
```

預期：所有 test pass，exit code 0。
