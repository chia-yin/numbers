import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeNumerologyKey,
  lookupNumerology,
  getWuxingRelation,
  calcWeightedScore,
  calcLevel,
  judgeAll,
} from '../src/engine/wuxingJudge.js';

test('M3 QA: normalizeNumerologyKey boundary values', () => {
  assert.equal(normalizeNumerologyKey(1), 1);
  assert.equal(normalizeNumerologyKey(81), 81);
  assert.equal(normalizeNumerologyKey(0), 80);
  assert.equal(normalizeNumerologyKey(82), 2);
  assert.equal(normalizeNumerologyKey(161), 1);
});

test('M3 QA: lookupNumerology returns correct entries from 81數理.json', async () => {
  const data = JSON.parse(await readFile('reference/81數理.json', 'utf8'));

  assert.deepEqual(lookupNumerology(1), data['1']);
  assert.deepEqual(lookupNumerology(28), data['28']);
  assert.deepEqual(lookupNumerology(82), data['2']);

  const entry = lookupNumerology(28);
  assert.equal(typeof entry.symbol, 'string');
  assert.equal(typeof entry.luck, 'string');
  assert.equal(typeof entry.text, 'string');
});

test('M3 QA: getWuxingRelation follows the five-element cycle rules', () => {
  assert.equal(getWuxingRelation('木', '木'), '比和');
  assert.equal(getWuxingRelation('木', '火'), '本體生X');
  assert.equal(getWuxingRelation('木', '土'), '本體剋X');
  assert.equal(getWuxingRelation('木', '金'), 'X剋本體');
  assert.equal(getWuxingRelation('木', '水'), 'X生本體');
  assert.equal(getWuxingRelation('金', '水'), '本體生X');
  assert.equal(getWuxingRelation('金', '木'), '本體剋X');
  assert.equal(getWuxingRelation('金', '火'), 'X剋本體');
  assert.equal(getWuxingRelation('金', '土'), 'X生本體');
});

test('M3 QA: calcWeightedScore applies symbol weights correctly', () => {
  assert.equal(
    calcWeightedScore({
      總格: { symbol: '○' },
      外格: { symbol: '○' },
      人格: { symbol: '○' },
      地格: { symbol: '○' },
      天格: { symbol: '○' },
    }),
    100,
  );
  assert.equal(
    calcWeightedScore({
      總格: { symbol: 'X' },
      外格: { symbol: 'X' },
      人格: { symbol: 'X' },
      地格: { symbol: 'X' },
      天格: { symbol: 'X' },
    }),
    0,
  );
  assert.equal(
    calcWeightedScore({
      總格: { symbol: '○' },
      外格: { symbol: 'X' },
      人格: { symbol: 'X' },
      地格: { symbol: 'X' },
      天格: { symbol: 'X' },
    }),
    50,
  );
});

test('M3 QA: calcLevel maps score thresholds to level labels', () => {
  assert.equal(calcLevel(100), '大吉');
  assert.equal(calcLevel(80), '大吉');
  assert.equal(calcLevel(79.9), '吉');
  assert.equal(calcLevel(60), '吉');
  assert.equal(calcLevel(59.9), '半吉');
  assert.equal(calcLevel(40), '半吉');
  assert.equal(calcLevel(39.9), '凶');
  assert.equal(calcLevel(20), '凶');
  assert.equal(calcLevel(19.9), '大凶');
  assert.equal(calcLevel(0), '大凶');
});

test('M3 QA: judgeAll golden case 036-102-682 with full M3 fields', async () => {
  const data = JSON.parse(await readFile('reference/81數理.json', 'utf8'));
  const result = judgeAll('036102682', [3, 3, 3]);

  assert.equal(result.input, '036102682');
  assert.deepEqual(result.fiveGrid.總格, { value: 28, digit: 8, wuxing: '金' });
  assert.equal(result.wuxingRelations.本體, '金');
  assert.deepEqual(result.wuxingRelations.天格, { wuxing: '水', relation: '本體生X' });
  assert.deepEqual(result.wuxingRelations.人格, { wuxing: '木', relation: '本體剋X' });
  assert.deepEqual(result.wuxingRelations.地格, { wuxing: '水', relation: '本體生X' });
  assert.deepEqual(result.wuxingRelations.外格, { wuxing: '金', relation: '比和' });
  assert.deepEqual(result.wuxingRelations.子息, { wuxing: '金', relation: '比和' });
  assert.deepEqual(result.wuxingRelations.健康, { wuxing: '土', relation: 'X生本體' });
  assert.deepEqual(result.wuxingRelations.配偶, { wuxing: '木', relation: '本體剋X' });
  assert.deepEqual(result.wuxingRelations.朋友, { wuxing: '木', relation: '本體剋X' });
  assert.deepEqual(result.numerology.總格, data['28']);
  assert.deepEqual(result.numerology.外格, data['17']);
  assert.equal(typeof result.score.weighted, 'number');
  assert.equal(['大吉', '吉', '半吉', '凶', '大凶'].includes(result.score.level), true);
  assert.equal(typeof result.isPremium, 'boolean');
});

test('M3 QA: wuxingJudge.js stays pure ESM without HTTP or express imports', async () => {
  const source = await readFile('src/engine/wuxingJudge.js', 'utf8');

  assert.doesNotMatch(source, /from\s+['"]express['"]/);
  assert.doesNotMatch(source, /from\s+['"]node:http['"]/);
  assert.doesNotMatch(source, /fetch\s*\(/);
  assert.match(source, /export\s+function\s+judgeAll/);
  assert.match(source, /export\s+function\s+getWuxingRelation/);
});
