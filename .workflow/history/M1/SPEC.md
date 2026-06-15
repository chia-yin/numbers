# SPEC — M1: 建立專案骨架

> 本文件由架構師撰寫，對象是後續獨立執行的 AI agent。請勿假設任何對話上下文——所有資訊均已寫在本文件中。

---

## 1. 專案背景

**專案名稱：** gonghao-numbers  
**用途：** 電話號碼五格數字學工具（中國數字命理）  
**工作目錄：** `/Users/ocean/projects/gonghao-numbers`（Git repo 已存在，目前只有 `reference/` 和 `.workflow/` 目錄）

---

## 2. 本里程碑目標與範圍

### 做什麼（M1 範圍）

建立可運作的專案骨架，讓後續里程碑的 agent 有基礎結構可以疊加：

1. `package.json`：定義 npm scripts（start / test / dev）與依賴（Express 5）
2. `src/server.js`：Express 5 伺服器，監聽 `PORT`（預設 3000），提供 `public/` 靜態檔案
3. `public/index.html`：最簡單的 Hello 頁面
4. `test/smoke.test.js`：以 `node:test` 跑通的冒煙測試（至少一個 `assert.ok(true)`）
5. `Dockerfile` + `docker-compose.yml`：能成功 build，不需實際跑起 container
6. `.env.example`：本里程碑只列出 `PORT`

### 不做什麼（明確排除）

- 不實作任何業務邏輯（五格計算、吉凶判定）
- 不實作任何 API 路由（`/api/*`）
- 不引入資料庫
- 不整合 LLM
- 不加任何 CSS 樣式（style.css 留待 M4）
- 不建立 `public/rank.html`（M7 才需要）
- 不加 ESLint、Prettier 等 linting 工具
- 不寫 README.md（M8 才需要）

---

## 3. 技術規格

### 執行環境

| 項目 | 版本 / 值 |
|------|----------|
| Node.js | 20（LTS） |
| Express | 5（`express@^5.0.0`） |
| 測試框架 | 內建 `node:test` + `node:assert`（不引入外部測試庫） |
| 容器 base image | `node:20-alpine` |

### 目錄結構（M1 完成後）

```
gonghao-numbers/
├── src/
│   └── server.js
├── public/
│   └── index.html
├── test/
│   └── smoke.test.js
├── .env.example
├── Dockerfile
├── docker-compose.yml
└── package.json
```

（`reference/` 和 `.workflow/` 已存在，不動它們）

---

## 4. 各檔案規格

### 4.1 `package.json`

```json
{
  "name": "gonghao-numbers",
  "version": "0.1.0",
  "description": "電話號碼五格數字學工具",
  "type": "module",
  "main": "src/server.js",
  "scripts": {
    "start": "node src/server.js",
    "dev": "node --watch src/server.js",
    "test": "node --test test/**/*.test.js"
  },
  "dependencies": {
    "express": "^5.0.0"
  }
}
```

**關鍵決定：**
- `"type": "module"` → 所有 `.js` 使用 ESM（`import`/`export`），不用 CommonJS `require()`
- `--watch` 用 Node.js 內建功能，不裝 nodemon
- 測試指令用 glob，後續里程碑新增測試檔案自動被收進來

### 4.2 `src/server.js`

職責：建立 Express app、掛靜態目錄、啟動監聽。

```js
import express from 'express'

const app = express()
const PORT = process.env.PORT ?? 3000

app.use(express.static('public'))

app.listen(PORT, () => {
  console.log(`gonghao-numbers listening on port ${PORT}`)
})

export { app }   // 匯出供測試 import，不重複 listen
```

**注意：** 必須同時 `export { app }`，供未來測試或路由測試直接 import，而不用另起 HTTP 伺服器。

### 4.3 `public/index.html`

最簡 HTML，只需讓 `curl localhost:3000` 回 200 並有可辨識內容：

```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>公號數字學</title>
</head>
<body>
  <h1>Hello gonghao-numbers</h1>
  <p>電話號碼五格數字學工具（開發中）</p>
</body>
</html>
```

### 4.4 `test/smoke.test.js`

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'

test('smoke: server module exports app', async () => {
  const { app } = await import('../src/server.js')
  assert.ok(app, 'app should be exported from server.js')
})

test('smoke: basic assertion', () => {
  assert.ok(true)
})
```

**注意：** 測試直接 `import` server.js，不 `listen` HTTP，所以不需要 supertest 之類的依賴。

### 4.5 `Dockerfile`

```dockerfile
FROM node:20-alpine AS base
WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY src/ ./src/
COPY public/ ./public/

EXPOSE 3000
CMD ["node", "src/server.js"]
```

**決定：** M1 用單 stage（simple build），multi-stage build 留到 M8（完整 Docker 化里程碑）。

### 4.6 `docker-compose.yml`

```yaml
services:
  gonghao-numbers:
    build: .
    ports:
      - "3000:3000"
    env_file:
      - .env
```

**注意：** `env_file: .env` 讓使用者複製 `.env.example` 為 `.env` 後即可用。若 `.env` 不存在，docker compose 仍可跑（env_file 在 compose v2 中不存在時只警告不報錯）。

### 4.7 `.env.example`

```
# gonghao-numbers 環境變數範例
# 複製為 .env 並填入實際值

# Express 監聽 port（預設 3000）
PORT=3000
```

---

## 5. 環境變數清單（本里程碑）

| 變數名 | 預設值 | 說明 |
|--------|--------|------|
| `PORT` | `3000` | Express 監聽 port；在 server.js 以 `process.env.PORT ?? 3000` 讀取 |

---

## 6. 驗收標準（Acceptance Criteria）

以下每條均可獨立、自動化驗證：

| # | 驗收條件 | 驗證指令 |
|---|----------|---------|
| AC-1 | `npm install` 執行成功，無錯誤 | `npm install` exit 0 |
| AC-2 | `npm test` 全部通過，exit 0 | `npm test` |
| AC-3 | `npm start` 後，`curl -s -o /dev/null -w "%{http_code}" localhost:3000` 回傳 `200` | 見指令 |
| AC-4 | `curl localhost:3000` 回傳 HTML 中包含 `gonghao-numbers` | `curl localhost:3000 \| grep gonghao-numbers` |
| AC-5 | `docker build -t gonghao-numbers .` 不報錯 | 見指令 |
| AC-6 | `.env.example` 存在且包含 `PORT` | `grep PORT .env.example` |
| AC-7 | `package.json` 的 `scripts.test` 使用 `node --test`（不依賴外部測試庫） | `grep "node --test" package.json` |

---

## 7. 不動的既有檔案

| 路徑 | 說明 |
|------|------|
| `.workflow/ROADMAP.md` | 里程碑定義，絕對不修改 |
| `.workflow/STATE` | 工作流狀態，不修改 |
| `reference/` | 唯讀參考資料，不修改、不刪除 |
| `.gitignore` | 若已存在則不修改 |
