import assert from 'node:assert/strict'
import { join } from 'node:path'
import test from 'node:test'
import {
  createBrowserWindowOptions,
  DEVELOPMENT_CANVAS_URL,
  isSafeExternalUrl,
  resolveProductionRenderer,
} from '../src/windowConfig'

test('desktop development opens the MO.K canvas on the loopback Vite server', () => {
  assert.equal(DEVELOPMENT_CANVAS_URL, 'http://127.0.0.1:5174/canvas')
})

test('desktop renderer has no Node.js access and uses an isolated sandbox', () => {
  const preloadPath = join('desktop', 'preload.cjs')
  const options = createBrowserWindowOptions(preloadPath)

  assert.equal(options.webPreferences?.preload, preloadPath)
  assert.equal(options.webPreferences?.contextIsolation, true)
  assert.equal(options.webPreferences?.nodeIntegration, false)
  assert.equal(options.webPreferences?.sandbox, true)
})

test('production renderer resolves only packaged web resources', () => {
  const renderer = resolveProductionRenderer(join('C:', 'MO.K', 'resources'))

  assert.equal(
    renderer.filePath,
    join('C:', 'MO.K', 'resources', 'web', 'index.html'),
  )
  assert.deepEqual(renderer.query, { view: 'canvas' })
  assert.equal(renderer.filePath.includes('5174'), false)
})

test('only HTTPS links may leave the desktop window', () => {
  assert.equal(isSafeExternalUrl('https://example.com/docs'), true)
  assert.equal(isSafeExternalUrl('http://example.com'), false)
  assert.equal(isSafeExternalUrl('file:///C:/secret.txt'), false)
  assert.equal(isSafeExternalUrl('javascript:alert(1)'), false)
  assert.equal(isSafeExternalUrl('not a URL'), false)
})
