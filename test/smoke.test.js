import { test } from 'node:test'
import assert from 'node:assert/strict'

test('smoke: server module exports app', async () => {
  const { app } = await import('../src/server.js')
  assert.ok(app, 'app should be exported from server.js')
})

test('smoke: basic assertion', () => {
  assert.ok(true)
})
