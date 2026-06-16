import http from 'node:http';
import { Duplex } from 'node:stream';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

class CaptureSocket extends Duplex {
  chunks = [];

  _read() {}

  _write(chunk, encoding, callback) {
    this.chunks.push(Buffer.from(chunk));
    callback();
  }
}

async function request(app, method, path, body) {
  const payload = body === undefined ? '' : JSON.stringify(body);
  const reqSocket = new Duplex({
    read() {},
    write(chunk, encoding, callback) {
      callback();
    },
  });
  const req = new http.IncomingMessage(reqSocket);
  req.method = method;
  req.url = path;
  req.headers = {
    host: 'localhost',
    ...(body === undefined
      ? {}
      : {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(payload),
        }),
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
        return;
      }
      resolve();
    });
  });

  req.push(payload);
  req.push(null);

  await finished;

  const raw = Buffer.concat(resSocket.chunks).toString('utf8');
  const [, responseBody = ''] = raw.split('\r\n\r\n');
  return {
    body: responseBody.length === 0 ? null : JSON.parse(responseBody),
    status: res.statusCode,
  };
}

describe('M6 QA request validation', () => {
  test('POST /api/crawl rejects text sources missing content as a bad request', async () => {
    const { app } = await import('../src/server.js');

    const response = await request(app, 'POST', '/api/crawl', {
      source: { type: 'text' },
    });

    assert.equal(response.status, 400);
    assert.match(response.body.error, /content/i);
  });

  test('POST /api/crawl rejects URL sources missing url as a bad request', async () => {
    const { app } = await import('../src/server.js');

    const response = await request(app, 'POST', '/api/crawl', {
      source: { type: 'url', selector: '.n', delayMs: 0 },
    });

    assert.equal(response.status, 400);
    assert.match(response.body.error, /url/i);
  });

  test('POST /api/crawl rejects invalid URL source strings as a bad request', async () => {
    const { app } = await import('../src/server.js');

    const response = await request(app, 'POST', '/api/crawl', {
      source: { type: 'url', url: 'not a url', selector: '.n', delayMs: 0 },
    });

    assert.equal(response.status, 400);
    assert.match(response.body.error, /url/i);
  });
});
