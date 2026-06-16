import { test } from 'node:test';
import assert from 'node:assert/strict';

import { analyzeHandler } from '../src/routes/analyze.js';

test('m4 qa: default groups are used when groups is omitted', () => {
  const { status, body } = analyzeHandler('0936102682');

  assert.equal(status, 200);
  assert.deepEqual(body.groups, ['093', '610', '2682']);
  assert.deepEqual(body.groupSums, { n1: 12, n2: 7, n3: 18 });
});

test('m4 qa: transformed API body does not leak raw engine internals', () => {
  const { status, body } = analyzeHandler('0936102682', [3, 3, 4]);

  assert.equal(status, 200);
  assert.equal(Object.hasOwn(body, 'numerology'), false);
  assert.equal(Object.hasOwn(body, 'wuxingRelations'), false);
  assert.deepEqual(Object.keys(body.fiveGrid), ['總格', '天格', '人格', '地格', '外格']);
  assert.deepEqual(Object.keys(body.extended), ['子息', '健康', '配偶', '朋友']);
});

test('m4 qa: handler returns merged five-grid data and fixed aiComment', () => {
  const { status, body } = analyzeHandler('0936102682', [3, 3, 4]);

  assert.equal(status, 200);
  assert.equal(body.input, '0936102682');
  assert.equal(body.aiComment, null);
  assert.equal(body.fiveGrid.總格.weight, 0.5);
  assert.equal(body.fiveGrid.總格.relation, undefined);
  assert.equal(typeof body.fiveGrid.天格.relation, 'string');
  assert.equal(typeof body.fiveGrid.天格.symbol, 'string');
  assert.equal(typeof body.fiveGrid.天格.luck, 'string');
});

test('m4 qa: handler returns 400 for empty and non-digit phone values', () => {
  const empty = analyzeHandler('', []);
  const spaced = analyzeHandler('0936 102682', [4, 6]);

  assert.equal(empty.status, 400);
  assert.equal(empty.body.error, 'phone must be a non-empty string of digits');
  assert.equal(spaced.status, 400);
  assert.equal(spaced.body.error, 'phone must be a non-empty string of digits');
});

test('m4 qa: malformed groups input is handled as a 400 response', async () => {
  const { status, body } = analyzeHandler('0936102682', '3-3-4');

  assert.equal(status, 400);
  assert.equal(typeof body.error, 'string');
});
