RESULT: PASS

# M4 QA Test Report

## 本次新增自動化測試

- `test/m4.http-integration.test.js`
  - 不開 TCP port，直接用 `app.handle()` 驗證 `express.json()` 與 `/api/analyze` route 掛載。
  - 覆蓋成功 POST、轉換後 response shape、`aiComment: null`、不透傳 `numerology` / `wuxingRelations`、groups sum 錯誤回 400。
- `test/m4.ui-static.test.js`
  - 驗證 `public/index.html` 具備指定表單、結果/錯誤區塊、表格、submit handler、`fetch('/api/analyze')`、groups split/Number 轉換、premium 標記與錯誤分支。
  - 驗證 `public/style.css` 具備指定 layout 與 `.symbol-good` / `.symbol-mid` / `.symbol-bad` 色碼。

## 自動化測試結果

✅ `npm test`

證據：

```text
> node --test test/**/*.test.js

tests 47
pass 47
fail 0
cancelled 0
skipped 0
duration_ms 206.188792
```

✅ `node --input-type=module -e "import './src/routes/analyze.js'"`

證據：指令 exit code 0，無輸出、無例外。

## 驗收標準逐條驗證

✅ 建立 `src/routes/analyze.js`，可 import，並匯出 handler/router

證據：

```bash
node --input-type=module -e "import './src/routes/analyze.js'"
# exit code 0
```

✅ `analyzeHandler(phone, groups)` 成功案例回傳轉換後 response，不直接透傳引擎原始欄位

證據：

```text
{"status":200,"score":{"weighted":65,"level":"吉"},"total":{"value":37,"digit":7,"wuxing":"金","symbol":"○","luck":"吉","weight":0.5},"hasNumerology":false,"hasRelations":false,"aiComment":null}
```

✅ 錯誤輸入回 400

證據：

```text
{"status":400,"error":"phone must be a non-empty string of digits"}
{"status":400,"error":"groups sum (11) must equal phone length (10)"}
```

✅ `src/server.js` 有掛 `express.json()` 與 `/api/analyze` route

證據：`test/m4.http-integration.test.js` 直接對 Express app 送 JSON POST，通過：

```text
✔ m4 http integration: mounted JSON route returns transformed analysis
✔ m4 http integration: mounted JSON route returns API validation errors
```

✅ `public/index.html` 是 SPA，包含表單、結果區、錯誤區與 API 呼叫

證據：`test/m4.ui-static.test.js` 通過，覆蓋：

- `<form id="analyzeForm">`
- `#phone`：`type="text"`、`maxlength="15"`、`placeholder="0936102682"`、`required`
- `#groups`：`value="3-3-4"`、`pattern="^\d+(-\d+)+$"`、`required`
- `#error` / `#result` 初始 hidden
- `#verdict`、`#fiveGridTable`、`#extendedTable`
- submit 時 `preventDefault()` 並 `fetch('/api/analyze', { method: 'POST', ... })`

✅ 結果渲染符合規格

證據：`test/m4.ui-static.test.js` 通過，覆蓋：

- 五格表欄位：格名 / 數值 / 個位 / 五行 / 吉凶 / 權重 / 與總格關係
- 延伸表欄位：格名 / 數值 / 個位 / 五行 / 與總格關係
- 總格關係顯示 `—（本體）`
- `isPremium` 時顯示 `★ 雙吉格`
- API 400 時隱藏 `#result` 並顯示 `#error`

✅ `public/style.css` 存在並具備指定 layout 與吉凶色碼

證據：`test/m4.ui-static.test.js` 通過，覆蓋：

- `body`、`form`、`.hint`、`table`、`th, td`、`th`、`#verdict`、`#error`
- `.symbol-good`：`#d4edda` / `#155724`
- `.symbol-mid`：`#fff3cd` / `#856404`
- `.symbol-bad`：`#f8d7da` / `#721c24`

## ⚠️ 無法驗證（環境限制）

⚠️ 真實 `npm start` + `curl http://localhost:3000/api/analyze` 無法在此受管環境完成。

證據：

```text
EPERM listen EPERM: operation not permitted 0.0.0.0
```

判斷：

- 這是執行環境禁止開 TCP listening socket，不是程式行為不符。
- 已用 `test/m4.http-integration.test.js` 在不開 port 的情況下驗證 Express middleware 與 route 掛載。

⚠️ 真實瀏覽器目視操作無法在此環境完成。

證據：

```text
Browser is not available: iab
```

人工驗證步驟：

```bash
npm start
open http://localhost:3000
```

操作：

1. 手機號碼輸入 `0936102682`。
2. 分組規則輸入 `3-3-4`。
3. 點「分析」。
4. 預期 `#result` 顯示，`#fiveGridTable tbody tr` 有 5 列，總格列為綠色系。
5. 將手機號碼改為 `abc` 後送出，預期顯示 `phone must be a non-empty string of digits`，且結果區塊隱藏。

## 失敗項目

無。可自動化驗證項目全部通過；需要真實 socket / in-app browser 的驗證項目因環境限制未執行，已列在上方。

## Demo 步驟

```bash
npm start
open http://localhost:3000
```

成功案例：

1. 輸入 `0936102682`。
2. 分組規則保留 `3-3-4`。
3. 點「分析」。
4. 應看到整體評語、加權分、五格表、延伸關係表。

錯誤案例：

1. 手機號碼輸入 `abc`。
2. 點「分析」。
3. 應看到 `phone must be a non-empty string of digits`。
