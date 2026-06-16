RESULT: PASS

# M8 QA Test Report

## 新增 / 補強自動化測試

- ✅ 新增 `test/m8.qa-runtime-assets.test.js`
  - 驗證 production runtime 使用 `config/81數理.json`，不依賴 Docker image 會排除的 `reference/81數理.json`。
  - 驗證 `config/81數理.json` 可解析且含 1..81 的資料邊界。
- ✅ 既有 `test/m8.qa-static.test.js`
  - 覆蓋 Dockerfile multi-stage、runner COPY 範圍、docker-compose healthcheck、README 必要內容、`.dockerignore` 排除規則。

## 驗收標準逐條驗證

| # | 結果 | 證據 |
|---|------|------|
| AC-1 `docker compose up` 後服務正常啟動 | ⚠️ 無法驗證（環境限制） | `docker build -t gonghao-numbers .` 失敗於 Docker daemon 權限：`permission denied while trying to connect to the Docker daemon socket at unix:///Users/ocean/.docker/run/docker.sock`。 |
| AC-2 Docker image 不含 `reference/` | ⚠️ 無法驗證（環境限制） | `docker run` 需 Docker daemon。靜態證據：Dockerfile 未 COPY `reference/`；`.dockerignore` 含 `reference/`；`node --test test/m8.qa-static.test.js test/m8.qa-runtime-assets.test.js` 通過。 |
| AC-3 Docker image 不含 `test/` | ⚠️ 無法驗證（環境限制） | `docker run` 需 Docker daemon。靜態證據：Dockerfile 未 COPY `test/`；`.dockerignore` 含 `test/`；M8 靜態測試通過。 |
| AC-4 README 存在且包含所有 5 個環境變數名稱 | ✅ PASS | `grep -E "PORT\|LLM_PROVIDER\|OPENAI_API_KEY\|OPENAI_BASE_URL\|OPENAI_MODEL" README.md` 有輸出，包含 `PORT`、`LLM_PROVIDER`、`OPENAI_API_KEY`、`OPENAI_BASE_URL`、`OPENAI_MODEL`。 |
| AC-5 README 包含 docker compose 啟動說明 | ✅ PASS | `grep "docker compose up" README.md` 輸出 `docker compose up` 與 `PORT=8080 docker compose up`。 |
| AC-6 README 包含至少 4 個 API 端點 | ✅ PASS | `grep -c "/api/" README.md` 輸出 `5`。 |
| AC-7 `docker-compose.yml` 包含 healthcheck | ✅ PASS | `grep "healthcheck" docker-compose.yml` 有輸出；`docker compose config` 可解析並顯示 `healthcheck.test: [CMD, wget, -qO-, http://localhost:3000/]`。 |
| AC-8 Dockerfile 為 multi-stage | ✅ PASS | `grep -c "^FROM" Dockerfile` 輸出 `2`；M8 靜態測試驗證 `AS builder` 與 `AS runner`。 |
| AC-9 `npm test` 全綠 | ✅ PASS | `npm test` exit code 0；結果：109 tests，108 pass，0 fail，1 skipped（Docker daemon 不可用時整合測試 skip）。 |
| AC-10 `prompts/` 與 `config/` 在 Docker 容器內存在 | ⚠️ 無法驗證（環境限制） | `docker run` 需 Docker daemon。靜態證據：Dockerfile 含 `COPY prompts/ ./prompts/` 與 `COPY config/ ./config/`；M8 靜態測試通過。 |

## 測試結果

### 完整回歸

```text
$ npm test
tests 109
pass 108
fail 0
skipped 1
duration_ms 800.63725
```

說明：被 skip 的項目是 `test/docker.test.js`，原因是 Docker daemon 權限不足，不是程式行為失敗。

### M8 專項測試

```text
$ node --test test/m8.qa-static.test.js test/m8.qa-runtime-assets.test.js
tests 5
pass 5
fail 0
skipped 0
```

### 靜態驗收指令

```text
$ grep -c "^FROM" Dockerfile
2

$ grep "healthcheck" docker-compose.yml
    healthcheck:

$ grep -c "/api/" README.md
5
```

### Docker 權限檢查

```text
$ docker info
Server:
permission denied while trying to connect to the docker API at unix:///Users/ocean/.docker/run/docker.sock

$ docker build -t gonghao-numbers .
ERROR: permission denied while trying to connect to the Docker daemon socket at unix:///Users/ocean/.docker/run/docker.sock
```

## 失敗項目

目前沒有可確認的程式行為失敗。Docker runtime 類驗收因本環境無權限連接 Docker daemon，依任務規則列為「無法驗證（環境限制）」而非 FAIL。

## 無法驗證（環境限制）

- AC-1：`docker compose up` 後 HTTP 200。
- AC-2：實際 image 內不存在 `reference/`。
- AC-3：實際 image 內不存在 `test/`。
- AC-10：實際容器內存在 `prompts/` 與 `config/`。

人工驗證步驟（在有 Docker daemon 權限的機器上執行）：

```bash
docker build -t gonghao-numbers .
docker run --rm gonghao-numbers ls prompts config
docker run --rm gonghao-numbers ls reference 2>&1
docker run --rm gonghao-numbers ls test 2>&1
docker compose up -d
curl -f http://localhost:3000/
docker compose ps
docker compose down
```

## Demo 步驟

本機非 Docker：

```bash
npm install
npm start
# 瀏覽器開啟 http://localhost:3000
```

Docker（需 Docker daemon 權限）：

```bash
docker compose up
# 瀏覽器開啟 http://localhost:3000
```
