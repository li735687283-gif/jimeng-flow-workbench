import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { FastifyInstance } from 'fastify'
import { createApp } from '../src/app'

async function withApp(
  run: (app: FastifyInstance) => Promise<void>,
): Promise<void> {
  const app = createApp({ logger: false })

  try {
    await run(app)
  } finally {
    await app.close()
  }
}

test('allows an approved browser origin and emits its CORS header', async () => {
  await withApp(async (app) => {
    const origin = 'http://127.0.0.1:5174'
    const response = await app.inject({
      method: 'GET',
      url: '/api/health',
      headers: {
        origin,
        'sec-fetch-site': 'same-site',
      },
    })

    assert.equal(response.statusCode, 200)
    assert.equal(response.headers['access-control-allow-origin'], origin)
    assert.equal(response.json().status, 'ok')
  })
})

test('keeps no-origin local clients working', async () => {
  await withApp(async (app) => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/health',
    })

    assert.equal(response.statusCode, 200)
    assert.equal(response.headers['access-control-allow-origin'], undefined)
    assert.equal(response.json().status, 'ok')
  })
})

test('rejects an unknown browser origin', async () => {
  await withApp(async (app) => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/health',
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
  })
})

test('rejects cross-site metadata before routing', async () => {
  await withApp(async (app) => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/health',
      headers: {
        origin: 'http://localhost:5174',
        'sec-fetch-site': 'cross-site',
      },
    })

    assert.equal(response.statusCode, 403)
  })
})

test('rejects a cross-site preflight before CORS can answer', async () => {
  await withApp(async (app) => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/api/health',
      headers: {
        origin: 'http://localhost:5174',
        'sec-fetch-site': 'cross-site',
        'access-control-request-method': 'GET',
      },
    })

    assert.equal(response.statusCode, 403)
    assert.equal(response.headers['access-control-allow-origin'], undefined)
  })
})

test('rejects an unknown-origin preflight before CORS can answer', async () => {
  await withApp(async (app) => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/api/health',
      headers: {
        origin: 'https://evil.example',
        'access-control-request-method': 'GET',
      },
    })

    assert.equal(response.statusCode, 403)
    assert.equal(response.headers['access-control-allow-origin'], undefined)
  })
})

test('answers an approved CORS preflight request', async () => {
  await withApp(async (app) => {
    const origin = 'http://localhost:5174'
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/api/health',
      headers: {
        origin,
        'access-control-request-method': 'GET',
      },
    })

    assert.equal(response.statusCode, 204)
    assert.equal(response.headers['access-control-allow-origin'], origin)
  })
})
