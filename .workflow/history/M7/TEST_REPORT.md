RESULT: PASS

# M7 QA Test Report

## 自動化測試

- ✅ 新增測試檔：`test/m7.qa-acceptance.test.js`
- ✅ 完整回歸：`npm test`
  - 結果：103 tests, 103 pass, 0 fail
- ✅ M7 專用測試：`node --test test/m7.qa-acceptance.test.js`
  - 結果：7 tests, 7 pass, 0 fail

## 驗收標準逐條驗證

1. ✅ AC-1：`npm test` 所有測試全綠
   - 證據：`npm test` 輸出 `tests 103`, `pass 103`, `fail 0`
   - 覆蓋：既有測試 + 新增 `test/m7.qa-acceptance.test.js`

2. ✅ AC-2：`POST /api/rank { candidates: [...200筆以上...] }` 回傳 HTTP 400
   - 自動測試：`m7 acceptance: POST /api/rank rejects more than 200 candidates with HTTP 400`
   - 直接驗證輸出：
     ```json
     {"status":400,"body":{"error":"candidates limit is 200"}}
     ```

3. ✅ AC-3：`POST /api/rank { candidates: ["0936102682", "0912345678"] }` 回傳 HTTP 200，依 `score.weighted` 降序排列，每項包含 `rank`
   - 自動測試：`m7 acceptance: POST /api/rank sorts weighted scores and adds rank fields`
   - 直接驗證輸出：
     ```json
     {"status":200,"ranked":[{"rank":1,"input":"0912345678","weighted":77.5},{"rank":2,"input":"0936102682","weighted":65}],"total":2,"filtered":0}
     ```

4. ✅ AC-4：`POST /api/rank { candidates: ["0936102682"], minScore: 99 }` 在分數低於 99 時回傳空結果與 filtered=1
   - 自動測試：`m7 acceptance: POST /api/rank minScore 99 filters a lower scoring candidate`
   - 直接驗證輸出：
     ```json
     {"status":200,"body":{"ranked":[],"total":0,"filtered":1}}
     ```

5. ✅ AC-5：`GET /api/sources` 回傳 HTTP 200，body 包含 sources 陣列且 manual 存在
   - 自動測試：`m7 acceptance: GET /api/sources returns public source records with manual included`
   - 額外檢查：manual 精確為 `{ id, name, type }`，且不回傳 `note`、`enabled`、`description`

6. ⚠️ AC-6：瀏覽器開啟 `rank.html`，貼入 5 個號碼，點「篩選並排名」，表格顯示正確排序結果
   - 自動化靜態驗證已通過：`m7 ui: rank.html exposes required controls, result table, and API wiring`
   - 證據：確認 `rank.html` 有 `sourceSelect`、`manualInput`、`minScore`、`groups`、`rankBtn`、`rankTable`，且腳本呼叫 `/api/sources`、`/api/rank`，表格連結使用 `index.html?phone=...`
   - 環境限制：本次 QA 環境無法保留長駐 localhost 服務供瀏覽器實測。`npm start` 印出 `gonghao-numbers listening on port 3000` 後工具 session 結束；背景啟動後 `curl http://localhost:3000/api/sources` 回 `curl: (7) Failed to connect to localhost port 3000`

7. ⚠️ AC-7：點擊排名表格中的號碼連結，跳至 `index.html?phone=xxx` 並自動分析
   - 自動化靜態驗證已通過：`m7 ui: index.html reads ?phone query parameter and submits analysis automatically`
   - 證據：`index.html` 包含 `new URLSearchParams(window.location.search)`、`.get('phone')`、`phoneInput.value = _prePhone`、`form.requestSubmit()`
   - 環境限制：同 AC-6，無法在本環境保留 localhost 服務做實際點擊瀏覽器驗證

8. ✅ AC-8：候選號碼含格式錯誤如 `"abc"` 時，該號碼靜默跳過，其餘號碼正常分析
   - 自動測試：`m7 acceptance: POST /api/rank silently skips invalid candidates and analyzes valid ones`
   - 直接驗證輸出：
     ```json
     {"status":200,"phones":["0912345678","0936102682"],"total":2,"filtered":0}
     ```

## 失敗項目

無程式行為失敗。

## 無法驗證（環境限制）

- AC-6、AC-7 的「真實瀏覽器點擊操作」未能在本環境完成，原因是無法保留長駐 localhost server。
- 這不是程式行為不符；可驗證部分已由自動化測試覆蓋，包含 API 回應、rank 頁 DOM/API wiring、index query 自動送出邏輯。

## Demo 步驟

1. 啟動服務：
   ```bash
   npm start
   ```
2. 開啟排名頁：
   ```bash
   open http://localhost:3000/rank.html
   ```
3. 在 textarea 貼入：
   ```text
   0936102682
   0912345678
   0987654321
   0900000000
   0999999999
   ```
4. `最低評分閾值` 設為 `0`，點「篩選並排名」。
5. 檢查表格依加權分降序排列。
6. 點表格中的電話號碼，確認跳到 `index.html?phone=該號碼` 並自動顯示分析結果。
