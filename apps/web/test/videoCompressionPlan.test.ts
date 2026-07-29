import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  formatVideoCompressionPixels,
  getVideoCompressionOptions,
  getVideoCompressionPlan,
} from '../src/utils/videoCompressionPlan'

test('video compression plan preserves aspect ratio and keeps an even width', () => {
  assert.deepEqual(getVideoCompressionPlan(1280, 720, 480), {
    width: 854,
    height: 480,
    scale: 2 / 3,
  })
  assert.deepEqual(getVideoCompressionPlan(2206, 946, 360), {
    width: 840,
    height: 360,
    scale: 360 / 946,
  })
})

test('video compression exposes only lower 480P and 360P targets', () => {
  assert.deepEqual(getVideoCompressionOptions(1280, 720).map((item) => item.height), [480, 360])
  assert.deepEqual(getVideoCompressionOptions(854, 480).map((item) => item.height), [360])
  assert.deepEqual(getVideoCompressionOptions(640, 360), [])
})

test('video compression pixel count is localized for the panel', () => {
  assert.equal(formatVideoCompressionPixels(1280, 720), '92 万像素')
  assert.equal(formatVideoCompressionPixels(0, 720), '未知')
})
