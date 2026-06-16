STATUS: DONE

STATUS: DONE

# TASKS — M4: 計算網頁 UI

> 執行順序固定：BE → FE。各角色只看本文件與 SPEC.md，無法看到彼此的工作過程。
> 所有路徑均相對於專案根目錄 `/Users/ocean/projects/gonghao-numbers/`。

---

## BE 任務

- [x] [BE] **建立 `src/routes/analyze.js`**
  - 新增檔案 `src/routes/analyze.js`（ESM module）。
  - 匯出純函式 `analyzeHandler(phone, groups)`：
    - 輸入驗證：
      - `phone` 必須是非空字串且全為數字（`/^\d+$/`），否則回傳 `{ status: 400, body: { error: 'phone must be a non-empty string of digits' } }`。
      - 若 `groups` 有提供，各元素加總必須等於 `phone.length`，否則回傳 `{ status: 400, body: { error: \`groups sum (X) must equal phone length (Y)\` } }`。
      - 若 `groups` 未提供，使用 `DEFAULT_GROUP_CONFIG`（從 `src/engine/groupConfig.js` import）。
    - 呼叫 `judgeAll(phone, groupConfig)`（從 `src/engine/wuxingJudge.js` import）。
    - 將結果轉換為 SPEC 第 3 節定義的 response 形狀（合併 numerology、wuxingRelations、WEIGHTS 進各格，移除原始 `numerology` 與 `wuxingRelations` 欄位，加入 `aiComment: null`）。
    - 回傳 `{ status: 200, body: <轉換後物件> }`。
  - WEIGHTS 常數（寫在此檔案內，不從引擎 import）：`{ 總格: 0.50, 外格: 0.25, 人格: 0.15, 地格: 0.10, 天格: 0.05 }`。
  - 五格 key 順序：`['總格', '天格', '人格', '地格', '外格']`；總格不加 `relation` 欄位，其餘四格加 `relation`（來自 `wuxingRelations[key].relation`）。
  - 延伸格 key 順序：`['子息', '健康', '配偶', '朋友']`；各格加 `relation`（來自 `wuxingRelations[key].relation`）。
  - 匯出 `router`（Express Router），`router.post('/', async (req, res) => { const { status, body } = analyzeHandler(req.body?.phone, req.body?.groups); res.status(status).json(body) })`。
  - **完成判斷**：檔案存在且 `node --input-type=module -e "import './src/routes/analyze.js'"` 無報錯。

- [x] [BE] **修改 `src/server.js`：掛載 middleware 與路由**
  - 在 `app.use(express.static('public'))` **之前**加入：
    ```js
    app.use(express.json())
    ```
  - 在 `express.json()` 之後、`express.static()` 之前 import 並掛載 route：
    ```js
    import { router as analyzeRouter } from './routes/analyze.js'
    app.use('/api/analyze', analyzeRouter)
    ```
  - **完成判斷**：`curl -s -X POST http://localhost:3000/api/analyze -H 'Content-Type: application/json' -d '{"phone":"0936102682"}' | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const r=JSON.parse(d);process.exit(r.fiveGrid?.總格?.wuxing==='金'?0:1)})"` 回傳 exit code 0（需先 `npm start`）。

- [x] [BE] **新增 `test/api.test.js`**
  - 新增檔案 `test/api.test.js`，使用 `node:test` + `node:assert`，直接 import `analyzeHandler`，**不啟動 HTTP server**。
  - 測試案例（至少四個）：
    1. **黃金案例**：`analyzeHandler('0936102682', [3,3,4])` → `status === 200`，`body.fiveGrid.總格.wuxing === '金'`，`body.fiveGrid.總格.weight === 0.50`，`body.score.weighted` 為 number，`body.aiComment === null`。
    2. **非數字 phone**：`analyzeHandler('abc', undefined)` → `status === 400`，`body.error` 為 string。
    3. **groups 加總不符**：`analyzeHandler('0936102682', [3,3,5])` → `status === 400`，`body.error` 包含 `'groups sum'`。
    4. **relations 正確**：`analyzeHandler('0936102682', [3,3,4])` → `body.fiveGrid.天格.relation` 為 string，`body.fiveGrid.總格.relation === undefined`，`body.extended.子息.relation` 為 string。
  - **完成判斷**：`npm test` 全綠，`test/api.test.js` 四案例全 pass。

---

## FE 任務

> FE 任務在 BE 任務完成後執行。FE 只需要實作 HTML/CSS/JS，不修改後端。

