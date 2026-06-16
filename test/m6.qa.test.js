import http from 'node:http';
import { Duplex } from 'node:stream';
import { afterEach, describe, mock, test } from 'node:test';
import assert from 'node:assert/strict';

afterEach(() => {
  mock.restoreAll();
});

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
    raw,
    status: res.statusCode,
  };
}

describe('M6 QA parser edge cases', () => {
  test('extractFromText does not truncate longer digit runs into 10-digit candidates', async () => {
    const { extractFromText } = await import('../src/crawler/parser.js');

    assert.deepEqual(extractFromText('帳號 12345678901\n序號 009123456789'), []);
  });

  test('extractFromHtml deduplicates repeated numbers from selected elements', async () => {
    const { extractFromHtml } = await import('../src/crawler/parser.js');

    const html = `
      <ul>
        <li class="n">0912345678</li>
        <li class="n">電話 0912-345-678</li>
        <li class="n">0987654321</li>
      </ul>
    `;

    assert.deepEqual(extractFromHtml(html, '.n'), ['0912345678', '0987654321']);
  });
});

describe('M6 QA API error paths', () => {
  test('POST /api/crawl returns 403 when robots.txt disallows crawling', async () => {
    const { app } = await import('../src/server.js');

    mock.method(globalThis, 'fetch', async (url) => {
      assert.equal(String(url), 'https://example.test/robots.txt');
      return new Response('User-agent: *\nDisallow: /\n', { status: 200 });
    });

    const response = await request(app, 'POST', '/api/crawl', {
      source: {
        type: 'url',
        url: 'https://example.test/private/list',
        selector: '.n',
        delayMs: 0,
      },
    });

    assert.equal(response.status, 403);
    assert.deepEqual(response.body, { error: 'robots.txt disallows crawling this URL' });
  });

  test('POST /api/crawl returns 500 when target page fetch is not 2xx', async () => {
    const { app } = await import('../src/server.js');
    const calls = [];

    mock.method(globalThis, 'fetch', async (url) => {
      calls.push(String(url));
      if (String(url).endsWith('/robots.txt')) {
        return new Response('not found', { status: 404 });
      }
      return new Response('unavailable', { status: 503 });
    });

    const response = await request(app, 'POST', '/api/crawl', {
      source: {
        type: 'url',
        url: 'https://example.test/list',
        selector: '.n',
        delayMs: 0,
      },
    });

    assert.deepEqual(calls, ['https://example.test/robots.txt', 'https://example.test/list']);
    assert.equal(response.status, 500);
    assert.deepEqual(response.body, { error: 'fetch failed: fetch failed: HTTP 503' });
  });
});
