import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const dockerfile = await readFile(new URL('../Dockerfile', import.meta.url), 'utf8');
const compose = await readFile(new URL('../docker-compose.yml', import.meta.url), 'utf8');
const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
const dockerignore = await readFile(new URL('../.dockerignore', import.meta.url), 'utf8');

test('m8 static acceptance: Dockerfile is a two-stage production image', () => {
  const fromLines = dockerfile.match(/^FROM\s+/gm) ?? [];
  assert.equal(fromLines.length, 2);
  assert.match(dockerfile, /^FROM node:20-alpine AS builder$/m);
  assert.match(dockerfile, /^FROM node:20-alpine AS runner$/m);
  assert.match(dockerfile, /RUN npm ci --omit=dev/);
  assert.match(dockerfile, /COPY prompts\/ \.\/prompts\//);
  assert.match(dockerfile, /COPY config\/ \.\/config\//);
  assert.doesNotMatch(dockerfile, /COPY reference\//);
  assert.doesNotMatch(dockerfile, /COPY test\//);
});

test('m8 static acceptance: docker-compose exposes the app with an optional env file and healthcheck', () => {
  assert.match(compose, /gonghao-numbers:/);
  assert.match(compose, /-\s+"3000:3000"/);
  assert.match(compose, /env_file:/);
  assert.match(compose, /path:\s+\.env/);
  assert.match(compose, /required:\s+false/);
  assert.match(compose, /healthcheck:/);
  assert.match(compose, /wget", "-qO-", "http:\/\/localhost:3000\/"/);
  assert.match(compose, /start_period:\s+10s/);
});

test('m8 static acceptance: README documents startup, environment, grouping, APIs, and dev commands', () => {
  for (const heading of [
    '專案簡介',
    '功能一覽',
    '本機啟動（不用 Docker）',
    'Docker 啟動',
    '分組規則說明',
    'API 端點一覽',
    '開發指令',
  ]) {
    assert.match(readme, new RegExp(`^## ${heading}$`, 'm'), `missing heading: ${heading}`);
  }

  for (const envName of ['PORT', 'LLM_PROVIDER', 'OPENAI_API_KEY', 'OPENAI_BASE_URL', 'OPENAI_MODEL']) {
    assert.match(readme, new RegExp(`\\\`${envName}\\\``), `missing environment variable: ${envName}`);
  }

  assert.match(readme, /npm install/);
  assert.match(readme, /npm start/);
  assert.match(readme, /docker compose up/);
  assert.match(readme, /PORT=8080 docker compose up/);
  assert.match(readme, /\[3, 3, 4\]/);
  assert.match(readme, /npm run dev/);
  assert.match(readme, /npm test/);

  for (const endpoint of [
    'POST /api/analyze',
    'POST /api/analyze?aiComment=true',
    'POST /api/crawl',
    'POST /api/rank',
    'GET /api/sources',
  ]) {
    assert.match(readme, new RegExp(endpoint.replace(/[/?]/g, '\\$&')), `missing endpoint: ${endpoint}`);
  }
});

test('m8 static acceptance: .dockerignore excludes local, secret, and non-production paths', () => {
  const entries = dockerignore
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const expected of ['node_modules', '.env', 'test/', 'reference/', '.workflow/', '*.md', '.git']) {
    assert.ok(entries.includes(expected), `missing .dockerignore entry: ${expected}`);
  }
});
