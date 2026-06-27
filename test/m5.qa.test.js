import http from 'node:http';
import { access, readFile } from 'node:fs/promises';
import { Duplex } from 'node:stream';
import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';

import { app } from '../src/server.js';

class CaptureSocket extends Duplex {
  chunks = [];

  _read() {}

  _write(chunk, encoding, callback) {
    this.chunks.push(Buffer.from(chunk));
    callback();
  }
}

async function requestAppJson(path, payload) {
  const body = JSON.stringify(payload);
  const reqSocket = new Duplex({
    read() {},
    write(chunk, encoding, callback) {
      callback();
    },
  });
  const req = new http.IncomingMessage(reqSocket);
  req.method = 'POST';
  req.url = path;
  req.headers = {
    host: 'localhost',
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(body),
  };

  const res = new http.ServerResponse(req);
  const resSocket = new CaptureSocket();
  res.assignSocket(resSocket);

  const finished = new Promise((resolve, reject) => {
    res.on('finish', resolve);
    res.on('error', reject);
    app.handle(req, res, (error) => {
      if (error) {
        reject(error);
      }
    });
  });

  req.push(body);
  req.push(null);

  await finished;

  const raw = Buffer.concat(resSocket.chunks).toString('utf8');
  const [, responseBody = ''] = raw.split('\r\n\r\n');
  return {
    body: JSON.parse(responseBody),
    raw,
    status: res.statusCode,
  };
}

function withEnv(updates) {
  const original = {};
  for (const key of Object.keys(updates)) {
    original[key] = process.env[key];
    if (updates[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = updates[key];
    }
  }
  return () => {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };
}

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('m5: aiComment=true with LLM_PROVIDER=openai returns generated comment from provider', async () => {
  const restoreEnv = withEnv({
    LLM_PROVIDER: 'openai',
    OPENAI_API_KEY: 'test-key',
    OPENAI_BASE_URL: 'https://llm.example/v1',
    OPENAI_MODEL: 'test-model',
  });
  let fetchCalls = 0;
  globalThis.fetch = async (url, options) => {
    fetchCalls += 1;
    assert.equal(url, 'https://llm.example/v1/chat/completions');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.Authorization, 'Bearer test-key');
    assert.equal(JSON.parse(options.body).model, 'test-model');
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: '這是一段測試用的口語解讀。' } }],
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  };

  try {
    const response = await requestAppJson('/api/analyze?aiComment=true', {
      phone: '0936102682',
      groups: [3, 3, 4],
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.aiComment, '這是一段測試用的口語解讀。');
    assert.equal(fetchCalls, 1);
  } finally {
    restoreEnv();
  }
});

test('m5: aiComment=true 當 LLM_PROVIDER=none 時 aiComment 為 null,HTTP 200', async () => {
  const restoreEnv = withEnv({
    LLM_PROVIDER: 'none',
    OPENAI_API_KEY: undefined,
    OPENAI_BASE_URL: undefined,
    OPENAI_MODEL: undefined,
  });
  globalThis.fetch = async () => {
    throw new Error('provider should not be called when LLM_PROVIDER is not configured');
  };

  try {
    const response = await requestAppJson('/api/analyze?aiComment=true', {
      phone: '0936102682',
      groups: [3, 3, 4],
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.aiComment, null);
  } finally {
    restoreEnv();
  }
});

test('m5: aiComment=false or missing query does not call provider even when env is configured', async () => {
  const restoreEnv = withEnv({
    LLM_PROVIDER: 'openai',
    OPENAI_API_KEY: 'test-key',
  });
  globalThis.fetch = async () => {
    throw new Error('provider should not be called without aiComment=true');
  };

  try {
    const withoutQuery = await requestAppJson('/api/analyze', {
      phone: '0936102682',
      groups: [3, 3, 4],
    });
    const falseQuery = await requestAppJson('/api/analyze?aiComment=false', {
      phone: '0936102682',
      groups: [3, 3, 4],
    });

    assert.equal(withoutQuery.status, 200);
    assert.equal(withoutQuery.body.aiComment, null);
    assert.equal(falseQuery.status, 200);
    assert.equal(falseQuery.body.aiComment, null);
  } finally {
    restoreEnv();
  }
});

test('m5: openai provider failure degrades to aiComment null without HTTP 500', async () => {
  const restoreEnv = withEnv({
    LLM_PROVIDER: 'openai',
    OPENAI_API_KEY: 'test-key',
    OPENAI_BASE_URL: 'https://llm.example/v1',
  });
  globalThis.fetch = async () => {
    throw new Error('network down');
  };

  try {
    const response = await requestAppJson('/api/analyze?aiComment=true', {
      phone: '0936102682',
      groups: [3, 3, 4],
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.aiComment, null);
  } finally {
    restoreEnv();
  }
});

test('m5: prompt template exists and includes all required placeholders', async () => {
  const promptPath = new URL('../prompts/phone-comment.txt', import.meta.url);
  await access(promptPath);
  const prompt = await readFile(promptPath, 'utf8');

  for (const placeholder of ['{{phone}}', '{{fiveGrid}}', '{{score}}', '{{extended}}']) {
    assert.ok(prompt.includes(placeholder), `${placeholder} missing from prompt`);
  }
});

test('m5: .env.example documents all LLM environment variables', async () => {
  const envExample = await readFile(new URL('../.env.example', import.meta.url), 'utf8');

  for (const key of ['LLM_PROVIDER', 'OPENAI_API_KEY', 'OPENAI_BASE_URL', 'OPENAI_MODEL']) {
    assert.match(envExample, new RegExp(`^${key}=`, 'm'));
  }
});
