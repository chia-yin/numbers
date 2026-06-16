RESULT: PASS

# M6 QA Test Report - 選號爬蟲

## 本次新增/補強測試

- 新增 `test/m6.qa-delay.test.js`
  - 驗證 URL source 未提供 `delayMs` 時，會使用預設 `2000ms` 延遲再抓目標頁。
  - 測試攔截 `setTimeout`，不實際等待 2 秒。

既有 QA 補強測試也已回歸：

- `test/crawler.test.js`
- `test/m6.qa.test.js`
- `test/m6.qa-validation.test.js`
- `test/m6.qa-parser-format.test.js`

## 測試指令與結果

```bash
node --test test/m6.qa-delay.test.js
```

結果：✅ 1 passed / 0 failed / 0 skipped。

```bash
npm test
```

結果：✅ 92 passed / 0 failed / 0 skipped / 0 todo。

重點輸出：

```text
tests 92
pass 92
fail 0
cancelled 0
skipped 0
todo 0
```

```bash
node -e "import('node-html-parser').then(() => console.log('ok'))"
```

結果：✅ `ok`

```bash
node --input-type=module - <<'NODE'
import { readFile } from 'node:fs/promises';
const sources = JSON.parse(await readFile('./config/sources.json', 'utf8'));
console.log(sources.length);
NODE
```

結果：✅ `2`

## 驗收標準逐條驗證

| AC | 結果 | 證據 |
|---|---|---|
| AC-1 `POST /api/crawl` 以 `type:'text'` 貼入 3 個號碼，回傳 `candidates` 長度 3 | ✅ | `npm test` 中 `POST /api/crawl with text source returns candidates, sourceType, and count` 通過；驗證 `count: 3` 與 3 筆 candidates。 |
| AC-2 `POST /api/crawl` body 缺少 `source` 回傳 400 | ✅ | `npm test` 中 `POST /api/crawl without source returns 400` 通過，回 `{ error: 'source is required' }`。 |
| AC-3 `POST /api/crawl` `source.type` 非 `text`/`url` 回傳 400 | ✅ | `npm test` 中 `POST /api/crawl with invalid source.type returns 400` 通過。 |
| AC-4 `extractFromText` 可從含雜訊多行字串萃取 10 碼數字 | ✅ | `crawler parser` 測試涵蓋基本多行、hyphen、無號碼、每行第一筆；`M6 QA parser phone formatting` 驗證空格與混合 `-`/空格格式。 |
| AC-5 `extractFromHtml` 可從 HTML 字串 + selector 萃取號碼 | ✅ | `extractFromHtml extracts candidates from matching selector text` 通過；QA edge case 驗證 selector 結果去重。 |
| AC-6 `checkRobots` 在 Disallow 時 throw；404 時 pass | ✅ | `crawler politeness` 測試涵蓋 Disallow throw 與 404 pass；`M6 QA API error paths` 驗證 API 將 Disallow 轉成 403。 |
| AC-7 `GET /api/crawl/sources` 回傳 JSON 陣列，長度 >= 1 | ✅ | `GET /api/crawl/sources returns configured source array` 通過；config 檢查為 2 筆。 |
| AC-8 `npm test` 全部通過，不含 skip | ✅ | `npm test`：92 passed / 0 failed / 0 skipped / 0 todo。 |
| AC-9 `POST /api/analyze` 既有行為不受影響 | ✅ | `api: golden case returns transformed analysis`、M4 HTTP integration、M5 error boundary 等既有回歸均通過。 |

## 額外 QA 驗證

| 項目 | 結果 | 證據 |
|---|---|---|
| URL source 預設延遲為 2000ms | ✅ | 新增 `test/m6.qa-delay.test.js`，攔截 `setTimeout` 並確認 delay 包含 `2000`。 |
| URL source 目標頁非 2xx 時回 500 | ✅ | `M6 QA API error paths` 驗證 503 目標頁回 `{ error: 'fetch failed: fetch failed: HTTP 503' }`。 |
| text source 缺 content / url source 缺 URL 或 URL 無效 | ✅ | `test/m6.qa-validation.test.js` 三個 case 均通過，皆回 400。 |
| 不應把 11 位以上數字序列截成 10 位候選 | ✅ | `M6 QA parser edge cases` 通過。 |

## 失敗項目

無。可驗證項目全部通過。

## ⚠️ 無法驗證(環境限制)

真實 socket/curl smoke test 無法在目前沙盒完成，因為環境禁止 listen `127.0.0.1`。

驗證指令：

```bash
node - <<'NODE'
import net from 'node:net';
const server = net.createServer();
server.once('error', (error) => console.log(error.code, error.message));
server.listen(0, '127.0.0.1', () => {
  console.log('listening', JSON.stringify(server.address()));
  server.close();
});
setTimeout(() => server.close(), 1000);
NODE
```

觀察結果：

```text
EPERM listen EPERM: operation not permitted 127.0.0.1
```

Express route 已透過 `app.handle()` 自動化測試驗證；此限制不列為 FAIL。

## Demo 步驟

在允許開本機 socket 的環境：

```bash
npm start
curl -s http://localhost:3000/api/crawl/sources
curl -s -X POST http://localhost:3000/api/crawl \
  -H 'Content-Type: application/json' \
  -d '{"source":{"type":"text","content":"0912345678\n0987654321"}}'
```

預期 POST 回傳：

```json
{"candidates":["0912345678","0987654321"],"sourceType":"text","count":2}
```
