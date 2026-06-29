import { createRequire } from 'node:module';
import { analyze } from './calculator.js';
import { DEFAULT_GROUP_CONFIG } from './groupConfig.js';

const require = createRequire(import.meta.url);
const numerologyData = require('../../config/81數理.json');

const GENERATES = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
const RESTRICTS = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };

const SYMBOL_SCORES = { '○': 2, '▲': 1, 'X': 0 };

const WEIGHTS = {
  總格: 0.5,
  外格: 0.25,
  人格: 0.15,
  地格: 0.1,
  天格: 0.05,
};

const FIVE_GRID_KEYS = ['總格', '天格', '人格', '地格', '外格'];
const EXTENDED_KEYS = ['子息', '健康', '配偶', '朋友'];

export function normalizeNumerologyKey(value) {
  if (value >= 1 && value <= 81) return value;
  return ((((value - 1) % 80) + 80) % 80) + 1;
}

export function lookupNumerology(value) {
  const key = normalizeNumerologyKey(value);
  return numerologyData[String(key)];
}

export function getWuxingRelation(source, target) {
  if (source === target) return '比和';
  if (GENERATES[source] === target) return '本體生X';
  if (GENERATES[target] === source) return 'X生本體';
  if (RESTRICTS[source] === target) return '本體剋X';
  if (RESTRICTS[target] === source) return 'X剋本體';
  throw new Error(`無法判定五行生克: ${source} vs ${target}`);
}

function symbolToScore(symbol) {
  return SYMBOL_SCORES[symbol] ?? 0;
}

export function calcWeightedScore(numerologyMap) {
  const raw =
    (symbolToScore(numerologyMap.總格.symbol) * WEIGHTS.總格 +
      symbolToScore(numerologyMap.外格.symbol) * WEIGHTS.外格 +
      symbolToScore(numerologyMap.人格.symbol) * WEIGHTS.人格 +
      symbolToScore(numerologyMap.地格.symbol) * WEIGHTS.地格 +
      symbolToScore(numerologyMap.天格.symbol) * WEIGHTS.天格) /
    2 *
    100;
  const capped = Math.min(100, raw);
  return Math.round(capped * 10) / 10;
}

export function calcLevel(score) {
  if (score >= 80) return '大吉';
  if (score >= 60) return '吉';
  if (score >= 40) return '半吉';
  if (score >= 20) return '凶';
  return '大凶';
}

// 兩五行的關係(以 a 對 b 的方向):比和 / 生(a生b,上生下) / 被生 / 剋(a剋b,上剋下) / 被剋
function pairRelation(a, b) {
  if (a === b) return '比和';
  if (GENERATES[a] === b) return '生';
  if (GENERATES[b] === a) return '被生';
  if (RESTRICTS[a] === b) return '剋';
  return '被剋';
}

// 友情之剋:金剋木(如刀雕木成器,主棟梁之才、經商才能),剋中帶吉,不以凶論
function isFriendlyRestrict(a, b) {
  return a === '金' && b === '木';
}

// 三才:天才(天格五行)→人才(人格五行)→地才(地格五行) 的配置與吉凶
export function computeSancai(fiveGrid) {
  const t = fiveGrid.天格.wuxing;
  const r = fiveGrid.人格.wuxing;
  const d = fiveGrid.地格.wuxing;
  const tr = pairRelation(t, r);
  const rd = pairRelation(r, d);
  const trFriendly = tr === '剋' && isFriendlyRestrict(t, r);
  const rdFriendly = rd === '剋' && isFriendlyRestrict(r, d);
  // 生/比和=+1;剋=-1,但金剋木「友情之剋」視為+1(成材歷練)
  const seg = (rel, friendly) =>
    rel === '生' || rel === '比和' ? 1 : rel === '剋' ? (friendly ? 1 : -1) : 0;
  const score = seg(tr, trFriendly) + seg(rd, rdFriendly);
  let luck, desc;
  if (score >= 2) { luck = '大吉'; desc = '三才相生,氣勢順暢,根基穩、運途旺。'; }
  else if (score === 1) { luck = '吉'; desc = '三才大致相生,整體平順向上。'; }
  else if (score === 0) { luck = '平'; desc = '三才平和,無生無剋,平穩持中。'; }
  else if (score === -1) { luck = '帶凶'; desc = '三才有相剋,過程易有阻礙,須留意。'; }
  else { luck = '凶'; desc = '三才相剋重,根基不穩,宜謹慎。'; }
  if (trFriendly || rdFriendly) desc += '當中金剋木為「友情之剋」,主棟梁之才、有經商歷練成器之象。';
  return { 天才: t, 人才: r, 地才: d, 配置: `${t}-${r}-${d}`, 天人關係: tr, 人地關係: rd, luck, desc };
}

