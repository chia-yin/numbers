import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const execFileAsync = promisify(execFile)

test('M1 contract: importing server.js does not keep the process alive', async () => {
  const { stdout } = await execFileAsync(
    process.execPath,
    ['--input-type=module', '-e', "const { app } = await import('./src/server.js'); console.log(Boolean(app));"],
    {
      cwd: process.cwd(),
      timeout: 1000,
      env: {
        ...process.env,
        PORT: '0',
      },
    },
  )

  assert.equal(stdout.trim(), 'true')
})
