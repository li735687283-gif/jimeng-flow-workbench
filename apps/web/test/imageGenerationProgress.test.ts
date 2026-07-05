import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  getImageGenerationProgressState,
  shouldShowImagePlaceholderIcon,
} from '../src/utils/imageGenerationProgress'

test('image generation progress shows while the node is queued or running', () => {
  assert.deepEqual(getImageGenerationProgressState('queued', false), {
    visible: true,
    label: '图片生成中',
    valueText: '生成中',
  })
  assert.deepEqual(getImageGenerationProgressState('running', false), {
    visible: true,
    label: '图片生成中',
    valueText: '生成中',
  })
})

test('image generation progress also shows during an in-flight local request', () => {
  assert.equal(getImageGenerationProgressState('idle', true).visible, true)
})

test('image generation progress hides after success or error', () => {
  assert.equal(getImageGenerationProgressState('success', false).visible, false)
  assert.equal(getImageGenerationProgressState('error', false).visible, false)
  assert.equal(getImageGenerationProgressState('idle', false).visible, false)
})

test('image placeholder icon hides while generation progress is visible', () => {
  assert.equal(shouldShowImagePlaceholderIcon(true, false), false)
  assert.equal(shouldShowImagePlaceholderIcon(true, true), false)
  assert.equal(shouldShowImagePlaceholderIcon(false, false), true)
  assert.equal(shouldShowImagePlaceholderIcon(false, true), true)
})
