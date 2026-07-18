import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  getImageGenerationTimeoutMs,
  getRemainingGenerationTimeoutMs,
} from '../src/services/jimeng/index'

test('image generation timeout grows with the requested image count', () => {
  assert.equal(getImageGenerationTimeoutMs(1), 10 * 60_000)
  assert.equal(getImageGenerationTimeoutMs(4), 19 * 60_000)
  assert.equal(getImageGenerationTimeoutMs(10), 30 * 60_000)
})

test('image generation timeout normalizes invalid counts and caps large counts', () => {
  assert.equal(getImageGenerationTimeoutMs(0), 10 * 60_000)
  assert.equal(getImageGenerationTimeoutMs(Number.NaN), 10 * 60_000)
  assert.equal(getImageGenerationTimeoutMs(100), 30 * 60_000)
})

test('result polling subtracts actual submit time instead of a fixed minute', () => {
  assert.equal(
    getRemainingGenerationTimeoutMs(19 * 60_000, 12_500),
    19 * 60_000 - 12_500,
  )
  assert.equal(
    getRemainingGenerationTimeoutMs(10_000, 20_000),
    30_000,
  )
})
