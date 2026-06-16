# gonghao-numbers — GCP 部署指南

本專案為**無狀態** Node.js / Express web 服務，預設部署至 **Cloud Run**（無持久化資料庫、單一 HTTP 程序即可）。

## 為何選 Cloud Run

| 需求 | Cloud Run |
|------|-----------|
| 無狀態 HTTP API + 靜態頁面 | 原生支援 |
| 依流量自動擴縮 | 內建 |
| 無需管理 VM / K8s | 全託管 |
| 本專案無背景常駐 worker、無 Stateful 儲存 | 不需 GKE / GCE |

若未來需要長連線 WebSocket 叢集、自訂網路拓撲或固定節點，再評估 GKE / GCE。

## 架構概覽

```
deploy.sh
  ├─ docker build（本機）
  ├─ push → Artifact Registry
  └─ gcloud run deploy → Cloud Run
```

應用程式監聽 `PORT`（預設 3000；Cloud Run 會注入 `PORT=8080`）。健康檢查以 `GET /` 回傳 200 為準。

## 前置需求

1. **本機工具**
   - [Docker](https://docs.docker.com/get-docker/)
   - [Google Cloud SDK (`gcloud`)](https://cloud.google.com/sdk/docs/install)

2. **GCP 權限**（部署帳號至少需）
   - Artifact Registry 讀寫
   - Cloud Run Admin
   - Service Account User（部署時指定 runtime SA）
   - Secret Manager Secret Accessor（若掛載 secrets）

3. **登入與專案**

```bash
gcloud auth login
gcloud auth application-default login   # 選用，本機其他工具可能需要
gcloud config set project YOUR_PROJECT_ID
```

## 必要 GCP API

`deploy.sh` 會冪等啟用以下 API（也可手動啟用）：

- `artifactregistry.googleapis.com`
- `run.googleapis.com`
- `secretmanager.googleapis.com`（使用 Secret Manager 時）

```bash
gcloud services enable \
  artifactregistry.googleapis.com \
  run.googleapis.com \
  secretmanager.googleapis.com \
  --project=YOUR_PROJECT_ID
```

## 部署設定

1. 複製範本：

```bash
cp .workflow/deploy.env.example .workflow/deploy.env
```

2. 編輯 `.workflow/deploy.env`，**必填**：

| 變數 | 說明 |
|------|------|
| `GCP_PROJECT_ID` | GCP 專案 ID |
| `GCP_REGION` | Cloud Run 區域（例：`asia-east1`） |
| `SERVICE_NAME` | Cloud Run 服務名稱 |
| `ARTIFACT_REGISTRY_LOCATION` | Artifact Registry 區域 |
| `ARTIFACT_REGISTRY_REPOSITORY` | Docker 儲存庫名稱 |

> **切勿**將 `deploy.env`、`.env` 或任何金鑰 commit 進 git。

3. 執行部署：

```bash
chmod +x deploy.sh   # 首次
./deploy.sh
```

腳本行為：

- 缺 `deploy.env` 或必填欄位 → 印出說明並以非零碼結束
- Artifact Registry 儲存庫不存在 → 自動建立
- 建置映像 → 推送 → `gcloud run deploy`（可重複執行）

## 應用環境變數

| 變數 | 預設 | 必填 | 說明 |
|------|------|------|------|
| `PORT` | `3000` | 否 | Cloud Run 會覆寫為 `8080` |
| `NODE_ENV` | — | 否 | `deploy.sh` 部署時設為 `production` |
| `LLM_PROVIDER` | （空） | 否 | `openai` 啟用 AI 解讀 |
| `OPENAI_API_KEY` | — | LLM 啟用時 | **請用 Secret Manager** |
| `OPENAI_BASE_URL` | OpenAI 官方 | 否 | 相容 API endpoint |
| `OPENAI_MODEL` | `gpt-4o-mini` | 否 | 模型名稱 |

非敏感變數可寫在 `deploy.env` 的 `CLOUD_RUN_ENV_VARS`：

```bash
CLOUD_RUN_ENV_VARS=LLM_PROVIDER=openai,OPENAI_MODEL=gpt-4o-mini
```

## Secret Manager 設定（OPENAI_API_KEY）

**不要把 API key 寫進 deploy.env 或映像。**

1. 建立 secret：

```bash
echo -n 'sk-...' | gcloud secrets create openai-api-key \
  --data-file=- \
  --project=YOUR_PROJECT_ID
```

2. 授權 Cloud Run runtime 服務帳號讀取 secret：

```bash
PROJECT_NUMBER=$(gcloud projects describe YOUR_PROJECT_ID --format='value(projectNumber)')
RUN_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

gcloud secrets add-iam-policy-binding openai-api-key \
  --member="serviceAccount:${RUN_SA}" \
  --role="roles/secretmanager.secretAccessor" \
  --project=YOUR_PROJECT_ID
```

3. 在 `deploy.env` 掛載為環境變數：

```bash
CLOUD_RUN_SECRETS=OPENAI_API_KEY=openai-api-key:latest
CLOUD_RUN_ENV_VARS=LLM_PROVIDER=openai,OPENAI_MODEL=gpt-4o-mini
```

重新執行 `./deploy.sh` 即可更新服務。

## 健康檢查與關機

- **健康檢查**：`GET /`（靜態首頁）回傳 200；Dockerfile 內建 `HEALTHCHECK`。
- **優雅關機**：Cloud Run 送 `SIGTERM` 後，Node.js 程序結束；本服務無長連線狀態，預設行為可接受。

## 驗證部署

```bash
URL=$(gcloud run services describe SERVICE_NAME \
  --region=REGION \
  --project=PROJECT_ID \
  --format='value(status.url)')

curl -f "$URL/"
curl -f "$URL/api/sources"
```

## 本機驗證映像（部署前）

```bash
docker build -t gonghao-numbers:local .
docker run --rm -p 3000:3000 gonghao-numbers:local
curl -f http://localhost:3000/
```

或使用：

```bash
docker compose up
```

## 疑難排解

| 症狀 | 可能原因 | 處理 |
|------|----------|------|
| `deploy.env` 相關錯誤 | 未複製範本或缺必填欄位 | 對照 `deploy.env.example` |
| `docker push` 401/403 | 未 `gcloud auth configure-docker` | 重新執行 `deploy.sh` 或手動設定 |
| Cloud Run 啟動後 502 | 未監聽 `PORT` | 確認應用讀取 `process.env.PORT`（已支援） |
| AI 解讀失敗 | secret 未掛載或 SA 無權限 | 檢查 `CLOUD_RUN_SECRETS` 與 IAM |

## 相關檔案

- `Dockerfile` — multi-stage build
- `.dockerignore` — 排除 `node_modules`、`.env`、`test/` 等
- `deploy.sh` — 建置、推送、部署腳本
- `.workflow/deploy.env.example` — 部署設定範本
