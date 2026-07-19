import assert from 'node:assert/strict'
import { join } from 'node:path'
import test from 'node:test'
import { LOCAL_CANVAS_URL } from '../src/localServer'
import {
  createBrowserWindowOptions,
  DEVELOPMENT_CANVAS_URL,
  isSafeExternalUrl,
} from '../src/windowConfig'

test('desktop canvas URLs use only the configured IPv4 loopback services', () => {
  assert.equal(DEVELOPMENT_CANVAS_URL, 'http://127.0.0.1:5174/canvas')
  assert.equal(LOCAL_CANVAS_URL, 'http://127.0.0.1:8787/canvas')
})

test('desktop renderer has no Node.js access and uses an isolated sandbox', () => {
  const preloadPath = join('desktop', 'preload.cjs')
  const options = createBrowserWindowOptions(preloadPath)

  assert.equal(options.webPreferences?.preload, preloadPath)
  assert.equal(options.webPreferences?.contextIsolation, true)
  assert.equal(options.webPreferences?.nodeIntegration, false)
  assert.equal(options.webPreferences?.sandbox, true)
})

test('only HTTPS links may leave the desktop window', () => {
  assert.equal(isSafeExternalUrl('https://example.com/docs'), true)
  assert.equal(isSafeExternalUrl('http://example.com'), false)
  assert.equal(isSafeExternalUrl('file:///C:/secret.txt'), false)
  assert.equal(isSafeExternalUrl('javascript:alert(1)'), false)
  assert.equal(isSafeExternalUrl('not a URL'), false)
})
