# M8 SPEC — Docker 化與完整文件

## 1. 背景與範圍

本里程碑為 `gonghao-numbers` 專案的最後一個里程碑，目標是讓任何人只需 `docker compose up` 或 `npm install && npm start` 即可在本機跑起完整服務，並透過 `README.md` 瞭解如何使用與設定。

### 技術棧（既有，勿更動）

- Node.js 20 + Express 5（ESM，`"type": "module"`）
- 無打包工具，`public/` 直接由 Express 提供 static files
- 測試：Node.js 內建 `node:test`

### 目前狀態（實作前）

| 檔案 | 狀態 | 問題 |
|------|------|------|
| `Dockerfile` | 已存在但不完整 | 單 stage、缺少 `prompts/` 與 `config/` 目錄 |
| `docker-compose.yml` | 已存在但不完整 | 缺 health check |
| `README.md` | **不存在** | 需新建 |
| `.env.example` | 已存在且正確 | 無需修改 |

---

## 2. 功能目標

### 做什麼

1. 將 `Dockerfile` 升級為 **multi-stage build**（符合 ROADMAP 規格）
2. 更新 `docker-compose.yml`，加入 health check
3. 新建 `README.md`，包含完整使用說明
4. （選做）新建 `test/docker.test.js`：build image 後打 health check 確認 200

### 不做什麼

- **不修改任何業務邏輯**（`src/`、`test/`、`public/`、`config/`、`prompts/` 均不動）
- **不加入 nginx 或 reverse proxy**（單一 Express process 已足夠）
- **不加入 CI/CD pipeline**（非本里程碑範圍）
- **不加入資料庫或 volume**（本專案無持久化需求）
- **不修改 `ROADMAP.md`**

---

## 3. 檔案規格

### 3.1 `Dockerfile`（覆寫現有檔案）

使用 multi-stage build，兩個 stage：

```
# Stage 1: builder — 安裝所有依賴（含 devDependencies 以供未來擴充）
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Stage 2: runner — 只複製必要檔案
FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY src/ ./src/
COPY public/ ./public/
COPY prompts/ ./prompts/
COPY config/ ./config/
COPY package.json ./
EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "src/server.js"]
```

關鍵決定：
- 使用 `npm ci` 而非 `npm install`，確保 lockfile 鎖版本
- `reference/` 目錄**不進 image**（唯讀參考資料，見 ROADMAP）
- `test/` 不進 image（生產環境不需要測試檔）
- `.env` 不進 image（透過 `docker-compose.yml` 的 `env_file` 注入）

### 3.2 `docker-compose.yml`（覆寫現有檔案）

```yaml
services:
  gonghao-numbers:
    build: .
    ports:
      - "3000:3000"
    env_file:
      - path: .env
        required: false
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
```

關鍵決定：
- 使用 `wget`（alpine 預裝）而非 `curl`（alpine 預設不含）做 health check
- `env_file.required: false`：沒有 `.env` 時不報錯（PORT 有預設值，LLM 功能 graceful degradation）

### 3.3 `README.md`（新建）

必須包含以下章節（順序固定）：

#### 3.3.1 專案簡介
一段話，說明這是「電話號碼五格數字學工具」，可計算五格五行吉凶並排名選號。

#### 3.3.2 功能一覽
- 單號分析（五格、五行、吉凶、加權評分）
- AI 口語解讀（可選，需設定 LLM 環境變數）
- 選號爬蟲 / 手動貼入號碼清單
- 好號碼排名頁（批次評分、依分排序）

#### 3.3.3 本機啟動（不用 Docker）
```bash
npm install
npm start
# 瀏覽器開啟 http://localhost:3000
```

#### 3.3.4 Docker 啟動
```bash
docker compose up
# 瀏覽器開啟 http://localhost:3000
```

若需指定 port：
```bash
PORT=8080 docker compose up
```

#### 3.3.5 環境變數表

