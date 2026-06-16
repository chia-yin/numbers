import http from 'node:http';
import { Duplex } from 'node:stream';
import { afterEach, describe, test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function loadParser() {
  return import('../src/crawler/parser.js');
}

async function loadCrawler() {
  return import('../src/crawler/index.js');
}

async function loadPoliteness() {
  return import('../src/crawler/politeness.js');
}

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

  let fellThrough = false;
  const finished = new Promise((resolve, reject) => {
    res.on('finish', resolve);
    res.on('error', reject);
    app.handle(req, res, (error) => {
      if (error) {
        reject(error);
        return;
      }
      fellThrough = true;
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
    fellThrough,
    raw,
    status: res.statusCode,
  };
}

describe('crawler dependencies and config', () => {
  test('package.json declares node-html-parser dependency', async () => {
    const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

    assert.match(pkg.dependencies?.['node-html-parser'] ?? '', /^\^?6\./);
  });

  test('config/sources.json contains default manual and example URL sources', async () => {
    const sources = JSON.parse(await readFile(new URL('../config/sources.json', import.meta.url), 'utf8'));

    assert.equal(Array.isArray(sources), true);
    assert.equal(sources.length, 2);
    assert.equal(sources[0].id, 'manual');
    assert.equal(sources[0].type, 'text');
    assert.equal(sources[1].id, 'example-url');
    assert.equal(sources[1].type, 'url');
    assert.equal(sources[1].enabled, false);
  });
});

describe('crawler parser', () => {
  test('extractFromText returns multiple 10-digit candidates from pasted lines', async () => {
    const { extractFromText } = await loadParser();

    assert.deepEqual(extractFromText('0912345678\n0987654321'), ['0912345678', '0987654321']);
  });

  test('extractFromText normalizes hyphenated phone text before matching', async () => {
    const { extractFromText } = await loadParser();

    assert.deepEqual(extractFromText('電話: 0936-102-682 請來電'), ['0936102682']);
  });

  test('extractFromText returns an empty array when no candidate exists', async () => {
    const { extractFromText } = await loadParser();

    assert.deepEqual(extractFromText('no numbers here'), []);
  });

  test('extractFromText takes only the first candidate from each line', async () => {
    const { extractFromText } = await loadParser();

    assert.deepEqual(extractFromText('0912345678 0987654321\n0936102682'), [
      '0912345678',
      '0936102682',
    ]);
  });

  test('extractFromHtml extracts candidates from matching selector text', async () => {
    const { extractFromHtml } = await loadParser();

    assert.deepEqual(extractFromHtml('<ul><li class="n">0912345678</li></ul>', '.n'), [
      '0912345678',
    ]);
  });

  test('extractFromHtml falls back to full text when selector is empty', async () => {
    const { extractFromHtml } = await loadParser();

    assert.deepEqual(extractFromHtml('<main>雜訊 0936-102-682</main>', ''), ['0936102682']);
  });
});

describe('crawler orchestration', () => {
  test('fetchCandidates supports text sources', async () => {
    const { fetchCandidates } = await loadCrawler();

    const candidates = await fetchCandidates({
      type: 'text',
      content: '0912345678\n0987654321\n0936102682',
    });

    assert.deepEqual(candidates, ['0912345678', '0987654321', '0936102682']);
  });

  test('fetchCandidates enforces robots check, delay, user agent, and HTML parsing for URL sources', async () => {
    const { fetchCandidates } = await loadCrawler();
    const calls = [];

    mock.method(globalThis, 'fetch', async (url, options = {}) => {
      calls.push({ url: String(url), options });
      if (String(url).endsWith('/robots.txt')) {
        return new Response('User-agent: *\nAllow: /\n', { status: 200 });
      }
      return new Response('<section><p class="n">0912345678</p></section>', { status: 200 });
    });

    const started = Date.now();
    const candidates = await fetchCandidates({
      type: 'url',
      url: 'https://example.test/list',
      selector: '.n',
      delayMs: 25,
    });

    assert.deepEqual(candidates, ['0912345678']);
    assert.equal(calls[0].url, 'https://example.test/robots.txt');
    assert.equal(calls[1].url, 'https://example.test/list');
    assert.equal(
      calls[1].options.headers?.['User-Agent'],
      'gonghao-numbers-crawler/1.0 (educational; contact: see package.json)',
    );
    assert.equal(Date.now() - started >= 20, true);
  });
});

describe('crawler politeness', () => {
  test('checkRobots throws when User-agent star disallows the requested path', async () => {
    const { checkRobots } = await loadPoliteness();

    mock.method(globalThis, 'fetch', async () => {
      return new Response('User-agent: *\nDisallow: /\n', { status: 200 });
    });

    await assert.rejects(
      () => checkRobots('https://example.test/private/list'),
      /robots\.txt disallows crawling this URL/,
    );
  });

  test('checkRobots passes when robots.txt returns 404', async () => {
    const { checkRobots } = await loadPoliteness();

    mock.method(globalThis, 'fetch', async () => {
      return new Response('not found', { status: 404 });
    });

    await assert.doesNotReject(() => checkRobots('https://example.test/list'));
  });
});

describe('crawler API', () => {
  test('POST /api/crawl with text source returns candidates, sourceType, and count', async () => {
    const { app } = await import('../src/server.js');

    const response = await request(app, 'POST', '/api/crawl', {
      source: {
        type: 'text',
        content: '0912345678\n0987654321\n0936102682',
      },
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      candidates: ['0912345678', '0987654321', '0936102682'],
      sourceType: 'text',
      count: 3,
    });
  });

  test('POST /api/crawl without source returns 400', async () => {
    const { app } = await import('../src/server.js');

    const response = await request(app, 'POST', '/api/crawl', {});

    assert.equal(response.status, 400);
    assert.deepEqual(response.body, { error: 'source is required' });
  });

  test('POST /api/crawl with invalid source.type returns 400', async () => {
    const { app } = await import('../src/server.js');

    const response = await request(app, 'POST', '/api/crawl', {
      source: { type: 'ftp', url: 'ftp://example.test/numbers' },
    });

    assert.equal(response.status, 400);
    assert.deepEqual(response.body, { error: "source.type must be 'text' or 'url'" });
  });

  test('GET /api/crawl/sources returns configured source array', async () => {
    const { app } = await import('../src/server.js');

    const response = await request(app, 'GET', '/api/crawl/sources');

    assert.equal(response.status, 200);
    assert.equal(Array.isArray(response.body), true);
    assert.equal(response.body.length >= 1, true);
  });
});
