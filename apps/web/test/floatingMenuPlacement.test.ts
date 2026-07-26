import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  chooseFloatingMenuDirection,
  getFloatingMenuPlacement,
} from '../src/utils/floatingMenuPlacement'

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

test('floating menu placement flips above a trigger near the viewport bottom', () => {
  const placement = getFloatingMenuPlacement({
    triggerLeft: 320,
    triggerRight: 420,
    triggerTop: 650,
    triggerBottom: 686,
    viewportWidth: 900,
    viewportHeight: 720,
    menuWidth: 180,
    menuHeight: 240,
    margin: 8,
    gap: 6,
  })

  assert.equal(placement.direction, 'up')
  assert.equal(placement.top, 404)
  assert.equal(placement.left, 320)
  assert.equal(placement.maxHeight, 636)
})

test('floating menu placement stays inside the viewport and scrolls on the larger side', () => {
  const placement = getFloatingMenuPlacement({
    triggerLeft: 760,
    triggerRight: 850,
    triggerTop: 210,
    triggerBottom: 246,
    viewportWidth: 860,
    viewportHeight: 420,
    menuWidth: 260,
    menuHeight: 520,
    align: 'end',
    margin: 8,
    gap: 6,
  })

  assert.equal(placement.direction, 'up')
  assert.equal(placement.top, 8)
  assert.equal(placement.left, 590)
  assert.equal(placement.maxHeight, 196)
  assert.ok(placement.top + placement.maxHeight <= 210 - 6)
})
