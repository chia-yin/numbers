import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { extractFromText } from '../src/crawler/parser.js';

describe('M6 QA parser phone formatting', () => {
  test('extractFromText normalizes spaces in a phone number before matching', () => {
    assert.deepEqual(extractFromText('客服 0936 102 682 請來電'), ['0936102682']);
  });

  test('extractFromText normalizes mixed spaces and hyphens in a phone number', () => {
    assert.deepEqual(extractFromText('客服 0936-102 682 請來電'), ['0936102682']);
  });
});
