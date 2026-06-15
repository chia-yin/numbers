# gonghao-numbers — 專案藍圖

## 專案目標

電話號碼五格數字學工具。使用者輸入手機號碼，系統依中國數字命理的「五格剖象法」計算五格數值、五行屬性、生克吉凶，並給出加權評分與整體解讀。階段二加入選號爬蟲與好號碼篩選排名頁。

## 技術選型

| 層 | 技術 | 選型理由 |
|----|------|---------|
| 後端 | Node.js 20 + Express 5 | 與兄弟專案 gonghao-ai 一致，維護成本低 |
| 前端 | 純 HTML/CSS/JS（`public/index.html`） | 無打包工具，零依賴，Docker 映像極小 |
| 測試 | Node.js 內建 `node:test` + `node:assert` | 不增加外部依賴，與既有風格一致 |
| 爬蟲 | 內建 `fetch` + `node-html-parser`（輕量） | 避免 Puppeteer/Playwright 的笨重依賴 |
| AI 解讀 | 現有 LLM adapter 模式，提示詞放 `prompts/` | 可替換模型，提示詞可由使用者編輯 |
| 容器 | Docker + docker-compose | 本機一鍵啟動，無需全域安裝 Node |
| 資料庫 | **無** | 吉凶規則以 JSON 資料表寫死，不需持久化 |

---

## 里程碑清單

- [x] M1: 建立專案骨架——初始化 package.json、Express 伺服器、static public/、node:test 可跑、Docker 設定檔、hello-world 端對端可通

  **交付物：**
  - `package.json`（scripts: start / test / dev）
  - `src/server.js`：Express app，監聽 `PORT`（預設 3000），提供 `public/` static files
  - `public/index.html`：最簡單的 "Hello gonghao-numbers" 頁面
  - `test/smoke.test.js`：node:test 跑通（至少一個 assert.ok(true) 即可）
  - `Dockerfile` + `docker-compose.yml`（預留，本里程碑只要 build 不報錯）
  - `.env.example`：列出所有環境變數（本里程碑只有 PORT）

  **驗收：** `npm test` 全綠；`npm start` 後 `curl localhost:3000` 回 200。

