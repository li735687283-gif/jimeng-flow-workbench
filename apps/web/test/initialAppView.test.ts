import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveInitialAppView } from '../src/utils/initialAppView'

test('the app always starts on the home page', () => {
  assert.equal(resolveInitialAppView({ search: '' }), 'home')
})

test('an explicit canvas query still enters the canvas directly', () => {
  assert.equal(resolveInitialAppView({ search: '?view=canvas' }), 'canvas')
})

test('unrelated queries do not affect the home default', () => {
  assert.equal(resolveInitialAppView({ search: '?view=home' }), 'home')
  assert.equal(resolveInitialAppView({ search: '?foo=bar' }), 'home')
})
