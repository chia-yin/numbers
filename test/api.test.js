import { test } from 'node:test';
import assert from 'node:assert/strict';

import { analyzeHandler } from '../src/routes/analyze.js';

test('api: golden case returns transformed analysis', () => {
  const { status, body } = analyzeHandler('0936102682', [3, 3, 4]);

  assert.equal(status, 200);
  assert.equal(body.fiveGrid.總格.wuxing, '金');
  assert.equal(body.fiveGrid.總格.weight, 0.50);
  assert.equal(typeof body.score.weighted, 'number');
  assert.equal(body.aiComment, null);
});

test('api: non-digit phone returns 400', () => {
  const { status, body } = analyzeHandler('abc', undefined);

  assert.equal(status, 400);
  assert.equal(typeof body.error, 'string');
});

test('api: mismatched groups sum returns 400', () => {
  const { status, body } = analyzeHandler('0936102682', [3, 3, 5]);

  assert.equal(status, 400);
  assert.match(body.error, /groups sum/);
});

test('api: relations are merged into fiveGrid and extended', () => {
  const { body } = analyzeHandler('0936102682', [3, 3, 4]);

  assert.equal(typeof body.fiveGrid.天格.relation, 'string');
  assert.equal(body.fiveGrid.總格.relation, undefined);
  assert.equal(typeof body.extended.子息.relation, 'string');
});
