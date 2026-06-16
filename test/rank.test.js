import { test } from 'node:test';
import assert from 'node:assert/strict';

import { rankHandler } from '../src/routes/rank.js';

test('rank: sorts 3 candidates by weighted score descending', () => {
  const { status, body } = rankHandler({
    candidates: ['0936102682', '0912345678', '0987654321'],
    minScore: 0,
  });

  assert.equal(status, 200);
  assert.equal(body.ranked.length, 3);
  assert.ok(body.ranked[0].score.weighted >= body.ranked[1].score.weighted);
  assert.ok(body.ranked[1].score.weighted >= body.ranked[2].score.weighted);
  assert.equal(body.ranked[0].rank, 1);
  assert.equal(body.ranked[0].aiComment, undefined);
});

test('rank: minScore 100 filters results', () => {
  const { status, body } = rankHandler({
    candidates: ['0936102682', '0912345678', '0987654321'],
    minScore: 100,
  });

  assert.equal(status, 200);
  assert.ok(body.ranked.length <= 3);
  assert.ok(body.filtered >= 0);
});

test('rank: rejects more than 200 candidates', () => {
  const candidates = Array.from({ length: 201 }, (_, i) => `09${String(i).padStart(8, '0')}`);
  const { status, body } = rankHandler({ candidates });

  assert.equal(status, 400);
  assert.equal(body.error, 'candidates limit is 200');
});

test('rank: skips invalid candidates without throwing', () => {
  const { status, body } = rankHandler({
    candidates: ['abc', '0936102682', '0912345678'],
    minScore: 0,
  });

  assert.equal(status, 200);
  assert.equal(body.ranked.length, 2);
});
