VERDICT: APPROVE

# Code Review — M4: 計算網頁 UI

審查者：Staff Engineer  
日期：2026-06-16  
範圍：M4 所有新增/修改檔案

---

## 總結

實作符合 SPEC 的核心要求，API 介面合約正確，轉換邏輯完整，測試覆蓋率足夠。無 blocker 或 major 問題。

---

## 接縫檢查

| 項目 | 結果 |
|------|------|
| 前後端 API 介面合約一致（response shape） | ✅ 符合 SPEC §3 |
| `express.json()` 在 `express.static()` 之前 | ✅ server.js:8-10 |
| route 掛載順序正確 | ✅ `express.json → /api/analyze → static` |
| `style.css` 路徑 `./style.css` 存在 | ✅ `public/style.css` 已建立 |
| `analyzeHandler` 匯出供測試直接 import | ✅ analyze.js:58 |
| `numerology` / `wuxingRelations` 不透傳 | ✅ transformResult 正確過濾 |
| `aiComment: null` 固定回傳 | ✅ analyze.js:54 |
| `總格` 不含 `relation` 欄位 | ✅ analyze.js:29-31 |
| WEIGHTS 常數值與 SPEC 一致 | ✅ `{總格:0.50, 外格:0.25, 人格:0.15, 地格:0.10, 天格:0.05}` |
| secrets 未進版本控制 | ✅ `.env` 在 `.gitignore` 中 |
| 超出 SPEC 範圍的改動 | ❌ 見 minor-2 |

---

## 問題清單

### minor-1 — `src/routes/analyze.js:101` — `async` 宣告多餘

```js
router.post('/', async (req, res) => {
  const { status, body } = analyzeHandler(req.body?.phone, req.body?.groups);
```

`analyzeHandler` 為純同步函式，callback 內無 `await`。雖然 Express 5 的 async 錯誤捕獲機制在此有額外保護效果（若引擎意外拋出會自動轉 500），但語義上這個 `async` 是多餘的。

**嚴重程度**：minor  
**建議**：若需要錯誤保護，明確加 try-catch 並回傳 500；否則移除 `async`。現狀行為正確，不擋 APPROVE。

---

### minor-2 — `test/m1.acceptance.test.js:43` — M1 測試描述混入 M4

```js
test('index page contains required metadata and M4 SPA content', async () => {
```

M1 測試檔案被修改以容納 M4 重寫後的 `index.html` 內容。測試名稱明確提到「M4 SPA content」，使 M1 測試的語義模糊。測試邏輯本身是正確的（M4 取代了 M1 的佔位頁），但修改既有里程碑測試可算輕微超出 M4 範圍。

**嚴重程度**：minor  
**建議**：可改名為「index page contains required metadata and SPA content」，或在 M4 測試資料夾中另建對應斷言。現狀不影響正確性。

---

### minor-3 — `public/index.html:95,109-118,126-134` — `innerHTML` 插入 API 回傳值

```js
verdictEl.innerHTML = [
  `<div class="level">${score.level}</div>`,
  ...
]
tr.innerHTML = [
  `<td>${grid.wuxing}</td>`,
  `<td>${grid.symbol} ${grid.luck}</td>`,
  ...
].join('')
```

API 回傳的 `score.level`、`grid.wuxing`、`grid.luck` 等欄位直接插入 `innerHTML`。目前這些值來自伺服器端的 `81數理.json`（受控資料，非使用者輸入），無實際 XSS 風險。但若未來 M5 引入 `aiComment`（自由文字），若仿照此模式直接插入 innerHTML 就會有問題。

**嚴重程度**：minor  
**建議**：現階段不需立即修改；M5 實作 `aiComment` 渲染時務必使用 `textContent` 或適當的 HTML escape，不得沿用此 `innerHTML` 模板模式。

---

### minor-4 — API 缺少 `phone` 長度上限的伺服器端驗證

`src/routes/analyze.js:59` 驗證 `/^\d+$/` 但未限制長度上限。前端 `maxlength="15"` 是 client-side 限制，API 直接呼叫可傳入任意長字串（e.g., 10,000 位數）。SPEC 未明確要求此檢查，但屬防禦性程式碼缺口。

**嚴重程度**：minor  
**建議**：可在正規表達式前或後加 `phone.length > 15` 的 guard，回傳 400。

---

## 驗收標準逐條核對

| AC | 狀態 | 備註 |
|----|------|------|
| AC-1 `npm test` 全綠 | ✅ | TEST_REPORT: 47 pass, 0 fail |
| AC-2 POST 黃金案例 → 200 + 正確欄位 | ✅ | api.test.js + http-integration |
| AC-3 `abc` → 400 含 `error` | ✅ | api.test.js |
| AC-4 groups sum 不符 → 400 | ✅ | api.test.js + http-integration |
| AC-5 fiveGrid 各格欄位正確（含/不含 relation） | ✅ | api.test.js + qa.test.js |
| AC-6 extended 各格含 `relation` | ✅ | api.test.js |
| AC-7 瀏覽器目視 | ⚠️ | 環境限制，TEST_REPORT 已說明 |
| AC-8 瀏覽器錯誤分支 | ⚠️ | 環境限制，靜態分析通過 |
| AC-9 isPremium 顯示「★ 雙吉格」 | ✅ | ui-static.test.js |
| AC-10 `express.json()` 掛載 | ✅ | server.js:8 + http-integration |

---

## 結論

4 個 minor 問題，無 blocker / major。APPROVE。
