# gonghao-numbers

## 專案簡介

gonghao-numbers 是一套電話號碼五格數字學工具，可依自訂分組計算五格、五行與吉凶評分，並支援批次排名以協助選號。

## 功能一覽

- 單號分析（五格、五行、吉凶、加權評分）
- AI 口語解讀（可選，需設定 LLM 環境變數）
- 選號爬蟲 / 手動貼入號碼清單
- 好號碼排名頁（批次評分、依分排序）

## 本機啟動（不用 Docker）

```bash
npm install
npm start
# 瀏覽器開啟 http://localhost:3000
```

## Docker 啟動

```bash
docker compose up
# 瀏覽器開啟 http://localhost:3000
```

若需指定 port：

```bash
PORT=8080 docker compose up
```

## 環境變數

| 變數 | 預設值 | 必填 | 說明 |
|------|--------|------|------|
| `PORT` | `3000` | 否 | Express 監聽 port |
| `LLM_PROVIDER` | （空=停用） | 否 | `openai` 或留空停用 AI 解讀 |
| `OPENAI_API_KEY` | — | LLM 啟用時必填 | OpenAI-compatible API key |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | 否 | 可替換 proxy 或本地模型 endpoint |
| `OPENAI_MODEL` | `gpt-4o-mini` | 否 | 模型名稱 |

設定方式：複製 `.env.example` 為 `.env` 並填入值。

## 分組規則說明

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

## API 端點一覽

| 端點 | 方法 | 說明 |
|------|------|------|
| `POST /api/analyze` | POST | 單號分析 |
| `POST /api/analyze?aiComment=true` | POST | 單號分析（含 AI 解讀） |
| `POST /api/crawl` | POST | 爬取/解析候選號碼 |
| `POST /api/rank` | POST | 批次評分並依分排名 |
| `GET /api/sources` | GET | 取得可用的爬蟲來源清單 |

Request / Response 格式詳見 ROADMAP.md M4–M7 章節。

## 開發指令

```bash
npm run dev   # 啟動開發模式（node --watch，修改自動重載）
npm test      # 執行所有測試
```
