import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { join, resolve } from 'node:path'
import test from 'node:test'
import type { ChildProcess } from 'node:child_process'
import {
  createServerEnvironment,
  LOCAL_CANVAS_URL,
  probeCanvasPage,
  probeLocalServer,
  startOrReuseLocalServer,
  stopOwnedLocalServer,
} from '../src/localServer'

function healthResponse(service = 'jimeng-flow-server'): Response {
  return new Response(JSON.stringify({ service, status: 'ok' }), {
    headers: { 'content-type': 'application/json' },
    status: 200,
  })
}

function createFakeChild(): ChildProcess & { killCalls: number } {
  const child = new EventEmitter() as ChildProcess & { killCalls: number }
  Object.defineProperty(child, 'exitCode', { configurable: true, value: null })
  child.stderr = new PassThrough()
  child.stdout = new PassThrough()
  child.killCalls = 0
  child.kill = () => {
    child.killCalls += 1
    return true
  }
  return child
}

test('local server probe distinguishes MO.K from another service on port 8787', async () => {
  assert.equal(await probeLocalServer(async () => healthResponse()), 'ready')
  assert.equal(
    await probeLocalServer(async () => healthResponse('another-service')),
    'occupied',
  )
  assert.equal(
    await probeLocalServer(async () => {
      throw new Error('connection refused')
    }),
    'unavailable',
  )
})

test('server environment keeps the backend on the fixed loopback port and stable paths', () => {
  const environment = createServerEnvironment({
    baseEnv: { PATH: 'test-path' },
    projectRoot: join('C:', 'MO.K', 'project'),
    webRoot: join('C:', 'MO.K', 'web'),
    workspaceDir: join('C:', 'Users', 'test', 'MO.K', 'workspace'),
  })

  assert.equal(environment.PORT, '8787')
  assert.equal(environment.ELECTRON_RUN_AS_NODE, '1')
  assert.equal(environment.MOK_PROJECT_ROOT, resolve('C:', 'MO.K', 'project'))
  assert.equal(
    environment.MOK_WORKSPACE_DIR,
    resolve('C:', 'Users', 'test', 'MO.K', 'workspace'),
  )
  assert.equal(environment.MOK_WEB_ROOT, resolve('C:', 'MO.K', 'web'))
})

test('desktop reuses an existing MO.K server without spawning or owning it', async () => {
  let spawnCalls = 0
  const handle = await startOrReuseLocalServer({
    entryPath: 'server.cjs',
    execPath: 'electron.exe',
    fetchImpl: async () => healthResponse(),
    projectRoot: 'project',
    spawnImpl: () => {
      spawnCalls += 1
      return createFakeChild()
    },
    workspaceDir: 'workspace',
  })

  assert.equal(spawnCalls, 0)
  assert.equal(handle.owned, false)
  assert.equal(handle.process, null)
})

test('packaged desktop refuses to reuse a server that cannot serve the app', async () => {
  let spawnCalls = 0
  await assert.rejects(
    startOrReuseLocalServer({
      entryPath: 'server.cjs',
      execPath: 'electron.exe',
      fetchImpl: async (url) => {
        if (String(url) === LOCAL_CANVAS_URL) {
          return new Response('Not Found', { status: 404 })
        }
        return healthResponse()
      },
      projectRoot: 'project',
      spawnImpl: () => {
        spawnCalls += 1
        return createFakeChild()
      },
      webRoot: 'web',
      workspaceDir: 'workspace',
    }),
    /does not serve the app/,
  )
  assert.equal(spawnCalls, 0)
})

test('packaged desktop reuses a healthy server that serves the app', async () => {
  let spawnCalls = 0
  const handle = await startOrReuseLocalServer({
    entryPath: 'server.cjs',
    execPath: 'electron.exe',
    fetchImpl: async (url) => {
      if (String(url) === LOCAL_CANVAS_URL) {
        return new Response('<!doctype html>', { status: 200 })
      }
      return healthResponse()
    },
    projectRoot: 'project',
    spawnImpl: () => {
      spawnCalls += 1
      return createFakeChild()
    },
    webRoot: 'web',
    workspaceDir: 'workspace',
  })

  assert.equal(spawnCalls, 0)
  assert.equal(handle.owned, false)
  assert.equal(handle.process, null)
})

test('canvas page probe reports whether the server serves the app shell', async () => {
  assert.equal(
    await probeCanvasPage(async () => new Response('<!doctype html>', { status: 200 })),
    true,
  )
  assert.equal(
    await probeCanvasPage(async () => new Response('Not Found', { status: 404 })),
    false,
  )
  assert.equal(
    await probeCanvasPage(async () => {
      throw new Error('connection refused')
    }),
    false,
  )
})

test('desktop owns a server it starts and closes only that process', async () => {
  let probes = 0
  const child = createFakeChild()
  const handle = await startOrReuseLocalServer({
    entryPath: 'server.cjs',
    execPath: 'electron.exe',
    fetchImpl: async () => {
      probes += 1
      if (probes === 1) throw new Error('connection refused')
      return healthResponse()
    },
    projectRoot: 'project',
    spawnImpl: () => child,
    startupTimeoutMs: 1_000,
    workspaceDir: 'workspace',
  })

  assert.equal(handle.owned, true)
  stopOwnedLocalServer(handle)
  assert.equal(child.killCalls, 1)
  stopOwnedLocalServer({ owned: false, process: child })
  assert.equal(child.killCalls, 1)
})
