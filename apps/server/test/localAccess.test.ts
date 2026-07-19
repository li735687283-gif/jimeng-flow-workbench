import { test } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import {
  LOCAL_SERVER_HOST,
  installLocalAccessGuard,
  isAllowedLocalRequest,
} from '../src/security/localAccess'

test('uses the IPv4 loopback host', () => {
  assert.equal(LOCAL_SERVER_HOST, '127.0.0.1')
})

test('allows approved local browser origins and no-origin clients', () => {
  assert.equal(
    isAllowedLocalRequest({ origin: 'http://127.0.0.1:5174' }),
    true,
  )
  assert.equal(
    isAllowedLocalRequest({ origin: 'http://localhost:5174' }),
    true,
  )
  assert.equal(isAllowedLocalRequest({}), true)
})

test('rejects an unknown origin', () => {
  assert.equal(
    isAllowedLocalRequest({ origin: 'https://evil.example' }),
    false,
  )
})

test('allows same-origin loopback requests from the packaged app', () => {
  assert.equal(
    isAllowedLocalRequest({
      host: '127.0.0.1:8787',
      origin: 'http://127.0.0.1:8787',
    }),
    true,
  )
  assert.equal(
    isAllowedLocalRequest({
      host: 'localhost:8787',
      origin: 'http://localhost:8787',
    }),
    true,
  )
})

test('rejects same-origin requests to a non-loopback host (DNS rebinding)', () => {
  assert.equal(
    isAllowedLocalRequest({
      host: 'evil.example',
      origin: 'http://evil.example',
    }),
    false,
  )
})

test('rejects loopback origins that do not match the request host', () => {
  assert.equal(
    isAllowedLocalRequest({
      host: '127.0.0.1:9999',
      origin: 'http://127.0.0.1:8787',
    }),
    false,
  )
})

test('rejects cross-site metadata even when the origin is approved', () => {
  assert.equal(
    isAllowedLocalRequest({
      origin: 'http://127.0.0.1:5174',
      secFetchSite: 'cross-site',
    }),
    false,
  )
})

test('guard rejects before the business handler executes', async () => {
  const app = Fastify()
  let handled = false

  installLocalAccessGuard(app)
  app.post('/api/test', async () => {
    handled = true
    return { ok: true }
  })

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/test',
      headers: {
        origin: 'https://evil.example',
      },
    })

    assert.equal(response.statusCode, 403)
    assert.deepEqual(response.json(), {
      statusCode: 403,
      error: 'Forbidden',
      message: '仅允许本机浏览器访问',
    })
    assert.equal(handled, false)
  } finally {
    await app.close()
  }
})
