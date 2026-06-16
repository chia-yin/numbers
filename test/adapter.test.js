import { access, readFile } from 'node:fs/promises';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { analyzeHandler } from '../src/routes/analyze.js';

async function importAdapter() {
  return import('../src/llm/adapter.js');
}

afterEach(async () => {
  try {
    const adapter = await importAdapter();
    adapter._setProviderForTest(null);
  } catch {
    // Individual tests assert the adapter import when it is part of the behavior.
  }
});

test('LLM_PROVIDER 未設定時，generateComment 回傳 null', async () => {
  const originalProvider = process.env.LLM_PROVIDER;
  delete process.env.LLM_PROVIDER;

  try {
    const adapter = await importAdapter();
    adapter._setProviderForTest(null);

    const result = await adapter.generateComment({});
    assert.equal(result, null);
  } finally {
    if (originalProvider === undefined) {
      delete process.env.LLM_PROVIDER;
    } else {
      process.env.LLM_PROVIDER = originalProvider;
    }
  }
});

test('注入 fake provider，generateComment 回傳 provider 的字串', async () => {
  const adapter = await importAdapter();
  adapter._setProviderForTest(async () => '這是測試解讀');

  const result = await adapter.generateComment({
    input: '0936102682',
    fiveGrid: {},
    score: {},
    extended: {},
  });

  assert.equal(result, '這是測試解讀');
});

test('fake provider throw 時，generateComment 回傳 null（不拋出）', async () => {
  const adapter = await importAdapter();
  adapter._setProviderForTest(async () => {
    throw new Error('LLM error');
  });

  const result = await adapter.generateComment({});
  assert.equal(result, null);
});

test('?aiComment 未帶時，路由核心回傳 aiComment: null', () => {
  const { status, body } = analyzeHandler('0936102682', [3, 3, 4]);

  assert.equal(status, 200);
  assert.equal(body.aiComment, null);
});

test('prompts/phone-comment.txt 存在且包含全部 placeholder', async () => {
  const promptPath = new URL('../prompts/phone-comment.txt', import.meta.url);
  await access(promptPath);
  const prompt = await readFile(promptPath, 'utf8');

  for (const placeholder of ['{{phone}}', '{{fiveGrid}}', '{{score}}', '{{extended}}']) {
    assert.match(prompt, new RegExp(placeholder.replaceAll('{', '\\{').replaceAll('}', '\\}')));
  }
});

test('.env.example 包含 M5 LLM 環境變數', async () => {
  const envExample = await readFile(new URL('../.env.example', import.meta.url), 'utf8');

  for (const key of ['LLM_PROVIDER', 'OPENAI_API_KEY', 'OPENAI_BASE_URL', 'OPENAI_MODEL']) {
    assert.match(envExample, new RegExp(`^${key}=`, 'm'));
  }
});

test('FE 提供 AI 解讀勾選、結果區塊，並依勾選狀態呼叫 query param', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');

  assert.match(html, /id="aiCommentToggle"/);
  assert.match(html, /id="aiCommentSection"/);
  assert.match(html, /id="aiCommentText"/);
  assert.match(html, /\?aiComment=true/);
});
