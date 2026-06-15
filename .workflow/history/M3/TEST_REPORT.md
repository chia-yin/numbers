RESULT: PASS

# TEST REPORT — M3 五行吉凶判定與資料表

## 測試範圍

- 規格來源：`.workflow/SPEC.md`
- 測試指令來源：`.workflow/TASKS.md`
- 新增 QA 測試：`test/m3.contract.test.js`
- 限制遵守：只新增測試檔與本報告，未修改實作程式碼。

## 自動化測試結果

✅ `node --test test/m3.contract.test.js`

```text
tests 5
pass 5
fail 0
duration_ms 60.6135
```

✅ `node --test test/m3.qa.test.js`

```text
tests 7
pass 7
fail 0
duration_ms 90.618292
```

✅ `node --test test/**/*.test.js`

```text
tests 32
pass 32
fail 0
duration_ms 156.894708
```

## 驗收標準逐條驗證

✅ 1. 81 數理查表：五格會依 `reference/81數理.json` 查出 `symbol` / `luck` / `text`。

證據：
- `test/m3.qa.test.js` 驗證 `lookupNumerology(1)`、`lookupNumerology(28)`、`lookupNumerology(82)` 與 JSON 資料一致。
- `test/m3.contract.test.js` 補驗 `lookupNumerology(0) === data["80"]`、`lookupNumerology(270) === data["30"]`。
- 人工呼叫 `judgeAll('036102682', [3, 3, 3])` 觀察到 `numerology.總格` 為 key `28`，`numerology.外格` 為 key `17`。

✅ 2. `value > 81` 與 `value === 0` 使用安全公式正規化。

證據：

```text
normalize: { '0': 80, '82': 2, '270': 30 }
```

`test/m3.contract.test.js` 也用 30 碼全 9 案例驗證 `judgeAll()` 內部五格大值查表：
- 總格 `270` → key `30`
- 天格 `91` → key `11`
- 人格 `180` → key `20`
- 地格 `180` → key `20`
- 外格 `91` → key `11`

✅ 3. 五行生克判定以總格五行為本體，涵蓋天格 / 人格 / 地格 / 外格 / 子息 / 健康 / 配偶 / 朋友。

證據：黃金案例 `judgeAll('036102682', [3, 3, 3])` 輸出：

```text
本體: 金
天格: 水 / 本體生X
人格: 木 / 本體剋X
地格: 水 / 本體生X
外格: 金 / 比和
子息: 金 / 比和
健康: 土 / X生本體
配偶: 木 / 本體剋X
朋友: 木 / 本體剋X
```

`test/m3.qa.test.js` 另有木、金作為 source 的生剋規則表測試。

✅ 4. 加權評分只使用五格，回傳 0~100 與等級文字。

證據：
- `calcWeightedScore()` 測試：全 `○` → `100`；全 `X` → `0`；只有總格 `○` → `50`。
- `calcLevel()` 閾值測試覆蓋 `100`、`80`、`79.9`、`60`、`59.9`、`40`、`39.9`、`20`、`19.9`、`0`。
- 人工呼叫黃金案例得到：

```text
score: { weighted: 25, level: '凶' }
```

✅ 5. `judgeAll()` 回傳 M2 原始欄位並新增 M3 欄位。

證據：
- `test/m3.contract.test.js` 比對 `judgeAll('0912345678')` 的 `input`、`groups`、`groupSums`、`fiveGrid`、`extended` 與 `analyze('0912345678')` 完全一致。
- `test/m3.qa.test.js` 驗證黃金案例包含 `numerology`、`wuxingRelations`、`score`、`isPremium` 且型別正確。

✅ 6. `isPremium` 必須同時滿足總格與外格皆為 `○`。

證據：`test/m3.contract.test.js` 覆蓋三種案例：
- `1234567890`：總格 `○`、外格 `○` → `isPremium === true`
- `0912345678`：只有總格 `○` → `isPremium === false`
- `0000000000`：只有外格 `○` → `isPremium === false`

✅ 7. 不修改 `analyze()` 合約、不破壞 M1/M2 回歸。

證據：完整回歸 `node --test test/**/*.test.js` 通過：

```text
tests 32
pass 32
fail 0
```

✅ 8. `wuxingJudge.js` 不含 Express / HTTP / 外部 API 呼叫。

證據：
- `test/m3.qa.test.js` 檢查原始碼不含 `from 'express'`、`from 'node:http'`、`fetch(`。
- 人工執行 `rg "from ['\"]express['\"]|from ['\"]node:http['\"]|fetch\\(" src/engine/wuxingJudge.js || true` 無輸出。

## 失敗項目

無。

## 無法驗證（環境限制）

無。本 M3 無 UI、無 HTTP endpoint、無外部服務需求，全部驗收項目可在本機 Node.js 測試與直接函式呼叫中驗證。

## Demo 步驟

```bash
# 快速驗證 M3 驗收測試
node --test test/m3.qa.test.js

# 執行 QA 補強測試
node --test test/m3.contract.test.js

# 執行完整回歸
node --test test/**/*.test.js

# 手動查看黃金案例輸出
node -e "import('./src/engine/wuxingJudge.js').then(({ judgeAll }) => console.log(JSON.stringify(judgeAll('036102682', [3,3,3]), null, 2)))"
```
