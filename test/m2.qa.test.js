import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  analyze,
  calcExtended,
  calcFiveGrid,
  splitGroups,
  sumGroup,
  toLastDigit,
  toWuxing,
} from '../src/engine/calculator.js';
import { DEFAULT_GROUP_CONFIG } from '../src/engine/groupConfig.js';

test('M2 QA: golden analyze result matches the full published data model exactly', () => {
  assert.deepEqual(analyze('036102682', [3, 3, 3]), {
    input: '036102682',
    groups: ['036', '102', '682'],
    groupSums: { n1: 9, n2: 3, n3: 16 },
    fiveGrid: {
      總格: { value: 28, digit: 8, wuxing: '金' },
      天格: { value: 10, digit: 0, wuxing: '水' },
      人格: { value: 12, digit: 2, wuxing: '木' },
      地格: { value: 19, digit: 9, wuxing: '水' },
      外格: { value: 17, digit: 7, wuxing: '金' },
    },
    extended: {
      子息: { value: 27, digit: 7, wuxing: '金' },
      健康: { value: 36, digit: 6, wuxing: '土' },
      配偶: { value: 22, digit: 2, wuxing: '木' },
      朋友: { value: 31, digit: 1, wuxing: '木' },
    },
  });
});

test('M2 QA: default Taiwan mobile grouping handles a 10-digit all-zero number', () => {
  assert.deepEqual(DEFAULT_GROUP_CONFIG, [3, 3, 4]);

  const result = analyze('0000000000');

  assert.deepEqual(result.groups, ['000', '000', '0000']);
  assert.deepEqual(result.groupSums, { n1: 0, n2: 0, n3: 0 });
  assert.deepEqual(result.fiveGrid, {
    總格: { value: 0, digit: 0, wuxing: '水' },
    天格: { value: 1, digit: 1, wuxing: '木' },
    人格: { value: 0, digit: 0, wuxing: '水' },
    地格: { value: 0, digit: 0, wuxing: '水' },
    外格: { value: 1, digit: 1, wuxing: '木' },
  });
  assert.deepEqual(result.extended, {
    子息: { value: 2, digit: 2, wuxing: '木' },
    健康: { value: 1, digit: 1, wuxing: '木' },
    配偶: { value: 1, digit: 1, wuxing: '木' },
    朋友: { value: 0, digit: 0, wuxing: '水' },
  });
});

test('M2 QA: splitGroups rejects mismatched lengths with the specified error meaning', () => {
  assert.throws(
    () => splitGroups('12345', [3, 3, 3]),
    /長度|不符/,
  );
});

test('M2 QA: digit and wuxing boundary table is complete', () => {
  assert.equal(toLastDigit(0), 0);
  assert.equal(toLastDigit(10), 0);
  assert.equal(toLastDigit(99), 9);
  assert.equal(toLastDigit(123456), 6);

  assert.deepEqual(
    Array.from({ length: 10 }, (_, digit) => toWuxing(digit)),
    ['水', '木', '木', '火', '火', '土', '土', '金', '金', '水'],
  );
  assert.throws(() => toWuxing(-1), /0.*9|0–9/);
  assert.throws(() => toWuxing(10), /0.*9|0–9/);
});

test('M2 QA: exported calculator functions are synchronous, deterministic, and do not mutate config input', () => {
  const config = [3, 3, 3];
  const beforeConfig = [...config];

  const first = analyze('036102682', config);
  const second = analyze('036102682', config);

  assert.deepEqual(config, beforeConfig);
  assert.deepEqual(second, first);
  assert.equal(first instanceof Promise, false);
  assert.equal(splitGroups('036102682', config) instanceof Promise, false);
  assert.equal(sumGroup('682'), 16);
  assert.deepEqual(calcFiveGrid(9, 3, 16), {
    總格: 28,
    天格: 10,
    人格: 12,
    地格: 19,
    外格: 17,
  });
  assert.deepEqual(
    calcExtended({ 天格: 10, 人格: 12, 地格: 19, 外格: 17 }),
    { 子息: 27, 健康: 36, 配偶: 22, 朋友: 31 },
  );
});

test('M2 QA: engine modules stay ESM and do not import I/O or server libraries', async () => {
  const [calculatorSource, groupConfigSource] = await Promise.all([
    readFile('src/engine/calculator.js', 'utf8'),
    readFile('src/engine/groupConfig.js', 'utf8'),
  ]);

  assert.match(groupConfigSource, /export\s+const\s+DEFAULT_GROUP_CONFIG/);
  assert.match(calculatorSource, /import\s+\{\s*DEFAULT_GROUP_CONFIG\s*\}\s+from\s+['"]\.\/groupConfig\.js['"]/);
  assert.match(calculatorSource, /export\s+function\s+analyze/);
  assert.doesNotMatch(calculatorSource, /from\s+['"](?:node:)?fs['"]|from\s+['"](?:node:)?http['"]|from\s+['"]express['"]|fetch\s*\(/);
});
