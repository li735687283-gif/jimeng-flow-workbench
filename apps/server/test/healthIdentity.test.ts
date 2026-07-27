import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { FastifyInstance } from 'fastify'
import { createApp } from '../src/app'
import { isProcessAlive } from '../src/parentWatchdog'

async function withApp(
  options: { webRoot?: string },
  run: (app: FastifyInstance) => Promise<void>,
): Promise<void> {
  const app = createApp({ logger: false, ...options })

  try {
    await run(app)
  } finally {
    await app.close()
  }
}

test('health response carries the server process identity', async () => {
  await withApp({}, async (app) => {
    const response = await app.inject({ method: 'GET', url: '/api/health' })
    const body = response.json()

    assert.equal(response.statusCode, 200)
    assert.equal(body.status, 'ok')
    assert.equal(body.service, 'jimeng-flow-server')
    assert.equal(body.pid, process.pid)
    assert.equal(body.servesApp, false)
  })
})

test('health response marks servers that serve the app shell', async () => {
  await withApp({ webRoot: process.cwd() }, async (app) => {
    const response = await app.inject({ method: 'GET', url: '/api/health' })

    assert.equal(response.json().servesApp, true)
  })
})

test('isProcessAlive reports the current process and rejects missing ones', () => {
  assert.equal(isProcessAlive(process.pid), true)
  // 找一个必定不存在的 PID：从当前 PID 往上探，跳过所有存活进程。
  let missingPid = process.pid + 1000
  while (isProcessAlive(missingPid)) {
    missingPid += 1000
  }
  assert.equal(isProcessAlive(missingPid), false)
})
