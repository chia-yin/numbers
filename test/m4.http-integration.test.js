import http from 'node:http';
import { Duplex } from 'node:stream';
import { test } from 'node:test';
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

test('m4 http integration: mounted JSON route returns transformed analysis', async () => {
  const response = await requestAppJson('/api/analyze', {
    phone: '0936102682',
    groups: [3, 3, 4],
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.input, '0936102682');
  assert.equal(response.body.fiveGrid.總格.wuxing, '金');
  assert.equal(response.body.fiveGrid.總格.symbol, '○');
  assert.equal(response.body.fiveGrid.總格.weight, 0.5);
  assert.equal(response.body.aiComment, null);
  assert.equal(Object.hasOwn(response.body, 'numerology'), false);
  assert.equal(Object.hasOwn(response.body, 'wuxingRelations'), false);
});

test('m4 http integration: mounted JSON route returns API validation errors', async () => {
  const response = await requestAppJson('/api/analyze', {
    phone: '0936102682',
    groups: [3, 3, 5],
  });

  assert.equal(response.status, 400);
  assert.deepEqual(response.body, {
    error: 'groups sum (11) must equal phone length (10)',
  });
});
