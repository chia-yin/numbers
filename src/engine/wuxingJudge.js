import { createRequire } from 'node:module';
import { analyze } from './calculator.js';
import { DEFAULT_GROUP_CONFIG } from './groupConfig.js';

const require = createRequire(import.meta.url);
const numerologyData = require('../../reference/81數理.json');

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
    score: {
      weighted,
      level: calcLevel(weighted),
    },
    isPremium:
      numerology.總格.symbol === '○' && numerology.外格.symbol === '○',
  };
}
