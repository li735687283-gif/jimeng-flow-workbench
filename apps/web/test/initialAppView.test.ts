import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveInitialAppView } from '../src/utils/initialAppView'

test('direct canvas paths take precedence over the stored home view', () => {
  assert.equal(
    resolveInitialAppView({
      pathname: '/canvas',
      search: '',
      storedView: 'home',
    }),
    'canvas',
  )
})

test('the desktop file renderer can request the canvas with a query', () => {
  assert.equal(
    resolveInitialAppView({
      pathname: '/resources/web/index.html',
      search: '?view=canvas',
      storedView: null,
    }),
    'canvas',
  )
})

test('the stored view remains the fallback for the regular web entry', () => {
  assert.equal(
    resolveInitialAppView({
      pathname: '/',
      search: '',
      storedView: 'canvas',
    }),
    'canvas',
  )
  assert.equal(
    resolveInitialAppView({
      pathname: '/',
      search: '',
      storedView: 'home',
    }),
    'home',
  )
})