| 變數 | 預設值 | 必填 | 說明 |
|------|--------|------|------|
| `PORT` | `3000` | 否 | Express 監聽 port |
| `LLM_PROVIDER` | （空=停用） | 否 | `openai` 或留空停用 AI 解讀 |
| `OPENAI_API_KEY` | — | LLM 啟用時必填 | OpenAI-compatible API key |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | 否 | 可替換 proxy 或本地模型 endpoint |
| `OPENAI_MODEL` | `gpt-4o-mini` | 否 | 模型名稱 |

設定方式：複製 `.env.example` 為 `.env` 並填入值。

#### 3.3.6 分組規則說明

台灣手機號碼為 10 碼（`09xxxxxxxxx`），預設切法為 **`[3, 3, 4]`**，即：

```
09xx-xxx-xxxx
n1   n2   n3
```

- 天格 = n1 + n2
- 人格 = n2 + n3
- 地格 = n1 + n3（誤，應為 n3）
- 總格 = n1 + n2 + n3
- 外格 = 天格 + 地格 - 人格（依五格剖象法公式）

> 可在計算頁面的「分組設定」欄位自訂切法（如 `[3,3,3]`，適用 9 碼號碼）

#### 3.3.7 API 端點一覽

| 端點 | 方法 | 說明 |
|------|------|------|
| `POST /api/analyze` | POST | 單號分析 |
| `POST /api/analyze?aiComment=true` | POST | 單號分析（含 AI 解讀） |
| `POST /api/crawl` | POST | 爬取/解析候選號碼 |
| `POST /api/rank` | POST | 批次評分並依分排名 |
| `GET /api/sources` | GET | 取得可用的爬蟲來源清單 |

Request / Response 格式詳見 ROADMAP.md M4–M7 章節。

#### 3.3.8 開發指令

```bash
npm run dev   # 啟動開發模式（node --watch，修改自動重載）
npm test      # 執行所有測試
```

### 3.4 `test/docker.test.js`（選做）

若實作，步驟：
1. `docker build -t gonghao-test .`
2. `docker run -d -p 3001:3000 --name gonghao-test-run gonghao-test`
3. 等待 5 秒（start_period）
4. `fetch('http://localhost:3001/')` → assert status === 200
5. cleanup：`docker stop gonghao-test-run && docker rm gonghao-test-run`

注意：此測試需要 Docker daemon 運行，CI 環境需確認。

---

## 4. `.dockerignore` 建議

若 `.dockerignore` 不存在，INFRA agent 應新建：

```
node_modules
.env
test/
reference/
.workflow/
*.md
.git
```

這確保 build context 精簡，不把 `node_modules`（本機版本）和機密 `.env` 送進 image。

---

## 5. 驗收標準（Acceptance Criteria）

每條必須可獨立驗證：

| # | 驗收條件 | 驗證指令 |
|---|---------|---------|
| AC-1 | `docker compose up` 後服務正常啟動 | `curl -f http://localhost:3000/` → HTTP 200 |
| AC-2 | Docker image 不含 `reference/` | `docker run --rm gonghao-numbers ls reference 2>&1 \| grep "No such file"` |
| AC-3 | Docker image 不含 `test/` | `docker run --rm gonghao-numbers ls test 2>&1 \| grep "No such file"` |
| AC-4 | `README.md` 存在且包含所有 5 個環境變數名稱 | `grep -E "PORT\|LLM_PROVIDER\|OPENAI_API_KEY\|OPENAI_BASE_URL\|OPENAI_MODEL" README.md` |
| AC-5 | `README.md` 包含 docker compose 啟動說明 | `grep "docker compose up" README.md` |
| AC-6 | `README.md` 包含 4 個 API 端點 | `grep -c "/api/" README.md` → 至少 4 |
| AC-7 | `docker-compose.yml` 包含 healthcheck | `grep "healthcheck" docker-compose.yml` |
| AC-8 | Dockerfile 為 multi-stage（含 AS builder 與 AS runner） | `grep -c "^FROM" Dockerfile` → 2 |
| AC-9 | `npm test` 全綠（既有測試不受 Docker 化影響） | `npm test` → exit code 0 |
| AC-10 | `prompts/` 與 `config/` 在 Docker 容器內存在 | `docker run --rm gonghao-numbers ls prompts config` |
