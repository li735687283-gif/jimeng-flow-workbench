import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chooseFloatingMenuDirection } from '../src/utils/floatingMenuPlacement'

test('floating menu opens downward when there is enough room below the trigger', () => {
  const direction = chooseFloatingMenuDirection({
    triggerTop: 300,
    triggerBottom: 340,
    viewportHeight: 900,
    menuHeight: 260,
  })

  assert.equal(direction, 'down')
})

test('floating menu opens upward when the viewport bottom is too close', () => {
  const direction = chooseFloatingMenuDirection({
    triggerTop: 690,
    triggerBottom: 730,
    viewportHeight: 760,
    menuHeight: 260,
  })

  assert.equal(direction, 'up')
})

test('floating menu uses the side with more available space when neither side fully fits', () => {
  const direction = chooseFloatingMenuDirection({
    triggerTop: 230,
    triggerBottom: 270,
    viewportHeight: 390,
    menuHeight: 260,
  })

  assert.equal(direction, 'up')
})
