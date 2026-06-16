# ART BRIEF — M7: 好號碼篩選與排名頁

---

## 設計 Tokens

### 色彩

沿用 `public/style.css` 既有語意色，不新增色票：

| Token | 值 | 用途 |
|-------|----|------|
| `--color-good-bg` | `#d4edda` | `.symbol-good` 吉格背景 |
| `--color-good-text` | `#155724` | `.symbol-good` 文字 |
| `--color-mid-bg` | `#fff3cd` | `.symbol-mid` 中格背景 |
| `--color-mid-text` | `#856404` | `.symbol-mid` 文字 |
| `--color-bad-bg` | `#f8d7da` | `.symbol-bad` 凶格背景 |
| `--color-bad-text` | `#721c24` | `.symbol-bad` 文字 |
| `--color-hint` | `#666` | `.hint` 輔助文字 |
| `--color-border` | `#ccc` | 表格邊框 |
| `--color-th-bg` | `#f0f0f0` | 表頭背景 |

### 字體階層

| 層級 | 元素 | 大小 | 備註 |
|------|------|------|------|
| 頁面標題 | `<h1>` | 1.4rem | 導覽列內，比 index.html 略小 |
| 區塊標題 | `<h2>` | 1rem, bold | 色 #555 |
| 正文 | `<td>`, `<input>` | 繼承 (sans-serif) | — |
| 輔助說明 | `.hint` | 0.85em | 色 #666 |
| 電話欄位 | `<textarea>` | 0.9rem, monospace | 易辨識數字 |

### 間距系統

沿用 `style.css`：`margin/padding` 以 `0.25rem`、`0.5rem`、`0.75rem`、`1rem`、`1.5rem`、`2rem` 為基準單位。

---

## 頁面規劃

詳細 HTML 結構與互動規格見 `.workflow/rank-layout.md`。

### 頁面清單

| 頁面 | 路徑 | 狀態 |
|------|------|------|
| 單號分析 | `public/index.html` | 既有（本里程碑小修改） |
| 篩選排名 | `public/rank.html` | 本里程碑新增 |

---

## 資產清單

### 本里程碑所需資產

本頁面為純資料表格 UI，**不需要圖片、logo 或插圖**。
所有視覺元素均由 CSS 色彩與 Unicode 符號（`○` `▲` `X` `★`）表達。

| 資產 | 結論 |
|------|------|
| Logo / 品牌圖 | 不需要（延用文字標題） |
| Icon | 不需要 |
| 插圖 / 空狀態圖 | 不需要（空白表格即為空狀態） |
| 動畫 / 影片 | 不需要 |

> 若未來需要 logo，建議以 SVG 文字排版製作，風格關鍵字（style anchor）：
> `minimalist flat icon, Chinese numerology theme, ink brush stroke accent, monochrome with gold highlight, clean white background`

---

## 元件清單

### rank.html 元件

| 元件名稱 | HTML 元素 | id / class | 互動 |
|---------|-----------|------------|------|
| 返回導覽連結 | `<a>` | — | 點擊跳回 index.html |
| 來源下拉選單 | `<select>` | `#sourceSelect` | change → 切換輸入模式 |
| 手動輸入區 | `<textarea>` | `#manualInput` | 使用者貼入號碼 |
| 抓取按鈕 | `<button>` | `#crawlBtn` | click → POST /api/crawl |
| 抓取預覽 | `<div>` | `#crawlPreview` | 顯示抓到筆數與前 5 筆 |
| 最低評分輸入 | `<input type=number>` | `#minScore` | 值傳至 POST /api/rank |
| 分組規則輸入 | `<input type=text>` | `#groups` | 值傳至 POST /api/rank |
| 排名按鈕 | `<button>` | `#rankBtn` | click → POST /api/rank |
| 進度提示 | `<div>` | `#progress` | 顯示「分析中…」 |
| 統計資訊 | `<div>` | `#stats` | 顯示 N/M/K 筆統計 |
| 排名表格 | `<table>` | `#rankTable` | 渲染排名結果 |
| 錯誤訊息 | `<div>` | `#error` | 顯示 API 錯誤 |

---

## 無需產圖說明

本里程碑無須呼叫 Higgsfield CLI、OpenAI API 或任何圖像生成工具。
所有視覺由既有 CSS 完整覆蓋。
