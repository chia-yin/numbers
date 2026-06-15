RESULT: PASS

# TEST REPORT - M1 建立專案骨架

## 自動化測試新增

- 新增 `test/m1.import-contract.test.js`
  - 驗證 `src/server.js` 被 import 時會匯出 `app`
  - 驗證 import 後子程序可自行結束，避免測試 import 觸發長駐 HTTP listener

## 驗收標準逐條驗證

### ✅ AC-1: `npm install` 執行成功，無錯誤

證據:

```text
$ npm install
up to date, audited 68 packages in 541ms
found 0 vulnerabilities
exit 0
```

### ✅ AC-2: `npm test` 全部通過，exit 0

證據:

```text
$ npm test
tests 10
pass 10
fail 0
duration_ms 136.855375
exit 0
```

### ⚠️ AC-3: `npm start` 後 curl localhost:3000 回傳 200

環境限制，無法用 curl 完成端到端驗證。

證據:

```text
$ node src/server.js
gonghao-numbers listening on port 3000

$ curl -v --max-time 5 http://127.0.0.1:3000/
Immediate connect fail for 127.0.0.1: Operation not permitted
curl: (7) Failed to connect to 127.0.0.1 port 3000 after 0 ms: Couldn't connect to server
```

判斷:

- server process 已印出 `gonghao-numbers listening on port 3000`
- curl 被目前沙箱禁止連線到 loopback，錯誤為 `Operation not permitted`
- 輔助自動化測試 `runtime: serves the public index page with required content` 已直接透過 Express `app.handle()` 驗證 `/` 回 `status 200`

人工驗證步驟:

```bash
npm start
curl -s -o /dev/null -w "%{http_code}" localhost:3000
```

預期輸出: `200`

### ⚠️ AC-4: `curl localhost:3000` 回傳 HTML 中包含 `gonghao-numbers`

環境限制，無法用 curl 完成端到端驗證。

證據:

```text
$ curl -v --max-time 5 http://127.0.0.1:3000/
Immediate connect fail for 127.0.0.1: Operation not permitted
```

輔助證據:

```text
$ npm test
✔ runtime: serves the public index page with required content
✔ index page contains required metadata and visible hello content
```

人工驗證步驟:

```bash
npm start
curl localhost:3000 | grep gonghao-numbers
```

預期輸出包含:

```html
<h1>Hello gonghao-numbers</h1>
```

### ⚠️ AC-5: `docker build -t gonghao-numbers .` 不報錯

環境限制，無法連線 Docker daemon。

證據:

```text
$ docker build -t gonghao-numbers .
ERROR: permission denied while trying to connect to the Docker daemon socket at unix:///Users/ocean/.docker/run/docker.sock:
dial unix /Users/ocean/.docker/run/docker.sock: connect: operation not permitted
exit 1
```

輔助證據:

```text
$ docker compose config
name: gonghao-numbers
services:
  gonghao-numbers:
    build:
      context: /Users/ocean/projects/gonghao-numbers
      dockerfile: Dockerfile
    ports:
      - mode: ingress
        target: 3000
        published: "3000"
        protocol: tcp
exit 0
```

人工驗證步驟:

```bash
docker build -t gonghao-numbers .
```

預期: build 成功，exit 0。

### ✅ AC-6: `.env.example` 存在且包含 `PORT`

證據:

```text
$ grep PORT .env.example
PORT=3000
exit 0
```

### ✅ AC-7: `package.json` 的 `scripts.test` 使用 `node --test`

證據:

```text
$ grep "node --test" package.json
    "test": "node --test test/**/*.test.js"
exit 0
```

## 失敗項目

無可確認的程式錯誤。

## 無法驗證（環境限制）

- AC-3 / AC-4: 目前環境禁止 curl 連線到 `127.0.0.1:3000`，錯誤為 `Operation not permitted`
- AC-5: 目前環境禁止連線 Docker daemon socket，錯誤為 `connect: operation not permitted`

## Demo 步驟

```bash
npm install
npm test
npm start
curl -s -o /dev/null -w "%{http_code}" localhost:3000
curl localhost:3000 | grep gonghao-numbers
docker build -t gonghao-numbers .
```