- [x] M2: 實作五格計算引擎——純函式，通過 FORMULA.md 第七節黃金測試範例

  **交付物：**
  - `src/engine/calculator.js`：匯出純函式
    - `splitGroups(phoneNumber, groupConfig)` → `[group1, group2, group3]`（字串陣列）
    - `sumGroup(group)` → 整數（組內各位相加）
    - `calcFiveGrid(n1, n2, n3)` → `{ 總格, 天格, 人格, 地格, 外格 }`（各為整數，未取個位）
    - `toLastDigit(n)` → 個位數（0–9）
    - `toWuxing(digit)` → `'木'|'火'|'土'|'金'|'水'`（1,2→木 / 3,4→火 / 5,6→土 / 7,8→金 / 9,0→水）
    - `calcExtended(fiveGrid)` → `{ 子息, 健康, 配偶, 朋友 }`（各為整數，未取個位）
    - `analyze(phoneNumber, groupConfig?)` → 完整結果物件（見下方資料模型）
  - `src/engine/groupConfig.js`：預設分組設定（台灣手機 10 碼：`[3,3,4]`，可覆寫）
  - `test/calculator.test.js`：黃金測試範例（036/102/682 → 五格 28/10/12/19/17 → 金/水/木/水/金）
    加上邊界案例：全零號碼、非 9 碼輸入的錯誤拋出。

  **資料模型（`analyze()` 回傳）：**
  ```json
  {
    "input": "0936102682",
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

  **驗收：** `npm test` 全綠，黃金案例 assert 全通。

- [x] M3: 實作五行吉凶判定與資料表——五行生克規則、各格加權評分、吉凶等級 JSON

  **交付物：**
  - `src/engine/wuxingRules.js`：匯出
    - `SHENG`（相生對）：`{ 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' }`
    - `KE`（相克對）：`{ 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' }`
    - `getRelation(a, b)` → `'生'|'被生'|'克'|'被克'|'同'`（a 對 b 的關係）
    - `getAuspicious(relation)` → `'大吉'|'吉'|'平'|'凶'|'大凶'`
  - `src/engine/scorer.js`：
    - `WEIGHTS`：`{ 總格: 0.50, 外格: 0.25, 人格: 0.15, 地格: 0.10, 天格: 0.05 }`
    - `scoreGrid(fiveGrid)` → 每格加上 `{ relation, auspicious, score }` 欄位
      （score：大吉=100 / 吉=75 / 平=50 / 凶=25 / 大凶=0，以五格相互生克綜合判斷）
    - `calcOverall(scoredGrid)` → `{ weightedScore: number, verdict: '大吉'|'吉'|'平'|'凶'|'大凶' }`
  - `src/data/auspiciousText.json`：各吉凶等級的短說明文字（繁體中文）
  - `test/scorer.test.js`：黃金案例帶入，assert 各格 auspicious 與 weightedScore 在預期範圍內

  **吉凶判定邏輯（本里程碑決定，後續不再改）：**
  - 以「總格五行」為基準，逐一評估其他四格對總格的關係。
  - 天格→總格：生=吉、同=平、克=凶、被克=凶（父系對本體）
  - 人格→總格：生=大吉、同=吉、克=大凶（官祿對本體，影響最大僅次於總格本身）
  - 地格→總格：生=吉、同=平、克=凶
  - 外格→總格：生=大吉、同=吉、克=大凶（財官對本體）
  - 總格本身無對比，依個位數對應的五行「先天吉凶」：金水木=較吉、火土=中、0水=佳
    （此先天吉凶作為 scorer 的基線）

  **驗收：** `npm test` 全綠。

- [ ] M4: 計算網頁 UI——輸入號碼、顯示五格五行吉凶權重、整體評分、可調分組規則

  **交付物：**
  - `public/index.html`：SPA（無打包），包含：
    - 輸入欄：手機號碼（數字）+ 分組設定（預設 `3-3-4`，可改為 `3-3-3` 等）
    - 送出後呼叫 `POST /api/analyze`，顯示：
      - 五格數值表格（格名、數值、個位、五行、吉凶等級、權重%）
      - 延伸關係格（子息/健康/配偶/朋友）
      - 整體加權分數（0–100）與最終評語（大吉/吉/平/凶/大凶）
    - 分組規則說明文字（台灣手機 10 碼預設切法說明）
  - `src/routes/analyze.js`：`POST /api/analyze`
    - request body：`{ "phone": "0936102682", "groups": [3,3,4] }`（groups 選填，預設 `[3,3,4]`）
    - response：M2 資料模型 + M3 評分欄位合併（見下方擴充模型）
  - `public/style.css`：基本排版（table、色碼對應吉凶：大吉=綠/凶=紅）
  - `test/api.test.js`：直接 `import` routes 函式做單元測試（不啟 HTTP server）

  **擴充後 response 模型（`/api/analyze` 回傳）：**
  ```json
  {
    "input": "0936102682",
    "groups": ["036", "102", "682"],
    "groupSums": { "n1": 9, "n2": 3, "n3": 16 },
    "fiveGrid": {
      "總格": { "value": 28, "digit": 8, "wuxing": "金", "auspicious": "吉", "score": 75, "weight": 0.50 },
      "天格": { "value": 10, "digit": 0, "wuxing": "水", "auspicious": "吉", "score": 75, "weight": 0.05 },
      "人格": { "value": 12, "digit": 2, "wuxing": "木", "auspicious": "平", "score": 50, "weight": 0.15 },
      "地格": { "value": 19, "digit": 9, "wuxing": "水", "auspicious": "吉", "score": 75, "weight": 0.10 },
      "外格": { "value": 17, "digit": 7, "wuxing": "金", "auspicious": "大吉", "score": 100, "weight": 0.25 }
    },
    "extended": {
      "子息": { "value": 27, "digit": 7, "wuxing": "金" },
      "健康": { "value": 36, "digit": 6, "wuxing": "土" },
      "配偶": { "value": 22, "digit": 2, "wuxing": "木" },
      "朋友": { "value": 31, "digit": 1, "wuxing": "木" }
    },
    "overall": { "weightedScore": 83.75, "verdict": "吉" },
    "aiComment": null
  }
  ```

  **驗收：** `npm test` 全綠；瀏覽器手動測試 0936102682 → 顯示正確五格。

- [ ] M5: 整合 LLM adapter——AI 生成口語化整體解讀，提示詞放 prompts/ 可編輯

  **交付物：**
  - `src/llm/adapter.js`：匯出 `generateComment(analysisResult, options?)` → `Promise<string>`
    - 若環境變數未設（`LLM_PROVIDER` 未定義），回傳 `null`（graceful degradation）
    - 支援 `LLM_PROVIDER=openai`（呼叫 OpenAI-compatible API）
  - `src/llm/openaiAdapter.js`：OpenAI API 實作（使用內建 `fetch`，無 SDK 依賴）
  - `prompts/phone-comment.txt`：提示詞模板，含 `{{fiveGrid}}`、`{{overall}}` 等 placeholder
  - `src/routes/analyze.js`：更新，若 `aiComment=true` query param 則非同步呼叫 adapter，填入 response 的 `aiComment` 欄位
  - `.env.example`：新增 `LLM_PROVIDER`、`OPENAI_API_KEY`、`OPENAI_BASE_URL`、`OPENAI_MODEL`
  - `test/adapter.test.js`：mock LLM 回傳，assert comment 被正確填入 response

  **設計決定：**
  - LLM 呼叫預設關閉（`aiComment` query param 需明確帶入），避免非預期費用。
  - 提示詞明確說明「數理計算結果為準，AI 僅補充口語說明」，避免幻覺覆蓋計算結果。

  **驗收：** `npm test` 全綠；設定 `.env` 後可從 UI 勾選「AI 解讀」取得評語。

- [ ] M6: 選號爬蟲——可設定來源清單、禮貌爬蟲、支援貼入號碼清單模式

  **交付物：**
  - `src/crawler/index.js`：匯出 `fetchCandidates(source)` → `Promise<string[]>`（號碼陣列）
    - source 型別：`{ type: 'url', url, selector }` 或 `{ type: 'text', content }`（貼入模式）
  - `src/crawler/parser.js`：從 HTML 字串萃取電話號碼（regex 或 node-html-parser）
  - `src/crawler/politeness.js`：`checkRobots(url)` + `sleep(ms)`（預設請求間隔 2000ms）
  - `config/sources.json`：爬蟲來源設定檔（格式見下方），預設提供 2 個示範 URL + 1 個說明
  - `src/routes/crawl.js`：`POST /api/crawl`
    - request：`{ "source": { "type": "text", "content": "0912345678\n0987654321" } }`
    - response：`{ "candidates": ["0912345678", "0987654321"] }`
  - `test/crawler.test.js`：以 `type: 'text'` 模式測試解析邏輯（不實際打網路）

  **`config/sources.json` 格式：**
  ```json
  [
    {
      "id": "manual",
      "name": "手動貼入號碼清單",
      "type": "text",
      "description": "將號碼（一行一個）貼入前端文字框"
    },
    {
      "id": "example-url",
      "name": "示範 URL 來源",
      "type": "url",
      "url": "https://example.com/numbers",
      "selector": ".number-item",
      "delayMs": 2000,
      "enabled": false,
      "note": "實際電信選號 URL 請自行填入並設 enabled: true"
    }
  ]
  ```

  **驗收：** `npm test` 全綠；`POST /api/crawl` 以 text 模式回傳正確號碼陣列。

- [ ] M7: 好號碼篩選與排名頁——批次計算候選號碼、依評分排序、UI 呈現

  **交付物：**
  - `src/routes/rank.js`：`POST /api/rank`
    - request：`{ "candidates": ["0912345678", ...], "groups": [3,3,4], "minScore": 70 }`
    - response：`{ "ranked": [ { "phone": "...", ...analysisResult, "rank": 1 } ] }`（依 weightedScore 降序）
    - 效能：candidates 上限 200 筆（超過回 400）
  - `public/rank.html`：選號頁，包含：
    - 來源選擇（下拉選 `config/sources.json` 中 enabled 的來源，或手動貼入）
    - 篩選條件：最低評分閾值（預設 70）
    - 排名結果表格（電話號碼、加權分、最終評語、各格五行）
    - 可點擊任一號碼跳回 `index.html?phone=xxx` 看詳細分析
  - `test/rank.test.js`：3 組測試號碼，assert 排序順序正確、minScore 過濾有效

  **驗收：** `npm test` 全綠；手動測試貼入 5 個號碼，排名頁正確顯示並排序。

- [ ] M8: Docker 化與完整文件——Dockerfile、docker-compose、README、環境變數清單

  **交付物：**
  - `Dockerfile`：multi-stage build（builder 安裝依賴、runner 只複製 node_modules + src + public），node:20-alpine
  - `docker-compose.yml`：單一 service `gonghao-numbers`，port 3000:3000，掛 `.env` 檔
  - `README.md`：
    - 專案簡介（一段話）
    - 本機啟動（`npm install && npm start`）
    - Docker 啟動（`docker compose up`）
    - 環境變數表（PORT / LLM_PROVIDER / OPENAI_API_KEY / OPENAI_BASE_URL / OPENAI_MODEL）
    - 分組規則說明（台灣手機 10 碼，預設 `[3,3,4]`，即 `09xx-xxx-xxxx`）
    - API 端點一覽（POST /api/analyze / POST /api/crawl / POST /api/rank）
  - `test/docker.test.js`（選做）：build image 後 `docker run` 打 health check，確認 200

  **驗收：** `docker compose up` 後 `curl localhost:3000` 回 200；`README.md` 存在且包含所有環境變數說明。

---

## 跨里程碑介面速查

### API 端點

| 端點 | 方法 | 里程碑 | 說明 |
|------|------|--------|------|
| `/api/analyze` | POST | M4 | 單號分析（含吉凶評分） |
| `/api/analyze?aiComment=true` | POST | M5 | 含 AI 口語解讀 |
| `/api/crawl` | POST | M6 | 爬取/解析候選號碼 |
| `/api/rank` | POST | M7 | 批次評分並排名 |

### 環境變數

| 變數 | 預設值 | 說明 |
|------|--------|------|
| `PORT` | `3000` | Express 監聽 port |
| `LLM_PROVIDER` | （未設=停用）| `openai` 或未來其他 |
| `OPENAI_API_KEY` | — | OpenAI-compatible API key |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | 可替換 proxy/本地模型 |
| `OPENAI_MODEL` | `gpt-4o-mini` | 模型名稱 |

### 檔案結構（預期完成後）

```
gonghao-numbers/
├── src/
│   ├── server.js
│   ├── engine/
│   │   ├── calculator.js
│   │   ├── groupConfig.js
│   │   ├── wuxingRules.js
│   │   └── scorer.js
│   ├── llm/
│   │   ├── adapter.js
│   │   └── openaiAdapter.js
│   ├── crawler/
│   │   ├── index.js
│   │   ├── parser.js
│   │   └── politeness.js
│   └── routes/
│       ├── analyze.js
│       ├── crawl.js
│       └── rank.js
├── public/
│   ├── index.html
│   ├── rank.html
│   └── style.css
├── prompts/
│   └── phone-comment.txt
├── config/
│   └── sources.json
├── test/
│   ├── smoke.test.js
│   ├── calculator.test.js
│   ├── scorer.test.js
│   ├── api.test.js
│   ├── adapter.test.js
│   ├── crawler.test.js
│   └── rank.test.js
├── reference/          ← 唯讀，不進 Docker image
├── .env.example
├── Dockerfile
├── docker-compose.yml
└── README.md
```
