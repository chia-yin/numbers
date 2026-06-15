VERDICT: APPROVE

# REVIEW — M1: 建立專案骨架

審查者：Staff Engineer  
審查日期：2026-06-15  
依據：`.workflow/SPEC.md`、`.workflow/TASKS.md`、`.workflow/TEST_REPORT.md`

---

## 整體評估

所有 AC（驗收條件）均達成或有充分替代驗證。實作品質良好，無 blocker 或 major 問題。
以下列出 minor 偏差供未來里程碑參考。

---

## 問題列表

### minor — src/server.js:9-13 — listen guard 超出 SPEC 範例

**描述：**  
SPEC 4.2 節的範例直接呼叫 `app.listen(PORT, ...)`，但實作加入了 ESM main-module guard：

```js
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  app.listen(PORT, () => { ... })
}
```

這導致 import server.js 時不啟動 HTTP listener，是超出 SPEC 的改動。

**影響評估：**  
功能上正確甚至更優——`npm start` 直接執行時 listen 仍會觸發（AC-3、AC-4 均滿足）；  
`npm test` import 時不產生懸掛的 listener，讓測試可正常結束。  
TASKS.md 備注「測試直接 import server.js，不啟動 HTTP server」也與此行為吻合。  
`m1.import-contract.test.js` 已自動驗證此合約。

**建議：**  
本里程碑可接受此改動。若後續里程碑需要在測試中直接 `app.listen()`（如 supertest 整合測試），需更新 SPEC 以對齊。

---

### minor — docker-compose.yml:7-8 — env_file 使用長格式

**描述：**  
SPEC 4.6 節指定：

```yaml
env_file:
  - .env
```

實作使用長格式並明確設 `required: false`：

```yaml
env_file:
  - path: .env
    required: false
```

**影響評估：**  
功能上更穩健——SPEC 本身備注「若 .env 不存在，docker compose 仍可跑（env_file 在 compose v2 中不存在時只警告不報錯）」，長格式的 `required: false` 只是把這個預期行為明確宣告出來。  
`docker compose config` 驗證通過，`m1.acceptance.test.js` 的 `assert.match(compose, /env_file:/)` 也通過。

**建議：**  
可接受，但若後續里程碑升級 Compose file 版本或改用其他 CI 環境，需確認長格式語法相容性。

---

### minor — test/ — 額外測試檔案超出 SPEC 範圍

**描述：**  
SPEC 只要求 `test/smoke.test.js`，實作新增了三個額外測試檔案：

- `test/m1.acceptance.test.js`：逐條驗證 M1 AC 的靜態內容
- `test/m1.runtime.test.js`：透過 `app.handle()` 驗證 HTTP 回應內容與靜態路由行為
- `test/m1.import-contract.test.js`：驗證 import server.js 後子程序可自行結束

**影響評估：**  
SPEC 的「不做什麼」未明確禁止額外測試；這些測試純屬增益，不破壞任何 AC。  
但已超出 M1 SPEC 範圍，屬於自行增加的改動，需記錄在案。

**建議：**  
後續里程碑 SPEC 應明確是否允許 agent 自行新增輔助測試，以統一慣例。

---

## 安全性檢查

| 項目 | 結果 |
|------|------|
| `.env` 已加入 `.gitignore` | ✅ (.gitignore line 3) |
| `.env.example` 無真實 secrets | ✅ (只有 `PORT=3000`) |
| `package-lock.json` 無異常依賴 | ✅ (僅 express 及其傳遞依賴) |
| `express.static()` 路徑不含使用者輸入 | ✅ (hardcoded `'public'`) |
| `reference/`、`.workflow/` 未被 COPY 進 image | ✅ (Dockerfile 只 COPY src/ 和 public/) |

---

## 驗收標準逐條確認

| AC | 結果 | 備注 |
|----|------|------|
| AC-1 npm install 無錯誤 | ✅ | TEST_REPORT 證據：0 vulnerabilities |
| AC-2 npm test 全部通過 | ✅ | 10 tests, 0 fail |
| AC-3 HTTP 200 | ⚠️ 環境限制 | 沙箱禁止 loopback；程式碼路徑正確，`app.handle()` 測試替代驗證 |
| AC-4 HTML 含 gonghao-numbers | ⚠️ 環境限制 | 同上；`m1.runtime.test.js` 替代驗證 |
| AC-5 docker build 不報錯 | ⚠️ 環境限制 | Docker daemon 不可用；`docker compose config` 通過 |
| AC-6 .env.example 含 PORT | ✅ | |
| AC-7 scripts.test 使用 node --test | ✅ | |

AC-3/AC-4/AC-5 的環境限制不屬於程式碼問題，人工驗證步驟已明確列於 TEST_REPORT。

---

## 結論

無 blocker，無 major。三個 minor 偏差均為功能等效或更優的改動，不影響合併。  
建議 APPROVE 並進入下一里程碑。
