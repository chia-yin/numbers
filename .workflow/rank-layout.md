# rank.html 頁面布局規格

> 供 [FE] agent 直接照做。不需要額外設計資源，全部使用 `public/style.css` 既有 class。

---

## HTML id 清單（7 個必要區塊）

| id | 元素 | 用途 |
|----|------|------|
| `sourceSelect` | `<select>` | 來源下拉選單 |
| `manualInput` | `<textarea>` | 手動貼入號碼（手動模式顯示） |
| `crawlBtn` | `<button>` | 抓取按鈕（URL 模式顯示） |
| `crawlPreview` | `<div>` | 抓取結果預覽 |
| `minScore` | `<input type="number">` | 最低評分閾值 |
| `groups` | `<input type="text">` | 分組規則 |
| `rankBtn` | `<button>` | 篩選並排名送出按鈕 |
| `progress` | `<div>` | 分析進度提示 |
| `stats` | `<div>` | 統計資訊文字 |
| `rankTable` | `<table>` | 排名結果表格 |
| `error` | `<div>` | 錯誤訊息區 |

---

## 完整 HTML 結構

```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>公號數字學 — 好號碼篩選排名</title>
  <link rel="stylesheet" href="./style.css">
  <!-- rank.html 專屬補充樣式（內嵌 <style>，見下方 CSS 節） -->
</head>
<body>

  <!-- 1. 導覽 header -->
  <header>
    <a href="index.html">← 單號分析</a>
    <h1>好號碼篩選排名</h1>
  </header>

  <!-- 2. 來源設定 -->
  <section id="sourceSection">
    <h2>來源設定</h2>

    <label>
      號碼來源
      <select id="sourceSelect">
        <!-- 由 JS 填入，初始為空或顯示 loading -->
        <option value="">載入中…</option>
      </select>
    </label>

    <!-- 手動模式（type=text，初始顯示） -->
    <label id="manualLabel">
      貼入號碼（一行一個）
      <textarea
        id="manualInput"
        rows="8"
        placeholder="0912345678&#10;0987654321&#10;0936102682"
      ></textarea>
    </label>

    <!-- URL 模式（初始隱藏） -->
    <div id="crawlControls" hidden>
      <button type="button" id="crawlBtn">抓取號碼</button>
      <div id="crawlPreview" class="hint"></div>
    </div>
  </section>

  <!-- 3. 篩選設定 -->
  <section id="filterSection">
    <h2>篩選設定</h2>

    <label>
      最低評分閾值（0–100）
      <input id="minScore" type="number" min="0" max="100" value="70">
    </label>

    <label>
      分組規則
      <input id="groups" type="text" value="3-3-4" pattern="^\d+(-\d+)+$">
    </label>
    <p class="hint">台灣手機 10 碼，預設 3-3-4</p>

    <button type="button" id="rankBtn">篩選並排名</button>
  </section>

  <!-- 4. 進度提示 -->
  <div id="progress" hidden class="hint"></div>

  <!-- 7. 錯誤訊息 -->
  <div id="error" hidden></div>

  <!-- 5. 統計資訊 -->
  <div id="stats" hidden></div>

  <!-- 6. 排名結果表格 -->
  <table id="rankTable" hidden>
    <thead>
      <tr>
        <th>排名</th>
        <th>電話號碼</th>
        <th>加權分</th>
        <th>評語</th>
        <th>雙吉格</th>
        <th>總格</th>
        <th>外格</th>
        <th>人格</th>
        <th>地格</th>
        <th>天格</th>
      </tr>
    </thead>
    <tbody>
      <!-- 由 JS renderRankTable() 填入 -->
    </tbody>
  </table>

</body>
</html>
```

---

## 區塊說明

### 1. `<header>` 導覽列
- 左側：`<a href="index.html">← 單號分析</a>`（純文字連結，同 index.html 風格）
- 右側（同行）：`<h1>好號碼篩選排名</h1>`

### 2. `<section id="sourceSection">` 來源設定
- `<select id="sourceSelect">`：由 `GET /api/sources` 填入，每個 `<option>` 帶 `data-type`、`data-url`、`data-selector` 屬性。
- `id="manualInput"` textarea：`type=text` 來源時顯示；rows=8；placeholder 示範 3 行號碼。
- `id="crawlBtn"` 按鈕與 `id="crawlPreview"` div：`type=url` 來源時顯示（由 `id="crawlControls"` div 包覆，toggle `hidden`）。
- 切換邏輯：`sourceSelect` 的 `change` 事件根據 `data-type` 決定顯示哪一組控制項。

