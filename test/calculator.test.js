import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  analyze,
  splitGroups,
  toWuxing,
} from '../src/engine/calculator.js';

test('golden: analyze("036102682", [3,3,3])', () => {
  const result = analyze('036102682', [3, 3, 3]);

  assert.deepEqual(result.groups, ['036', '102', '682']);
  assert.equal(result.groupSums.n1, 9);
  assert.equal(result.groupSums.n2, 3);
  assert.equal(result.groupSums.n3, 16);

  assert.equal(result.fiveGrid.總格.value, 28);
  assert.equal(result.fiveGrid.總格.digit, 8);
  assert.equal(result.fiveGrid.總格.wuxing, '金');

  assert.equal(result.fiveGrid.天格.value, 10);
  assert.equal(result.fiveGrid.天格.digit, 0);
  assert.equal(result.fiveGrid.天格.wuxing, '水');

  assert.equal(result.fiveGrid.人格.value, 12);
  assert.equal(result.fiveGrid.人格.digit, 2);
  assert.equal(result.fiveGrid.人格.wuxing, '木');

  assert.equal(result.fiveGrid.地格.value, 19);
  assert.equal(result.fiveGrid.地格.digit, 9);
  assert.equal(result.fiveGrid.地格.wuxing, '水');

  assert.equal(result.fiveGrid.外格.value, 17);
  assert.equal(result.fiveGrid.外格.digit, 7);
  assert.equal(result.fiveGrid.外格.wuxing, '金');

  assert.equal(result.extended.子息.value, 27);
  assert.equal(result.extended.子息.wuxing, '金');

  assert.equal(result.extended.健康.value, 36);
  assert.equal(result.extended.健康.wuxing, '土');

  assert.equal(result.extended.配偶.value, 22);
  assert.equal(result.extended.配偶.wuxing, '木');

  assert.equal(result.extended.朋友.value, 31);
  assert.equal(result.extended.朋友.wuxing, '木');
});

test('edge: all-zero phone number', () => {
  const result = analyze('000000000', [3, 3, 3]);

  assert.equal(result.fiveGrid.天格.value, 1);
  assert.equal(result.fiveGrid.外格.value, 1);
  assert.equal(result.fiveGrid.總格.value, 0);
  assert.equal(result.fiveGrid.人格.value, 0);
  assert.equal(result.fiveGrid.地格.value, 0);
});

test('edge: length mismatch throws', () => {
  assert.throws(() => splitGroups('12345', [3, 3, 3]));
});

test('edge: toWuxing out of range throws', () => {
  assert.throws(() => toWuxing(10));
});
