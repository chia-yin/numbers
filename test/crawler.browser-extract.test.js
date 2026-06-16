import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractAllPhones } from '../src/crawler/parser.js';

test('extractAllPhones 從整段文字抓出所有手機號碼並去重', () => {
  const text = `
    精選門號
    0936-102-682 月租 599
    0912 345 678
    重複 0936102682 又一次
    市話 02-1234-5678（不應入選）
    0988777666
  `;
  const phones = extractAllPhones(text);
  assert.ok(phones.includes('0936102682'));
  assert.ok(phones.includes('0912345678'));
  assert.ok(phones.includes('0988777666'));
  // 去重:0936102682 只出現一次
  assert.equal(phones.filter((p) => p === '0936102682').length, 1);
  // 市話不應被當成手機號
  assert.ok(!phones.includes('0212345678'));
});

test('extractAllPhones 對空字串/非字串安全', () => {
  assert.deepEqual(extractAllPhones(''), []);
  assert.deepEqual(extractAllPhones(null), []);
});
