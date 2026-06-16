import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const readText = (path) => readFile(path, 'utf8')

test('M1 skeleton files exist', () => {
  for (const path of [
    'package.json',
    'src/server.js',
    'public/index.html',
    'test/smoke.test.js',
    'Dockerfile',
    'docker-compose.yml',
    '.env.example',
  ]) {
    assert.ok(existsSync(path), `${path} should exist`)
  }
})

test('package.json declares expected ESM scripts and Express 5 dependency', async () => {
  const packageJson = JSON.parse(await readText('package.json'))

  assert.equal(packageJson.type, 'module')
  assert.equal(packageJson.main, 'src/server.js')
  assert.equal(packageJson.scripts?.start, 'node src/server.js')
  assert.equal(packageJson.scripts?.dev, 'node --watch src/server.js')
  assert.match(packageJson.scripts?.test ?? '', /^node --test\b/)
  assert.equal(packageJson.dependencies?.express, '^5.0.0')
})

test('server module uses Express static public directory and exports app', async () => {
  const serverJs = await readText('src/server.js')

  assert.match(serverJs, /import\s+express\s+from\s+['"]express['"]/)
  assert.match(serverJs, /process\.env\.PORT\s*\?\?\s*3000/)
  assert.match(serverJs, /express\.static\(\s*['"]public['"]\s*\)/)
  assert.match(serverJs, /app\.listen\(/)
  assert.match(serverJs, /export\s*\{\s*app\s*\}/)
})

test('index page contains required metadata and M4 SPA content', async () => {
  const indexHtml = await readText('public/index.html')

  assert.match(indexHtml, /<html\s+lang=["']zh-TW["']/)
  assert.match(indexHtml, /<meta\s+charset=["']UTF-8["']\s*\/?>/)
  assert.match(indexHtml, /<meta\s+name=["']viewport["'][^>]*>/)
  assert.match(indexHtml, /<title>\s*公號數字學 — 手機號碼五格分析\s*<\/title>/)
  assert.match(indexHtml, /id=["']analyzeForm["']/)
  assert.match(indexHtml, /id=["']phone["']/)
  assert.match(indexHtml, /id=["']groups["']/)
  assert.match(indexHtml, /fetch\(['"]\/api\/analyze['"]/)
  assert.match(indexHtml, /id=["']fiveGridTable["']/)
  assert.match(indexHtml, /style\.css/)
})

test('container and environment files match M1 expectations', async () => {
  const [dockerfile, compose, envExample, gitignore] = await Promise.all([
    readText('Dockerfile'),
    readText('docker-compose.yml'),
    readText('.env.example'),
    readText('.gitignore'),
  ])

  assert.match(dockerfile, /FROM\s+node:20-alpine\b/)
  assert.match(dockerfile, /WORKDIR\s+\/app/)
  assert.match(dockerfile, /RUN\s+npm\s+ci\s+--omit=dev/)
  assert.match(dockerfile, /EXPOSE\s+3000/)
  assert.match(dockerfile, /CMD\s+\["node",\s*"src\/server\.js"\]/)

  assert.match(compose, /gonghao-numbers:/)
  assert.match(compose, /build:\s*\./)
  assert.match(compose, /"3000:3000"/)
  assert.match(compose, /env_file:/)

  assert.match(envExample, /PORT=3000/)
  assert.match(gitignore, /(^|\n)node_modules\/(\n|$)/)
  assert.match(gitignore, /(^|\n)\.env(\n|$)/)
})
