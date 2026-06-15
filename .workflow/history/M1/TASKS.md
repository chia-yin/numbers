# TASKS — M1: 建立專案骨架

> 本清單由架構師產出，供後續 AI agent 獨立執行。  
> 執行順序固定：**ART → BE → FE → INFRA**。各角色 agent 彼此看不到對方的工作過程。  
> 所有介面規格詳見 `.workflow/SPEC.md`。

---

## 角色總覽

| 角色 | 本里程碑工作 |
|------|------------|
| [ART] | 本里程碑無 ART 任務（hello-world 頁面不需視覺資產） |
| [BE] | package.json、src/server.js、test/smoke.test.js |
| [FE] | public/index.html |
| [INFRA] | Dockerfile、docker-compose.yml、.env.example |

---

## [BE] 後端任務

### BE-1：初始化 package.json
- **檔案：** `package.json`（新建）
- **做什麼：**
  - `"type": "module"`（全專案使用 ESM，import/export）
  - scripts：`"start": "node src/server.js"`、`"dev": "node --watch src/server.js"`、`"test": "node --test test/**/*.test.js"`
  - dependencies：`"express": "^5.0.0"`
  - 完整格式詳見 SPEC.md 第 4.1 節
- **完成判斷：** `npm install` exit 0；`cat package.json | grep '"type": "module"'` 有輸出

### BE-2：建立 Express 伺服器
- **檔案：** `src/server.js`（新建，需先建立 `src/` 目錄）
- **做什麼：**
  - `import express from 'express'`（ESM 語法）
  - 讀取 `process.env.PORT ?? 3000`
  - `app.use(express.static('public'))` 提供靜態檔案
  - `app.listen(PORT, ...)` 啟動監聽
  - `export { app }` 供測試 import（不重複 listen）
  - 完整程式碼詳見 SPEC.md 第 4.2 節
- **完成判斷：** `node src/server.js` 啟動後，`curl -s -o /dev/null -w "%{http_code}" localhost:3000` 回傳 `200`

### BE-3：建立冒煙測試
- **檔案：** `test/smoke.test.js`（新建，需先建立 `test/` 目錄）
- **做什麼：**
  - 使用 `node:test` 和 `node:assert/strict`（內建，無需安裝）
  - 測試 1：dynamic import `../src/server.js`，assert `app` 有被 export
  - 測試 2：`assert.ok(true)`（基線冒煙）
  - 完整程式碼詳見 SPEC.md 第 4.4 節
  - **注意：** 測試直接 import server.js，不啟動 HTTP server，不需要 supertest
- **完成判斷：** `npm test` 全部通過，exit 0，輸出中無 `fail`

---

## [FE] 前端任務

### FE-1：建立 Hello World 頁面
- **檔案：** `public/index.html`（新建，需先建立 `public/` 目錄）
- **做什麼：**
  - 語言標記：`<html lang="zh-TW">`
  - charset UTF-8、viewport meta
  - `<title>公號數字學</title>`
  - body 包含：`<h1>Hello gonghao-numbers</h1>` 和一行說明文字
  - **不加任何 CSS**（style.css 留待 M4）
  - 完整 HTML 詳見 SPEC.md 第 4.3 節
- **完成判斷：** 啟動 `npm start` 後，`curl localhost:3000 | grep gonghao-numbers` 有輸出

---

## [INFRA] 基礎設施任務

### INFRA-1：建立 .env.example
- **檔案：** `.env.example`（新建）
- **做什麼：**
  - 包含 `PORT=3000` 及說明注釋
  - 完整內容詳見 SPEC.md 第 4.7 節
- **完成判斷：** `grep PORT .env.example` 有輸出

### INFRA-2：建立 Dockerfile
- **檔案：** `Dockerfile`（新建）
- **做什麼：**
  - base image：`node:20-alpine`
  - WORKDIR `/app`
  - 先 COPY `package.json`，再 `RUN npm install --omit=dev`（利用 layer cache）
  - COPY `src/` 和 `public/`
  - `EXPOSE 3000`
  - `CMD ["node", "src/server.js"]`
  - 完整內容詳見 SPEC.md 第 4.5 節
  - **注意：** M1 用單 stage，不做 multi-stage（M8 才處理）
  - **注意：** `reference/` 和 `.workflow/` 不複製進 image（不 COPY 它們即可）
- **完成判斷：** `docker build -t gonghao-numbers .` exit 0，無 build error

### INFRA-3：建立 docker-compose.yml
- **檔案：** `docker-compose.yml`（新建）
- **做什麼：**
  - service 名稱：`gonghao-numbers`
  - `build: .`
  - ports：`"3000:3000"`
  - `env_file: - .env`（使用者複製 .env.example 為 .env 後生效）
  - 完整內容詳見 SPEC.md 第 4.6 節
- **完成判斷：** `docker compose config` 無報錯（不需實際啟動 container）

### INFRA-4：確認 .gitignore 包含必要排除項
- **檔案：** `.gitignore`（已存在，確認或補充）
- **做什麼：**
  - 確認 `.gitignore` 中包含：`node_modules/`、`.env`（`.env.example` 應進版控，`.env` 不進）
  - 若缺少則補充，若已存在且正確則不動
- **完成判斷：** `grep node_modules .gitignore` 和 `grep "^\.env$" .gitignore` 均有輸出

---

## 測試指令（驗收用）

執行以下指令，**所有步驟均需成功（exit 0）**：

```bash
# 1. 安裝依賴
npm install

# 2. 單元/冒煙測試
npm test

# 3. 啟動伺服器（背景執行），驗證 HTTP 200，然後終止
npm start &
SERVER_PID=$!
sleep 1
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" localhost:3000)
kill $SERVER_PID
[ "$HTTP_CODE" = "200" ] && echo "AC-3 PASS: HTTP $HTTP_CODE" || echo "AC-3 FAIL: HTTP $HTTP_CODE"

# 4. 驗證 HTML 內容包含 gonghao-numbers
npm start &
SERVER_PID=$!
sleep 1
curl localhost:3000 | grep gonghao-numbers && echo "AC-4 PASS" || echo "AC-4 FAIL"
kill $SERVER_PID

# 5. Docker build（需要 Docker daemon 運行中）
docker build -t gonghao-numbers . && echo "AC-5 PASS" || echo "AC-5 FAIL"

# 6. 環境變數範例檔
grep PORT .env.example && echo "AC-6 PASS" || echo "AC-6 FAIL"
```

---

## 執行注意事項

1. **ESM 優先**：所有 `.js` 檔案使用 `import`/`export`，不使用 `require()`。`package.json` 已設 `"type": "module"`。
2. **不安裝額外依賴**：測試使用 `node:test`（內建），不安裝 jest、mocha、supertest 等。
3. **路徑相對性**：`express.static('public')` 的路徑是相對 Node.js process 的 CWD（從 repo root 啟動時正確）。
4. **server.js 的 listen 與 export 並存**：必須同時 `app.listen(...)` 和 `export { app }`，否則測試 import 會掛起等待 server 結束。
5. **不修改** `.workflow/ROADMAP.md`、`.workflow/STATE`、`reference/` 下任何檔案。
