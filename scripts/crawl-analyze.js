#!/usr/bin/env node
// 獨立爬蟲 + 五格分析腳本(無 AI,純老師數理)。
// 抓取選號網站號碼 → 算五格/五行/81數理吉凶斷語 → 輸出 CSV。
//
// 用法:
//   node scripts/crawl-analyze.js                 # 預設抓中華電信,全部列出
//   node scripts/crawl-analyze.js cht 4           # 只列「至少 4 個吉」的號碼
//   node scripts/crawl-analyze.js cht 0 > 好號.csv # 導出成 CSV 檔
//
// 來源 id:cht(中華電信,免瀏覽器)、fet(遠傳,需 Playwright)
import { readFileSync } from 'node:fs';
import { fetchCandidates } from '../src/crawler/index.js';
import { rankHandler } from '../src/routes/rank.js';

const ALIAS = { cht: 'cht-find-available', fet: 'fetnet-theme' };
const GRID = ['總格', '天格', '人格', '地格', '外格'];

const sources = JSON.parse(readFileSync(new URL('../config/sources.json', import.meta.url), 'utf8'));
const arg = process.argv[2] || 'cht';
const minGood = Number(process.argv[3] ?? 0);
const id = ALIAS[arg] || arg;
const src = sources.find((s) => s.id === id);

if (!src) {
  console.error(`找不到來源「${arg}」。可用:cht、fet(或 config/sources.json 裡的 id)`);
  process.exit(1);
}

const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

const main = async () => {
  console.error(`抓取「${src.name}」中…（可能需數分鐘）`);
  const candidates = await fetchCandidates(src);
  console.error(`抓到 ${candidates.length} 筆,計算五格中…`);

  const { body } = rankHandler({ candidates, minGood });

  const header = ['排名', '號碼', '吉數', ...GRID.flatMap((k) => [`${k}數值`, `${k}五行`, `${k}吉凶`, `${k}斷語`])];
  const lines = [header.map(csvCell).join(',')];

  for (const item of body.ranked) {
    const phone = item.phone ?? item.input;
    const cells = [
      String(item.rank),
      `="${phone}"`, // Excel 公式,保留開頭 0
      csvCell(`${item.goodCount}/5`),
    ];
    for (const k of GRID) {
      const g = item.fiveGrid[k];
      cells.push(csvCell(g.value), csvCell(g.wuxing), csvCell(g.luck), csvCell(g.text));
    }
    lines.push(cells.join(','));
  }

  process.stdout.write('﻿' + lines.join('\r\n') + '\r\n');
  console.error(`完成:符合條件 ${body.total} 筆(已輸出 CSV)。`);
};

main().catch((err) => {
  console.error('失敗:', err.message);
  process.exit(1);
});
