import http from 'node:http';
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
    status: res.statusCode,
  };
}

const originalFetch = globalThis.fetch;
const originalProvider = process.env.LLM_PROVIDER;
const originalApiKey = process.env.OPENAI_API_KEY;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalProvider === undefined) {
    delete process.env.LLM_PROVIDER;
  } else {
    process.env.LLM_PROVIDER = originalProvider;
  }
  if (originalApiKey === undefined) {
    delete process.env.OPENAI_API_KEY;
  } else {
    process.env.OPENAI_API_KEY = originalApiKey;
  }
});

test('m5: invalid analyze request with aiComment=true does not call LLM provider', async () => {
  process.env.LLM_PROVIDER = 'openai';
  process.env.OPENAI_API_KEY = 'test-key';

  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error('LLM provider must not be called for invalid analyze input');
  };

  const response = await requestAppJson('/api/analyze?aiComment=true', {
    phone: '09A6102682',
    groups: [3, 3, 4],
  });

  assert.equal(response.status, 400);
  assert.equal(response.body.error, 'phone must be a non-empty string of digits');
  assert.equal(fetchCalls, 0);
});
