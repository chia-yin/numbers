import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { analyze } from '../src/engine/calculator.js';
import {
  judgeAll,
  lookupNumerology,
  normalizeNumerologyKey,
} from '../src/engine/wuxingJudge.js';

test('M3 contract: judgeAll preserves the M2 analyze payload exactly', () => {
  const input = '0912345678';
  const base = analyze(input);
  const judged = judgeAll(input);

  assert.equal(judged.input, base.input);
  assert.deepEqual(judged.groups, base.groups);
  assert.deepEqual(judged.groupSums, base.groupSums);
  assert.deepEqual(judged.fiveGrid, base.fiveGrid);
  assert.deepEqual(judged.extended, base.extended);
});

test('M3 contract: judgeAll uses the default group config and propagates invalid length errors', () => {
  assert.deepEqual(judgeAll('0000000000').groups, ['000', '000', '0000']);
  assert.throws(() => judgeAll('000000000'), /號碼長度與分組設定不符/);
});

test('M3 contract: numerology lookup normalizes 0 and values above 81', async () => {
  const data = JSON.parse(await readFile('reference/81數理.json', 'utf8'));

  assert.equal(normalizeNumerologyKey(0), 80);
  assert.deepEqual(lookupNumerology(0), data['80']);
  assert.equal(normalizeNumerologyKey(270), 30);
  assert.deepEqual(lookupNumerology(270), data['30']);
});

test('M3 contract: judgeAll normalizes large five-grid values before lookup', async () => {
  const data = JSON.parse(await readFile('reference/81數理.json', 'utf8'));
  const result = judgeAll('999999999999999999999999999999', [10, 10, 10]);

  assert.equal(result.fiveGrid.總格.value, 270);
  assert.deepEqual(result.numerology.總格, data['30']);
  assert.equal(result.fiveGrid.天格.value, 91);
  assert.deepEqual(result.numerology.天格, data['11']);
  assert.equal(result.fiveGrid.人格.value, 180);
  assert.deepEqual(result.numerology.人格, data['20']);
  assert.equal(result.fiveGrid.地格.value, 180);
  assert.deepEqual(result.numerology.地格, data['20']);
  assert.equal(result.fiveGrid.外格.value, 91);
  assert.deepEqual(result.numerology.外格, data['11']);
});

test('M3 contract: isPremium is true only when both total and outer grids are auspicious', () => {
  const premium = judgeAll('1234567890');
  assert.equal(premium.numerology.總格.symbol, '○');
  assert.equal(premium.numerology.外格.symbol, '○');
  assert.equal(premium.isPremium, true);

  const totalOnly = judgeAll('0912345678');
  assert.equal(totalOnly.numerology.總格.symbol, '○');
  assert.notEqual(totalOnly.numerology.外格.symbol, '○');
  assert.equal(totalOnly.isPremium, false);

  const outerOnly = judgeAll('0000000000');
  assert.notEqual(outerOnly.numerology.總格.symbol, '○');
  assert.equal(outerOnly.numerology.外格.symbol, '○');
  assert.equal(outerOnly.isPremium, false);
});
