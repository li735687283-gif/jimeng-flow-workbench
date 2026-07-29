import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  createInitialVideoTrimRange,
  formatVideoTrimTime,
  getVideoTrimDuration,
  moveVideoTrimEnd,
  moveVideoTrimStart,
  moveVideoTrimWindow,
} from '../src/utils/videoTrimRange'

test('video trim starts with the longest allowed four-second selection', () => {
  assert.deepEqual(createInitialVideoTrimRange(12), {
    startSeconds: 0,
    endSeconds: 4,
  })
  assert.deepEqual(createInitialVideoTrimRange(2.6), {
    startSeconds: 0,
    endSeconds: 2.6,
  })
  assert.equal(createInitialVideoTrimRange(0.9), null)
})

test('video trim handles enforce one-to-four-second limits', () => {
  const range = { startSeconds: 2, endSeconds: 6 }
  assert.deepEqual(moveVideoTrimStart(range, 5.8), {
    startSeconds: 5,
    endSeconds: 6,
  })
  assert.deepEqual(moveVideoTrimStart(range, -4), {
    startSeconds: 2,
    endSeconds: 6,
  })
  assert.deepEqual(moveVideoTrimEnd(range, 2.1, 20), {
    startSeconds: 2,
    endSeconds: 3,
  })
  assert.deepEqual(moveVideoTrimEnd(range, 12, 20), {
    startSeconds: 2,
    endSeconds: 6,
  })
})

test('video trim window stays inside the source duration', () => {
  assert.deepEqual(
    moveVideoTrimWindow({ startSeconds: 2, endSeconds: 5 }, 9, 10),
    { startSeconds: 7, endSeconds: 10 },
  )
  assert.equal(
    getVideoTrimDuration({ startSeconds: 7, endSeconds: 10 }),
    3,
  )
  assert.equal(formatVideoTrimTime(62.34), '1:02.3')
})
