import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  resolveImageGenerationDefaults,
  resolveVideoGenerationDefaults,
} from '../src/utils/generationDefaults'

test('image generation defaults inherit the last used image model and parameters', () => {
  const defaults = resolveImageGenerationDefaults({
    nodeData: {},
    remembered: {
      model: 'banana-pro',
      quality: '高画质',
      ratio: '16:9',
      resolution: '4K',
      count: 2,
    },
    modelOptions: [
      { id: 'jimeng', label: '即梦' },
      { id: 'banana-pro', label: 'Banana Pro' },
    ],
  })

  assert.deepEqual(defaults, {
    modelId: 'banana-pro',
    quality: '高画质',
    ratio: '16:9',
    resolution: '4K',
    count: 2,
  })
})

test('saved image node settings take precedence over remembered defaults', () => {
  const defaults = resolveImageGenerationDefaults({
    nodeData: {
      model: 'jimeng',
      quality: '标准画质',
      ratio: '1:1',
      resolution: '2K',
      count: 1,
    },
    remembered: {
      model: 'banana-pro',
      quality: '高画质',
      ratio: '16:9',
      resolution: '4K',
      count: 2,
    },
    modelOptions: [
      { id: 'jimeng', label: '即梦' },
      { id: 'banana-pro', label: 'Banana Pro' },
    ],
  })

  assert.deepEqual(defaults, {
    modelId: 'jimeng',
    quality: '标准画质',
    ratio: '1:1',
    resolution: '2K',
    count: 1,
  })
})

test('video generation defaults inherit the last used video model and parameters', () => {
  const defaults = resolveVideoGenerationDefaults({
    nodeData: {},
    remembered: {
      model: 'veo3-fast',
      aspectRatio: '9:16',
      resolution: '1080P',
      durationSeconds: 8,
      count: 2,
    },
    modelOptions: [
      { id: 'seedance-2.0', label: 'Seedance 2.0' },
      { id: 'veo3-fast', label: 'Veo 3 Fast' },
    ],
  })

  assert.deepEqual(defaults, {
    modelId: 'veo3-fast',
    aspectRatio: '9:16',
    resolution: '1080P',
    durationSeconds: 8,
    count: 2,
  })
})
