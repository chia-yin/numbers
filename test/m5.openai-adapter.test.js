import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';

const originalFetch = globalThis.fetch;
const originalEnv = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
  OPENAI_MODEL: process.env.OPENAI_MODEL,
};

function restoreEnv() {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  restoreEnv();
});

function sampleAnalysis() {
  return {
    input: '0936102682',
    fiveGrid: {
      總格: { value: 31, digit: 1, wuxing: '木', symbol: '○', luck: '吉' },
    },
    score: { weighted: 83.75, verdict: '吉' },
    extended: {
      健康: { value: 12, digit: 2, wuxing: '木', relation: '比和' },
    },
  };
}

test('m5: openaiAdapter builds OpenAI-compatible request and returns message content', async () => {
  process.env.OPENAI_API_KEY = 'test-key';
  process.env.OPENAI_BASE_URL = 'https://llm.example/v1';
  process.env.OPENAI_MODEL = 'qa-model';

  let capturedBody;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://llm.example/v1/chat/completions');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers['Content-Type'], 'application/json');
    assert.equal(options.headers.Authorization, 'Bearer test-key');

    capturedBody = JSON.parse(options.body);
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: '這是完整解讀內容。' } }],
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  };

  const { generateComment } = await import('../src/llm/openaiAdapter.js');
  const result = await generateComment(sampleAnalysis());

  assert.equal(result, '這是完整解讀內容。');
  assert.equal(capturedBody.model, 'qa-model');
  assert.equal(capturedBody.max_tokens, 400);
  assert.deepEqual(capturedBody.messages.map((message) => message.role), ['user']);
  assert.match(capturedBody.messages[0].content, /0936102682/);
  assert.match(capturedBody.messages[0].content, /83\.75/);
  assert.doesNotMatch(capturedBody.messages[0].content, /\{\{phone\}\}/);
  assert.doesNotMatch(capturedBody.messages[0].content, /\{\{fiveGrid\}\}/);
  assert.doesNotMatch(capturedBody.messages[0].content, /\{\{score\}\}/);
  assert.doesNotMatch(capturedBody.messages[0].content, /\{\{extended\}\}/);
});

test('m5: openaiAdapter uses documented defaults when optional env vars are absent', async () => {
  process.env.OPENAI_API_KEY = 'test-key';
  delete process.env.OPENAI_BASE_URL;
  delete process.env.OPENAI_MODEL;

  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/chat/completions');
    assert.equal(JSON.parse(options.body).model, 'gpt-4o-mini');
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: '預設設定回應。' } }],
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  };

  const { generateComment } = await import('../src/llm/openaiAdapter.js');
  const result = await generateComment(sampleAnalysis());

  assert.equal(result, '預設設定回應。');
});

test('m5: openaiAdapter throws on non-2xx provider response', async () => {
  process.env.OPENAI_API_KEY = 'test-key';
  process.env.OPENAI_BASE_URL = 'https://llm.example/v1';

  globalThis.fetch = async () => new Response('bad request', { status: 400 });

  const { generateComment } = await import('../src/llm/openaiAdapter.js');

  await assert.rejects(() => generateComment(sampleAnalysis()), /400/);
});

test('m5: openaiAdapter passes AbortSignal.timeout to fetch', async () => {
  process.env.OPENAI_API_KEY = 'test-key';
  process.env.OPENAI_BASE_URL = 'https://llm.example/v1';

  globalThis.fetch = async (_url, options) => {
    assert.ok(options.signal instanceof AbortSignal);
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: 'timeout signal ok' } }],
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  };

  const { generateComment } = await import('../src/llm/openaiAdapter.js');
  const result = await generateComment(sampleAnalysis());

  assert.equal(result, 'timeout signal ok');
});

test('m5: adapter returns null when openai fetch times out', async () => {
  process.env.LLM_PROVIDER = 'openai';
  process.env.OPENAI_API_KEY = 'test-key';

  globalThis.fetch = async () => {
    const error = new Error('The operation was aborted');
    error.name = 'AbortError';
    throw error;
  };

  const { generateComment } = await import('../src/llm/adapter.js');
  const result = await generateComment(sampleAnalysis());

  assert.equal(result, null);
});