- [x] [FE] **改寫 `public/index.html` 為 SPA**
  - 完整替換現有 `public/index.html`（目前為佔位頁）。
  - 引用 `./style.css`（link rel="stylesheet"）。
  - 頁面 DOM 結構：
    ```
    <h1> 公號數字學 — 手機號碼五格分析 </h1>
    <form id="analyzeForm">
      <label>手機號碼 <input id="phone" type="text" maxlength="15" placeholder="0936102682" required></label>
      <label>分組規則 <input id="groups" type="text" value="3-3-4" required></label>
      <p class="hint">台灣手機 10 碼，預設切法：09xx-xxx-xxxx（即 3-3-4）</p>
      <button type="submit">分析</button>
    </form>
    <div id="error" hidden></div>
    <div id="result" hidden>
      <div id="verdict"></div>         <!-- 整體評語 + 加權分 + isPremium -->
      <table id="fiveGridTable">...</table>
      <table id="extendedTable">...</table>
    </div>
    ```
  - JavaScript（內嵌 `<script>` 或外部 `public/app.js`，不依賴任何框架或 CDN）：
    1. 監聽 `analyzeForm` submit，`preventDefault()`。
    2. 讀取 `phone.value` 與 `groups.value`（格式 `"3-3-4"`，split `'-'` 轉 `Number` 陣列）。
    3. `fetch('/api/analyze', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({phone, groups}) })`。
    4. 若 response 非 ok：隱藏 `#result`，顯示 `#error`（填入 `data.error` 文字）。
    5. 若 ok：隱藏 `#error`，顯示 `#result`，渲染以下內容：
       - `#verdict`：顯示 `score.level`（大字）、`score.weighted` 分、`isPremium` 時顯示「★ 雙吉格」。
         `#verdict` 背景色依 `fiveGrid.總格.symbol` 套用色碼（○=`#d4edda` / ▲=`#fff3cd` / X=`#f8d7da`）。
       - `#fiveGridTable`：欄位依序為「格名 / 數值 / 個位 / 五行 / 吉凶(symbol+luck) / 權重 / 與總格關係」。
         每列依該格 `symbol` 套用背景色。
         總格的「與總格關係」欄顯示「—」（本體）。
       - `#extendedTable`：欄位依序為「格名 / 數值 / 個位 / 五行 / 與總格關係」。
  - **完成判斷**：瀏覽器開啟 `http://localhost:3000`，輸入 `0936102682` / `3-3-4`，送出後 `#fiveGridTable` 有 5 列（五格），總格列背景為綠色。

- [x] [FE] **新增 `public/style.css`**
  - 新增檔案 `public/style.css`。
  - 必要樣式：
    - `body`：`font-family: sans-serif; max-width: 900px; margin: 2rem auto; padding: 0 1rem`。
    - `form`：`display: flex; flex-direction: column; gap: 0.75rem; max-width: 400px`。
    - `.hint`：`font-size: 0.85em; color: #666; margin: 0`。
    - `table`：`border-collapse: collapse; width: 100%; margin-top: 1.5rem`。
    - `th, td`：`border: 1px solid #ccc; padding: 0.5rem 0.75rem; text-align: center`。
    - `th`：`background: #f0f0f0`。
    - `#verdict`：`padding: 1rem; border-radius: 6px; margin-top: 1.5rem; font-size: 1.2rem`。
    - `#error`：`color: #721c24; background: #f8d7da; padding: 0.75rem; border-radius: 4px; margin-top: 1rem`。
    - 吉凶 class（由 JS 動態加到 `<tr>` 或 `<td>`）：
      - `.symbol-good`  → `background-color: #d4edda; color: #155724`
      - `.symbol-mid`   → `background-color: #fff3cd; color: #856404`
      - `.symbol-bad`   → `background-color: #f8d7da; color: #721c24`
  - **完成判斷**：`public/style.css` 存在，瀏覽器載入頁面無 404。

---

## 測試指令

```bash
# 單元測試（全套，含 api.test.js）
npm test

# 手動端對端測試（需先啟動伺服器）
npm start
# 另開終端：
curl -s -X POST http://localhost:3000/api/analyze \
  -H 'Content-Type: application/json' \
  -d '{"phone":"0936102682","groups":[3,3,4]}' | jq '.score'
# 預期輸出：{ "weighted": <number>, "level": <string> }

# 瀏覽器測試
open http://localhost:3000
```
