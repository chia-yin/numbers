import { test } from 'node:test';
import assert from 'node:assert/strict';

import { rankHandler } from '../src/routes/rank.js';

test('rank: 預設列出全部,並依吉(○)數由多到少排序', () => {
  const { status, body } = rankHandler({
    candidates: ['0936102682', '0912345678', '0987654321'],
  });

  assert.equal(status, 200);
  assert.equal(body.ranked.length, 3);
  // 每筆都有 goodCount(0–5)
  for (const r of body.ranked) {
    assert.equal(typeof r.goodCount, 'number');
    assert.ok(r.goodCount >= 0 && r.goodCount <= 5);
  }
  // 吉數非遞增(由多到少)
  assert.ok(body.ranked[0].goodCount >= body.ranked[1].goodCount);
  assert.ok(body.ranked[1].goodCount >= body.ranked[2].goodCount);
  assert.equal(body.ranked[0].rank, 1);
  assert.equal(body.ranked[0].aiComment, undefined);
});

test('rank: minGood 5 只留五格全吉的號碼', () => {
  const { status, body } = rankHandler({
    candidates: ['0936102682', '0912345678', '0987654321'],
    minGood: 5,
  });

  assert.equal(status, 200);
  assert.ok(body.ranked.length <= 3);
  for (const r of body.ranked) assert.equal(r.goodCount, 5);
  assert.ok(body.filtered >= 0);
});

test('rank: minGood 超出 0–5 回 400', () => {
  const { status, body } = rankHandler({
    candidates: ['0936102682'],
    minGood: 9,
  });
  assert.equal(status, 400);
  assert.equal(body.error, 'minGood must be a number between 0 and 5');
});

test('rank: rejects more than 200 candidates', () => {
  const candidates = Array.from({ length: 20001 }, (_, i) => `09${String(i).padStart(8, '0')}`);
  const { status, body } = rankHandler({ candidates });

  assert.equal(status, 400);
  assert.equal(body.error, 'candidates limit is 20000');
});

test('rank: skips invalid candidates without throwing', () => {
  const { status, body } = rankHandler({
    candidates: ['abc', '0936102682', '0912345678'],
    minScore: 0,
  });

  assert.equal(status, 200);
  assert.equal(body.ranked.length, 2);
});