// 四季論強弱:數值十位定四季(0,1春/2,3夏/4,5秋/6,7冬),五行於旺季強
// 旺=當令/生長季,相=生我之季,其餘弱。木依老師特例:春夏旺、秋冬弱。
const SEASON_BY_TENS = ['春', '春', '夏', '夏', '秋', '秋', '冬', '冬', '春'];
const SEASON_PEAK = { 木: ['春', '夏'], 火: ['夏'], 土: ['夏'], 金: ['秋'], 水: ['冬'] };
const SEASON_THRIVE = { 火: '春', 土: '夏', 水: '秋' }; // 生我之季(相);木不採
export function computeSeason(value, wuxing) {
  const tens = Math.floor((value % 100) / 10);
  const season = SEASON_BY_TENS[tens] ?? '春';
  let label, desc;
  if (SEASON_PEAK[wuxing]?.includes(season)) {
    label = '旺'; desc = `${season}之${wuxing},當令得時,能量旺。`;
  } else if (SEASON_THRIVE[wuxing] === season) {
    label = '相'; desc = `${season}之${wuxing},得生扶,能量尚強。`;
  } else {
    label = '弱'; desc = `${season}之${wuxing},失令,能量偏弱。`;
  }
  return { season, label, desc };
}

// 五格五行能量分布:同一五行最多兩個;出現三個以上=能量過於集中、缺其他助力
export function computeEnergyBalance(fiveGrid) {
  const counts = {};
  for (const key of FIVE_GRID_KEYS) {
    const w = fiveGrid[key].wuxing;
    counts[w] = (counts[w] || 0) + 1;
  }
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const [dominant, dominantCount] = entries[0];
  const kinds = entries.length;
  let luck, desc;
  if (dominantCount >= 3) {
    luck = '偏弱';
    desc = `五格中「${dominant}」出現 ${dominantCount} 次,能量過於集中、同質性高,缺乏其他五行助力。`;
  } else if (kinds >= 4) {
    luck = '佳';
    desc = '五行分布均衡多元,彼此能相生相助,格局有後援。';
  } else {
    luck = '平';
    desc = '五行分布尚可,能量未過度集中。';
  }
  return { counts, dominant, dominantCount, kinds, luck, desc };
}

export function judgeAll(phoneNumber, groupConfig = DEFAULT_GROUP_CONFIG) {
  const base = analyze(phoneNumber, groupConfig);

  const numerology = {};
  for (const key of FIVE_GRID_KEYS) {
    numerology[key] = lookupNumerology(base.fiveGrid[key].value);
  }

  const source = base.fiveGrid.總格.wuxing;
  const wuxingRelations = { 本體: source };

  for (const key of ['天格', '人格', '地格', '外格']) {
    const wuxing = base.fiveGrid[key].wuxing;
    wuxingRelations[key] = { wuxing, relation: getWuxingRelation(source, wuxing) };
  }

  for (const key of EXTENDED_KEYS) {
    const wuxing = base.extended[key].wuxing;
    wuxingRelations[key] = { wuxing, relation: getWuxingRelation(source, wuxing) };
  }

  const weighted = calcWeightedScore(numerology);

  return {
    ...base,
    numerology,
    wuxingRelations,
    sancai: computeSancai(base.fiveGrid),
    energyBalance: computeEnergyBalance(base.fiveGrid),
    score: {
      weighted,
      level: calcLevel(weighted),
    },
    isPremium:
      numerology.總格.symbol === '○' && numerology.外格.symbol === '○',
  };
}
