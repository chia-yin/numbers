# TASKS — M7: 好號碼篩選與排名頁

STATUS: DONE

> 執行順序：ART → BE → FE → INFRA
> 各角色由不同 agent 獨立執行，彼此看不到對方工作過程。
> 所有介面定義詳見 `.workflow/SPEC.md`。

---

## [ART] 畫面規劃

- [x] [ART] 規劃 `public/rank.html` 頁面布局，產出 `.workflow/rank-layout.md`
  - **內容**：以文字描述各區塊的 HTML 結構與 CSS class 安排
  - **區塊**：
    1. `<header>` 導覽列：一個 `<a href="index.html">← 單號分析</a>`
    2. `<section id="sourceSection">` 來源設定：`<select id="sourceSelect">`、textarea（id=`manualInput`，手動模式）、抓取按鈕（id=`crawlBtn`，URL 模式）、抓取結果提示（id=`crawlPreview`）
    3. `<section id="filterSection">` 篩選設定：最低評分輸入（id=`minScore`，type=number，min=0，max=100，value=70）、分組規則（id=`groups`，text，value=`3-3-4`）、送出按鈕（id=`rankBtn`）
    4. `<div id="progress">` 進度提示（分析中字樣）
    5. `<div id="stats">` 統計：「共分析 N 筆，通過 M 筆，過濾 K 筆」
    6. `<table id="rankTable">` 排名表格，欄位順序：排名、電話號碼（a href）、加權分、評語、雙吉格、總格五行、外格五行、人格五行、地格五行、天格五行
    7. `<div id="error">` 錯誤訊息區
  - **CSS**：沿用 `public/style.css` 的既有 class（`.symbol-good`/`.symbol-mid`/`.symbol-bad`/`.hint`）；`<tr>` 的背景色依總格 `symbol` 套用對應 class
  - **判斷標準**：`.workflow/rank-layout.md` 存在且包含上述 7 個區塊的 HTML id 列表

---

## [BE] 後端

- [x] [BE] 建立 `src/routes/rank.js`，實作 `POST /api/rank`
  - **import**：`import { analyzeHandler } from './analyze.js'`、`import { DEFAULT_GROUP_CONFIG } from '../engine/groupConfig.js'`
  - **驗證邏輯**（回傳 400）：
    - `candidates` 缺少/非陣列/空陣列 → `{ error: 'candidates must be a non-empty array' }`
    - `candidates.length > 200` → `{ error: 'candidates limit is 200' }`
    - `minScore` 存在但不是 0–100 的數字 → `{ error: 'minScore must be a number between 0 and 100' }`
  - **處理邏輯**：
    1. 對每個 candidate 呼叫 `analyzeHandler(phone, groups)`
    2. status !== 200 的結果靜默跳過
    3. 篩選 `body.score.weighted >= minScore`（minScore 預設 70）
    4. 依 `score.weighted` 降序排列
    5. 加上 `rank` 欄位（1 起算）
    6. 刪除每個結果的 `aiComment` 欄位
  - **回傳 200**：`{ ranked: [...], total: ranked.length, filtered: (成功分析數 - ranked.length) }`
  - **export**：`export { router }`
  - **判斷標準**：檔案存在，手動 `node --input-type=module` 可 import 不報錯

- [x] [BE] 建立 `src/routes/sources.js`，實作 `GET /api/sources`
  - **邏輯**：使用 `fs.readFileSync` 讀取 `config/sources.json`（用 `createRequire` 或 JSON import）
  - **過濾**：回傳 `type === 'text'` 的所有項目，加上 `enabled === true` 的 URL 來源
  - **回傳欄位**：每個 source 只回傳 `id`、`name`、`type`（text 型）或加上 `url`、`selector`、`delayMs`（url 型），省略 `note`、`enabled`、`description`
  - **回傳 200**：`{ sources: [...] }`
  - **export**：`export { router }`
  - **判斷標準**：`GET /api/sources` 回 200，body.sources 含 manual

- [x] [BE] 更新 `src/server.js`，掛載兩個新路由
  - 在現有兩個路由之後加入：
    ```js
    import { router as rankRouter } from './routes/rank.js'
    import { router as sourcesRouter } from './routes/sources.js'
    // ...
    app.use('/api/rank', rankRouter)
    app.use('/api/sources', sourcesRouter)
    ```
  - **判斷標準**：`npm start` 不報錯，`curl -X POST localhost:3000/api/rank` 回 400（而非 404）

