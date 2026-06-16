import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('m8 runtime assets: production code uses config numerology data, not reference data', async () => {
  const source = await readFile(new URL('../src/engine/wuxingJudge.js', import.meta.url), 'utf8');
  const configData = JSON.parse(
    await readFile(new URL('../config/81數理.json', import.meta.url), 'utf8'),
  );

  assert.match(source, /\.\.\/\.\.\/config\/81數理\.json/);
  assert.doesNotMatch(source, /reference\/81數理\.json/);
  assert.equal(Object.keys(configData).length, 81);
  assert.ok(configData['1']);
  assert.ok(configData['81']);
});
