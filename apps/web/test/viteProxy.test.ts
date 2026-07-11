import { test } from 'node:test'
import assert from 'node:assert/strict'
import config from '../vite.config'

test('Vite API proxy targets the IPv4 loopback server', () => {
  const apiProxy = config.server?.proxy?.['/api']

  assert.deepEqual(
    {
      host: config.server?.host,
      port: config.server?.port,
      strictPort: config.server?.strictPort,
      target:
        typeof apiProxy === 'object' && apiProxy !== null
          ? apiProxy.target
          : apiProxy,
    },
    {
      host: '127.0.0.1',
      port: 5174,
      strictPort: true,
      target: 'http://127.0.0.1:8787',
    },
  )
})
