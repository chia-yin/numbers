import { readFile } from 'node:fs/promises';
import http from 'node:http';
import { Duplex } from 'node:stream';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from 'node-html-parser';

import { app } from '../src/server.js';

const rankHtml = await readFile(new URL('../public/rank.html', import.meta.url), 'utf8');
const indexHtml = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');

class CaptureSocket extends Duplex {
  chunks = [];

  _read() {}

  _write(chunk, encoding, callback) {
    this.chunks.push(Buffer.from(chunk));
    callback();
  }
}

async function requestAppJson(method, path, payload) {
  const body = payload === undefined ? '' : JSON.stringify(payload);
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
  };

  if (payload !== undefined) {
    req.headers['content-type'] = 'application/json';
    req.headers['content-length'] = Buffer.byteLength(body);
  }

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

  if (payload !== undefined) {
    req.push(body);
  }
  req.push(null);

  await finished;
  const raw = Buffer.concat(resSocket.chunks).toString('utf8');
  const [, responseBody = ''] = raw.split('\r\n\r\n');

  return {
    status: res.statusCode,
    body: JSON.parse(responseBody),
  };
}

test('m7 acceptance: POST /api/rank rejects more than 200 candidates with HTTP 400', async () => {
  const candidates = Array.from({ length: 201 }, (_, index) => `09${String(index).padStart(8, '0')}`);
  const response = await requestAppJson('POST', '/api/rank', { candidates });

  assert.equal(response.status, 400);
  assert.deepEqual(response.body, { error: 'candidates limit is 200' });
});

test('m7 acceptance: POST /api/rank sorts weighted scores and adds rank fields', async () => {
  const response = await requestAppJson('POST', '/api/rank', {
    candidates: ['0936102682', '0912345678'],
    minScore: 0,
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.ranked.length, 2);
  assert.equal(response.body.total, 2);
  assert.equal(response.body.filtered, 0);

  for (let index = 0; index < response.body.ranked.length; index++) {
    assert.equal(response.body.ranked[index].rank, index + 1);
    assert.equal(Object.hasOwn(response.body.ranked[index], 'aiComment'), false);
  }

  assert.ok(response.body.ranked[0].score.weighted >= response.body.ranked[1].score.weighted);
});

test('m7 acceptance: POST /api/rank minScore 99 filters a lower scoring candidate', async () => {
  const response = await requestAppJson('POST', '/api/rank', {
    candidates: ['0936102682'],
    minScore: 99,
  });

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.ranked, []);
  assert.equal(response.body.total, 0);
  assert.equal(response.body.filtered, 1);
});

test('m7 acceptance: POST /api/rank silently skips invalid candidates and analyzes valid ones', async () => {
  const response = await requestAppJson('POST', '/api/rank', {
    candidates: ['abc', '0936102682', '0912345678'],
    minScore: 0,
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.ranked.length, 2);
  assert.equal(response.body.total, 2);
  assert.equal(response.body.filtered, 0);
  assert.deepEqual(
    response.body.ranked.map((item) => item.phone ?? item.input).sort(),
    ['0912345678', '0936102682'],
  );
});

test('m7 acceptance: GET /api/sources returns public source records with manual included', async () => {
  const response = await requestAppJson('GET', '/api/sources');

  assert.equal(response.status, 200);
  assert.ok(Array.isArray(response.body.sources));

  const manual = response.body.sources.find((source) => source.id === 'manual');
  assert.deepEqual(manual, {
    id: 'manual',
    name: '手動貼入號碼清單',
    type: 'text',
  });

  for (const source of response.body.sources) {
    assert.equal(Object.hasOwn(source, 'note'), false);
    assert.equal(Object.hasOwn(source, 'enabled'), false);
    assert.equal(Object.hasOwn(source, 'description'), false);
  }
});

test('m7 ui: rank.html exposes required controls, result table, and API wiring', () => {
  const root = parse(rankHtml);

  for (const selector of [
    'section#sourceSection',
    'select#sourceSelect',
    'textarea#manualInput',
    'button#crawlBtn',
    'div#crawlPreview',
    'section#filterSection',
    'input#minScore',
    'input#groups',
    'button#rankBtn',
    'div#progress',
    'div#stats',
    'table#rankTable',
    'div#error',
  ]) {
    assert.ok(root.querySelector(selector), `missing ${selector}`);
  }

  assert.equal(root.querySelector('input#minScore').getAttribute('type'), 'number');
  assert.equal(root.querySelector('input#minScore').getAttribute('min'), '0');
  assert.equal(root.querySelector('input#minScore').getAttribute('max'), '100');
  assert.equal(root.querySelector('input#minScore').getAttribute('value'), '70');
  assert.equal(root.querySelector('input#groups').getAttribute('value'), '3-3-4');

  for (const heading of ['排名', '電話號碼', '加權分', '評語', '雙吉格', '總格', '外格', '人格', '地格', '天格']) {
    assert.ok(root.querySelectorAll('th').some((node) => node.text.trim() === heading), `missing ${heading}`);
  }

  assert.match(rankHtml, /fetch\('\/api\/sources'\)/);
  assert.match(rankHtml, /fetch\('\/api\/crawl'/);
  assert.match(rankHtml, /fetch\('\/api\/rank'/);
  assert.match(rankHtml, /split\('\\n'\)/);
  assert.match(rankHtml, /split\('-'\)/);
  assert.match(rankHtml, /index\.html\?phone=\$\{encodeURIComponent\(phone\)\}/);
  assert.match(rankHtml, /item\.score\.weighted\.toFixed\(1\)/);
  assert.match(rankHtml, /symbolClass\(item\.fiveGrid\.總格\.symbol\)/);
});

test('m7 ui: index.html reads ?phone query parameter and submits analysis automatically', () => {
  assert.match(indexHtml, /new URLSearchParams\(window\.location\.search\)/);
  assert.match(indexHtml, /\.get\('phone'\)/);
  assert.match(indexHtml, /phoneInput\.value = _prePhone/);
  assert.match(indexHtml, /form\.requestSubmit\(\)/);

  const submitHandlerIndex = indexHtml.indexOf("form.addEventListener('submit'");
  const queryHandlerIndex = indexHtml.indexOf("new URLSearchParams(window.location.search)");
  assert.ok(submitHandlerIndex >= 0);
  assert.ok(queryHandlerIndex > submitHandlerIndex);
});