### 3. `<section id="filterSection">` 篩選設定
- `id="minScore"`：`type=number`，`min=0`，`max=100`，`value=70`。
- `id="groups"`：`type=text`，`value="3-3-4"`，`pattern="^\d+(-\d+)+$"`。
- `id="rankBtn"`：`type=button`（非 submit，避免頁面重整）。

### 4. `<div id="progress">` 進度提示
- 初始 `hidden`；分析開始時顯示文字如「分析中… 50 / 100」；完成後再度隱藏。
- 套用 `.hint` class（灰色小字）。

### 5. `<div id="stats">` 統計資訊
- 初始 `hidden`；排名完成後更新文字並移除 `hidden`。
- 格式：「共分析 N 筆，通過 M 筆，過濾 K 筆」。

### 6. `<table id="rankTable">` 排名表格
- 初始 `hidden`；有資料後移除 `hidden`。
- 欄位順序（10 欄）：排名 | 電話號碼 | 加權分 | 評語 | 雙吉格 | 總格 | 外格 | 人格 | 地格 | 天格
- `<tbody>` 每 `<tr>` 依 `fiveGrid.總格.symbol` 套用：
  - `○` → `class="symbol-good"`
  - `▲` → `class="symbol-mid"`
  - `X` → `class="symbol-bad"`
- 電話號碼欄：`<a href="index.html?phone=0912345678">0912345678</a>`
- 加權分顯示到小數點第一位（`toFixed(1)`）。
- 評語欄顯示 `score.level`（如「大吉」）。
- 雙吉格欄：`isPremium` 為 true 顯示 `★`，否則空白。
- 五行欄：顯示各格的 `wuxing` 字串（如「水」「金」）。

### 7. `<div id="error">` 錯誤訊息
- 沿用 `style.css` 的 `#error` 樣式（紅底白字）。
- 初始 `hidden`；API 回非 200 時顯示 `data.error`。

---

## CSS 補充（`<style>` 內嵌在 rank.html）

下列為 rank.html 專屬、不影響 index.html 的補充樣式：

```css
/* 導覽列 */
header {
  display: flex;
  align-items: baseline;
  gap: 1.5rem;
  margin-bottom: 1.5rem;
  border-bottom: 1px solid #ddd;
  padding-bottom: 0.75rem;
}

header h1 {
  margin: 0;
  font-size: 1.4rem;
}

/* 區塊間距 */
section {
  margin-bottom: 1.5rem;
}

section h2 {
  font-size: 1rem;
  font-weight: bold;
  color: #555;
  margin-bottom: 0.5rem;
}

/* 表單控制元件 */
label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-bottom: 0.5rem;
  max-width: 400px;
}

textarea#manualInput {
  width: 100%;
  font-family: monospace;
  font-size: 0.9rem;
  resize: vertical;
}

input#minScore {
  width: 5rem;
}

input#groups {
  width: 8rem;
}

/* 按鈕 */
#crawlBtn,
#rankBtn {
  margin-top: 0.5rem;
  padding: 0.5rem 1.25rem;
  cursor: pointer;
}

#rankBtn {
  font-size: 1rem;
  font-weight: bold;
}

/* 統計資訊 */
#stats {
  margin: 0.75rem 0;
  font-size: 0.9rem;
  color: #555;
}

/* 排名表格：電話號碼連結 */
#rankTable a {
  color: inherit;
  text-decoration: underline;
}

/* 進度提示 */
#progress {
  margin: 0.5rem 0;
}
```

---

## 互動行為摘要

| 事件 | 目標元素 | 行為 |
|------|---------|------|
| `DOMContentLoaded` | — | `GET /api/sources` → 填入 `#sourceSelect`；初始顯示 `#manualLabel`，隱藏 `#crawlControls` |
| `change` | `#sourceSelect` | `type=text` → 顯示 `#manualLabel`、隱藏 `#crawlControls`；`type=url` → 反之 |
| `click` | `#crawlBtn` | `POST /api/crawl` 以選中 source 的 url/selector；成功後更新 `#crawlPreview`，暫存 candidates |
| `click` | `#rankBtn` | 決定 candidates → `POST /api/rank` → 渲染 `#rankTable`、`#stats`；錯誤 → `#error` |
