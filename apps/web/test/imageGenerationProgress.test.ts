import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  getImageGenerationProgressState,
  isInterruptedImageGeneration,
  shouldShowImagePlaceholderIcon,
} from '../src/utils/imageGenerationProgress'

test('persisted running image nodes without a generation id are interrupted', () => {
  assert.equal(isInterruptedImageGeneration('running', undefined, false), true)
  assert.equal(isInterruptedImageGeneration('queued', '   ', false), true)
  assert.equal(isInterruptedImageGeneration('running', 'gen-1', false), false)
  assert.equal(isInterruptedImageGeneration('running', undefined, true), false)
  assert.equal(isInterruptedImageGeneration('success', undefined, false), false)
})

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
  assert.equal(getImageGenerationProgressState('success', true).visible, true)
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

test('the scanning animation follows the progress overlay and stays clipped', () => {
  const styles = readFileSync('apps/web/src/App.css', 'utf8')
  const sweepRules = styles.slice(
    styles.indexOf('.image-generation-progress-overlay::after'),
    styles.indexOf('.node-wrapper.status-success'),
  )
  assert.match(sweepRules, /animation: image-card-sweep/)
  assert.match(
    styles,
    /\.image-generation-progress-overlay\s*\{[\s\S]*?overflow:\s*hidden;/,
  )
  assert.doesNotMatch(
    styles,
    /status-(?:queued|running)\s+\.(?:image-node-container|media-display-node)::after/,
  )
})