- [x] [BE] 建立 `test/rank.test.js`，單元測試 rank 路由
  - **import**：直接 import `{ rankHandler }` 函式（需從 `src/routes/rank.js` export 出來供測試）
    - 或：直接 import `{ analyzeHandler }` 做整合測試
  - **測試案例**：
    1. 3 筆號碼（`"0936102682"`、`"0912345678"`、`"0987654321"`），minScore=0，assert `ranked` 長度為 3，`ranked[0].score.weighted >= ranked[1].score.weighted >= ranked[2].score.weighted`，`ranked[0].rank === 1`
    2. 同 3 筆號碼，minScore=100，assert `ranked` 長度 <= 3（可能為 0），`filtered >= 0`
    3. candidates 超過 200 筆，assert handler 回傳 status 400
    4. candidates 包含 `"abc"`（格式錯誤），assert 不 throw，其他有效號碼仍回傳
  - **注意**：使用 Node.js 內建 `node:test` 與 `node:assert`（同專案其他測試，不引入外部測試框架）
  - **判斷標準**：`npm test` 全綠，4 個 assert 全通

---

## [FE] 前端

> FE 依賴 ART 產出的 `.workflow/rank-layout.md` 以及 BE 的 API 規格（見 SPEC.md 第 3 節）。

- [x] [FE] 建立 `public/rank.html`（依 `.workflow/rank-layout.md` 的布局實作）
  - **頁面初始化**（DOMContentLoaded）：
    - 呼叫 `GET /api/sources`，填入 `<select id="sourceSelect">`
    - 初始顯示 `#manualInput` textarea（因預設選 manual）
    - 切換 sourceSelect 時：若 `type === 'text'` 顯示 textarea、隱藏 crawlBtn；若 `type === 'url'` 隱藏 textarea、顯示 crawlBtn
  - **抓取流程**（crawlBtn click）：
    - 取得目前選中 source 的 `url`、`selector`（從 select option 的 dataset）
    - `POST /api/crawl { source: { type: 'url', url, selector } }`
    - 成功後，將 candidates 存入 JS 變數，更新 `#crawlPreview` 文字（如「已抓取 23 筆，前 5 筆：0912...」）
  - **排名流程**（rankBtn click）：
    - 決定 candidates：textarea 模式 → 按行分割過濾空行；URL 模式 → 使用 crawl 暫存結果
    - groups 從 `#groups` 輸入解析（split('-').map(Number)）
    - minScore 從 `#minScore` 輸入讀取（parseFloat）
    - `POST /api/rank { candidates, groups, minScore }`
    - 成功後渲染表格（見下方）
  - **表格渲染**（renderRankTable(data)）：
    - 清空 `#rankTable tbody`
    - 每行：`<tr class="symbol-good/mid/bad">`（依 `fiveGrid.總格.symbol`）
      - 欄位：`ranked.rank`、`<a href="index.html?phone=xxx">phone</a>`、`score.weighted`、`score.level`、`isPremium ? '★' : ''`、`fiveGrid.總格.wuxing`、`fiveGrid.外格.wuxing`、`fiveGrid.人格.wuxing`、`fiveGrid.地格.wuxing`、`fiveGrid.天格.wuxing`
    - 更新 `#stats` 文字：「共分析 N 筆，通過 ${data.total} 筆，過濾 ${data.filtered} 筆」
  - **錯誤處理**：HTTP 非 200 → 顯示 `data.error` 至 `#error`
  - **判斷標準**：瀏覽器開啟 rank.html 無 JS 錯誤，`GET /api/sources` 成功載入選單，貼入號碼並排名後表格正確顯示

- [x] [FE] 修改 `public/index.html`，加入 `?phone=xxx` 自動填入邏輯
  - **位置**：在 `</script>` 結尾標籤之前，`form.addEventListener(...)` 之後加入
  - **程式碼**：
    ```js
    // 支援從 rank.html 點擊號碼跳轉後自動分析
    const _urlParams = new URLSearchParams(window.location.search)
    const _prePhone = _urlParams.get('phone')
    if (_prePhone) {
      phoneInput.value = _prePhone
      form.requestSubmit()
    }
    ```
  - **判斷標準**：瀏覽器直接開啟 `index.html?phone=0936102682`，頁面自動送出並顯示分析結果，不需手動點按鈕

---

## 測試指令

```bash
# 單元測試（全部測試，含 rank.test.js）
npm test

# 手動 API 測試（需先啟動伺服器）
npm start

# GET sources
curl http://localhost:3000/api/sources

# POST rank（3 筆範例號碼）
curl -X POST http://localhost:3000/api/rank \
  -H "Content-Type: application/json" \
  -d '{"candidates":["0936102682","0912345678","0987654321"],"minScore":0}'

# POST rank（超過 200 筆，預期 400）
node -e "const c=Array.from({length:201},(_,i)=>'09'+String(i).padStart(8,'0')); \
  fetch('http://localhost:3000/api/rank',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({candidates:c})}).then(r=>r.json()).then(console.log)"

# 瀏覽器端對端測試
open http://localhost:3000/rank.html
# → 手動貼入號碼 → 點篩選排名 → 確認表格出現、點號碼跳轉 index.html 自動分析
```
