STATUS: PARTIAL

# M8 TASKS — Docker 化與完整文件

> 執行角色順序：INFRA（無 ART/BE/FE 任務）
> 所有規格細節見 `.workflow/SPEC.md`

---

## INFRA 任務

### T1: 新建 `.dockerignore`
- [x] [INFRA] 在專案根目錄新建 `.dockerignore`
  - **檔案路徑：** `.dockerignore`（新建）
  - **內容：**
    ```
    node_modules
    .env
    test/
    reference/
    .workflow/
    *.md
    .git
    ```
  - **完成判斷：** 檔案存在；`docker build .` 不會把 `node_modules` 送進 build context（build log 中 "Sending build context" 的大小應小於 5MB）

### T2: 升級 `Dockerfile` 為 multi-stage build
- [x] [INFRA] 覆寫現有 `Dockerfile`，改為 multi-stage（builder + runner 兩個 stage）
  - **檔案路徑：** `Dockerfile`（覆寫）
  - **完整內容（照抄，不要修改）：**
    ```dockerfile
    # Stage 1: builder
    FROM node:20-alpine AS builder
    WORKDIR /app
    COPY package.json package-lock.json ./
    RUN npm ci --omit=dev

    # Stage 2: runner
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
  - **完成判斷：**
    - `grep -c "^FROM" Dockerfile` 輸出 `2`
    - `docker build -t gonghao-numbers .` 成功（exit 0）
    - `docker run --rm gonghao-numbers ls reference 2>&1 | grep "No such file"` → 有輸出（reference 不在 image）
    - `docker run --rm gonghao-numbers ls prompts config` → 兩個目錄都存在

### T3: 更新 `docker-compose.yml`，加入 health check
- [ ] [INFRA] 覆寫現有 `docker-compose.yml`
  - **檔案路徑：** `docker-compose.yml`（覆寫）
  - **完整內容（照抄）：**
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
  - **注意：** 使用 `wget`（alpine 預裝），不用 `curl`（alpine 預設無）
  - **完成判斷：**
    - `grep "healthcheck" docker-compose.yml` 有輸出
    - `docker compose up -d` 後 `docker compose ps` 顯示 service status 為 `healthy`
  > BLOCKED: 容器啟動後立即 crash（`Cannot find module '../../reference/81數理.json'`）。SPEC 要求 `reference/` 不進 image，但 `src/engine/wuxingJudge.js` 執行時需讀取該檔。需 BE 將資料移至 `config/` 並更新 import，或修訂 SPEC 允許 `reference/81數理.json` 進 image。

### T4: 新建 `README.md`
- [x] [INFRA] 在專案根目錄新建 `README.md`
  - **檔案路徑：** `README.md`（新建）
  - **必須包含的章節與內容（見 SPEC.md 第 3.3 節，此處列出必要欄位）：**

    1. **專案簡介**：一段話說明工具用途（電話號碼五格數字學、五行吉凶評分、選號排名）
    2. **功能一覽**：4 個功能 bullet（單號分析、AI 解讀、選號爬蟲/貼入、排名頁）
    3. **本機啟動**：包含 `npm install`、`npm start`、開啟 `http://localhost:3000`
    4. **Docker 啟動**：包含 `docker compose up`、開啟 `http://localhost:3000`；附帶 `PORT=8080 docker compose up` 範例
    5. **環境變數表**：表格含 `PORT`、`LLM_PROVIDER`、`OPENAI_API_KEY`、`OPENAI_BASE_URL`、`OPENAI_MODEL`，每欄說明預設值、是否必填、用途
    6. **分組規則說明**：說明台灣手機 10 碼預設 `[3,3,4]`，可在前端自訂
    7. **API 端點一覽**：表格列出 `POST /api/analyze`、`POST /api/analyze?aiComment=true`、`POST /api/crawl`、`POST /api/rank`、`GET /api/sources`
    8. **開發指令**：`npm run dev`（開發模式）、`npm test`（測試）
  - **完成判斷：**
    - `ls README.md` → 存在
    - `grep -E "PORT|LLM_PROVIDER|OPENAI_API_KEY|OPENAI_BASE_URL|OPENAI_MODEL" README.md` → 5 行各自出現
    - `grep "docker compose up" README.md` → 有輸出
    - `grep -c "/api/" README.md` → 至少 4

### T5: （選做）新建 `test/docker.test.js`
- [ ] [INFRA] 新建 Docker 整合測試（需 Docker daemon）
  - **檔案路徑：** `test/docker.test.js`（新建）
  - **邏輯：**
    1. `execSync('docker build -t gonghao-test .')` — build image
    2. `execSync('docker run -d -p 3001:3000 --name gonghao-test-run gonghao-test')` — 啟動容器
    3. 等待 5000ms（start_period）
    4. `fetch('http://localhost:3001/')` → `assert.strictEqual(response.status, 200)`
    5. cleanup：`execSync('docker stop gonghao-test-run && docker rm gonghao-test-run')`
  - **注意：** 用 `try/finally` 確保 cleanup 在 assert 失敗時也執行
  - **注意：** 此測試執行時間長（30s+），若 CI 不支援 Docker 可跳過
  - **完成判斷：** `node --test test/docker.test.js` 在有 Docker daemon 的環境通過
  > BLOCKED: 同 T3，`reference/81數理.json` 未在 image 內，容器無法啟動 HTTP 服務。測試檔已建立（含動態 port 與 Docker 不可用時 skip），待 T3 阻擋因素解除後可驗證。

---

## 測試指令

執行以下指令驗證 M8 整體功能：

```bash
# 1. 既有單元測試全部通過（不應因 Docker 化而破壞）
npm test

# 2. 驗證 Dockerfile 為 multi-stage
grep -c "^FROM" Dockerfile
# 期望輸出：2

# 3. Docker build
docker build -t gonghao-numbers .

# 4. 驗證 image 內容正確
docker run --rm gonghao-numbers ls prompts config     # 兩個目錄都應存在
docker run --rm gonghao-numbers ls reference 2>&1    # 應輸出 "No such file or directory"
docker run --rm gonghao-numbers ls test 2>&1          # 應輸出 "No such file or directory"

# 5. docker compose 啟動
docker compose up -d

# 6. 驗收
curl -f http://localhost:3000/
# 期望：HTTP 200

# 7. health check 狀態
docker compose ps
# 期望：Status 欄顯示 "healthy"

# 8. 停止
docker compose down

# 9. README 內容驗證
grep -E "PORT|LLM_PROVIDER|OPENAI_API_KEY|OPENAI_BASE_URL|OPENAI_MODEL" README.md
grep "docker compose up" README.md
grep -c "/api/" README.md
```
