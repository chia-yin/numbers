import { afterEach, describe, mock, test } from 'node:test';
import assert from 'node:assert/strict';

import { fetchCandidates } from '../src/crawler/index.js';

afterEach(() => {
  mock.restoreAll();
});

describe('M6 QA crawl delay', () => {
  test('URL sources default to at least 2000ms delay before fetching target page', async () => {
    const delays = [];
    const calls = [];

    mock.method(globalThis, 'setTimeout', (callback, delay, ...args) => {
      delays.push(delay);
      queueMicrotask(() => callback(...args));
      return { ref() {}, unref() {} };
    });

    mock.method(globalThis, 'fetch', async (url) => {
      calls.push(String(url));
      if (String(url).endsWith('/robots.txt')) {
        return new Response('User-agent: *\nAllow: /\n', { status: 200 });
      }
      return new Response('<p class="n">0912345678</p>', { status: 200 });
    });

    const promise = fetchCandidates({
      type: 'url',
      url: 'https://example.test/list',
      selector: '.n',
    });

    assert.deepEqual(await promise, ['0912345678']);
    assert.equal(delays.includes(2000), true);
    assert.deepEqual(calls, ['https://example.test/robots.txt', 'https://example.test/list']);
  });
});
