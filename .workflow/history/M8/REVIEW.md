VERDICT: APPROVE

# M8 Code Review

審查日期：2026-06-16
審查者：Staff Engineer

---

## 整體評估

M8 的核心目標（Dockerfile multi-stage、docker-compose healthcheck、README、.dockerignore）均已正確實作，靜態驗收指令全數通過，108/109 tests pass（1 skip 為 Docker daemon 不可用，屬環境限制非邏輯錯誤）。有 2 個超出 SPEC 範圍的改動，但均有正當理由且已留下明確紀錄。

---

## 問題清單

### [minor] src/engine/wuxingJudge.js:6 — 超出 SPEC 範圍改動 import 路徑

**嚴重程度：minor**（已有充分正當理由，不擋 approve）

```js
// 改動前
const numerologyData = require('../../reference/81數理.json');
// 改動後
const numerologyData = require('../../config/81數理.json');
```

SPEC §2「不做什麼」明確寫出「src/ 均不動」，此改動技術上超出範圍。然而：

- TASKS.md T3 BLOCKED 欄位已明確說明阻擋原因，並指出解法為「BE 將資料移至 `config/` 並更新 import」。
- `reference/` 不進 image 是 SPEC 自身的設計決定，導致 `wuxingJudge.js` 在容器內執行時必然 crash。此為 SPEC 遺漏，不是 agent 偷改。
- 改動範圍最小（單行 path 修改），無邏輯變更。
- `test/m8.qa-runtime-assets.test.js` 新增驗證，確保 `config/81數理.json` 存在且完整（1–81 共 81 筆）。

**建議**：後續更新 SPEC 或 ROADMAP，補充「`wuxingJudge.js` 引用路徑必須指向 `config/`」，讓設計決定有文字依據。

---

### [minor] test/m1.acceptance.test.js:68 — 超出 SPEC 範圍修改測試

**嚴重程度：minor**（屬於連動必要修正，不擋 approve）

```js
// 改動前
assert.match(dockerfile, /RUN\s+npm\s+install\s+--omit=dev/)
// 改動後
assert.match(dockerfile, /RUN\s+npm\s+ci\s+--omit=dev/)
```

SPEC §2 說「test/ 均不動」，此改動技術上超出範圍。但若不修改，M1 驗收測試因 Dockerfile 改用 `npm ci` 而失敗，形成測試永遠紅燈的矛盾。屬連動修正，且改動量為 1 字（`install` → `ci`），可接受。

**建議**：此類「Dockerfile 指令變更導致 M1 測試需同步更新」的情況，下次 SPEC 應在 T2 任務欄位明確列出「同步更新 m1.acceptance.test.js 對應 assertion」。

---

### [minor] README.md:58 — SPEC 內部標注意外洩入公開文件

**嚴重程度：minor**（文件品質問題，不影響功能）

```markdown
- 地格 = n1 + n3（誤，應為 n3）
```

「（誤，應為 n3）」是 SPEC.md §3.3.6 裡的自我修正標注（作者標記自己寫錯的公式），不應出現在使用者可見的 README。這行說「地格 = n1 + n3，但這是錯的，應為 n3」——句意自相矛盾，對使用者毫無幫助。

**建議修法**：移除 `（誤，應為 n3）`，保留正確公式，或直接將整行改為 `- 地格 = n3`。

---

### [minor] TASKS.md T3 — 完成標記未更新

T3 checkbox 仍為 `[ ]`（未勾選），但 `docker-compose.yml` healthcheck 已實作，阻擋原因（`reference/81數理.json` 不在 image）也已解除。

**建議**：將 T3 改為 `[x]`，同步更新 BLOCKED 說明為已解決。

---

## 驗收標準逐條核對

| # | 判定 | 依據 |
|---|------|------|
| AC-1 `docker compose up` → HTTP 200 | ✅ 靜態通過 / ⚠️ 執行期待人工驗證 | Dockerfile 正確、wuxingJudge.js 路徑已修正、static test pass |
| AC-2 image 不含 `reference/` | ✅ 靜態通過 | Dockerfile 未 COPY reference/；.dockerignore 含 reference/ |
| AC-3 image 不含 `test/` | ✅ 靜態通過 | Dockerfile 未 COPY test/；.dockerignore 含 test/ |
| AC-4 README 含 5 個環境變數名稱 | ✅ PASS | grep 驗證通過 |
| AC-5 README 含 docker compose up | ✅ PASS | grep 驗證通過 |
| AC-6 README 含至少 4 個 API 端點 | ✅ PASS | grep -c "/api/" → 5 |
| AC-7 docker-compose.yml 含 healthcheck | ✅ PASS | grep 驗證通過；使用 wget（alpine 相容）|
| AC-8 Dockerfile 為 multi-stage | ✅ PASS | grep -c "^FROM" → 2；AS builder / AS runner 均在位 |
| AC-9 `npm test` 全綠 | ✅ PASS | 109 tests，108 pass，0 fail，1 skip |
| AC-10 容器內存在 `prompts/` 與 `config/` | ✅ 靜態通過 / ⚠️ 執行期待人工驗證 | Dockerfile COPY 指令正確 |

---

## 安全性

- `.env` 正確列入 `.dockerignore` 與 `.gitignore`，不進 image 也不進 repo。
- `config/81數理.json` 為純靜態數理資料，無敏感資訊。
- 無新增 API 端點或輸入處理路徑，注入風險無新增。

---

## 執行期驗證備忘（有 Docker daemon 時執行）

```bash
docker build -t gonghao-numbers .
docker run --rm gonghao-numbers ls prompts config       # 兩目錄應存在
docker run --rm gonghao-numbers ls reference 2>&1       # 應出現 "No such file"
docker run --rm gonghao-numbers ls test 2>&1             # 應出現 "No such file"
docker compose up -d
curl -f http://localhost:3000/                           # 期望 HTTP 200
docker compose ps                                        # 期望 Status: healthy
docker compose down
```
