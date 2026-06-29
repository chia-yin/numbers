// 八字日主(日元/日干)推算:由國曆生日算當日天干與五行。
// 錨點:2000-01-07 為甲子日(已對萬年曆驗證)。日干每日進一,60 日一循環。
// 早子時(23:00 後)歸隔日,影響日柱 → 若提供時辰且為 23 時則進一日。

const ANCHOR = Date.UTC(2000, 0, 7) / 86400000; // 甲子日(天干甲)
const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const STEM_WUXING = ['木', '木', '火', '火', '土', '土', '金', '金', '水', '水'];
const STEM_YINYANG = ['陽', '陰', '陽', '陰', '陽', '陰', '陽', '陰', '陽', '陰'];

// 解析 'HH:mm' 或 '23時' 之類取小時;取不到回 null
function parseHour(birthTime) {
  if (!birthTime || typeof birthTime !== 'string') return null;
  const m = birthTime.match(/(\d{1,2})/);
  if (!m) return null;
  const h = Number(m[1]);
  return h >= 0 && h <= 23 ? h : null;
}

// 由國曆生日('YYYY-MM-DD')求日主。可選 birthTime 處理早子時。
export function computeDayMaster(birthDate, birthTime) {
  if (!birthDate || typeof birthDate !== 'string') return null;
  const m = birthDate.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!y || !mo || !d || mo < 1 || mo > 12 || d < 1 || d > 31) return null;

  let n = Date.UTC(y, mo - 1, d) / 86400000;
  const hour = parseHour(birthTime);
  if (hour === 23) n += 1; // 晚子時歸隔日

  const idx = (((n - ANCHOR) % 10) + 10) % 10;
  return {
    stem: STEMS[idx],
    wuxing: STEM_WUXING[idx],
    yinyang: STEM_YINYANG[idx],
    label: `${STEMS[idx]}${STEM_WUXING[idx]}`, // 例:丙火
  };
}
