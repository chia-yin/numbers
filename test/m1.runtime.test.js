import http from 'node:http'
import { Duplex } from 'node:stream'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { app } from '../src/server.js'

class CaptureSocket extends Duplex {
  chunks = []

  _read() {}

  _write(chunk, encoding, callback) {
    this.chunks.push(Buffer.from(chunk))
    callback()
  }
}

const requestApp = async (path) => {
  const reqSocket = new Duplex({
    read() {},
    write(chunk, encoding, callback) {
      callback()
    },
  })
  const req = new http.IncomingMessage(reqSocket)
  req.method = 'GET'
  req.url = path
  req.headers = { host: 'localhost' }

  const res = new http.ServerResponse(req)
  const resSocket = new CaptureSocket()
  res.assignSocket(resSocket)

  let fellThrough = false
  await new Promise((resolve, reject) => {
    res.on('finish', resolve)
    res.on('error', reject)
    app.handle(req, res, (error) => {
      if (error) {
        reject(error)
        return
      }

      fellThrough = true
      resolve()
    })
  })

  return {
    body: Buffer.concat(resSocket.chunks).toString('utf8'),
    fellThrough,
    status: res.statusCode,
  }
}

test('runtime: serves the public index page with required content', async () => {
  const response = await requestApp('/')

  assert.equal(response.status, 200)
  assert.equal(response.fellThrough, false)
  assert.match(response.body, /Content-Type: text\/html/)
  assert.match(response.body, /Hello gonghao-numbers/)
  assert.match(response.body, /電話號碼五格數字學工具/)
})

test('runtime: unknown static paths are not served as the index page', async () => {
  const response = await requestApp('/missing-page.html')

  assert.equal(response.fellThrough, true)
  assert.doesNotMatch(response.body, /Hello gonghao-numbers/)
})
