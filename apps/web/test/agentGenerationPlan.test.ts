import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  getAgentImageDimensions,
  resolveAgentImageGenerationParams,
  resolveAgentVideoGenerationParams,
} from '../src/utils/agentGenerationPlan'

test('agent image plan applies supported model, ratio, resolution, and count suggestions', () => {
  const result = resolveAgentImageGenerationParams(
    { model: 'jimeng-5.0', aspectRatio: '1:1', resolution: '2K', count: 1 },
    {
      model: 'jimeng-5.0-pro',
      aspectRatio: '9:16',
      resolution: '4K',
      count: 4,
    },
    ['jimeng-5.0-pro', 'jimeng-5.0'],
  )

  assert.deepEqual(result, {
    model: 'jimeng-5.0-pro',
    aspectRatio: '9:16',
    resolution: '4K',
    count: 4,
  })
  assert.deepEqual(getAgentImageDimensions(result.aspectRatio, result.resolution), {
    width: 2304,
    height: 4096,
  })
})

test('agent image plan converts dimensions to presets and rejects unavailable settings', () => {
  const result = resolveAgentImageGenerationParams(
    { model: 'jimeng-5.0', aspectRatio: '1:1', resolution: '2K', count: 1 },
    { model: 'missing', width: 1024, height: 1792, resolution: '1K', count: 3 },
    ['jimeng-5.0'],
  )

  assert.deepEqual(result, {
    model: 'jimeng-5.0',
    aspectRatio: '9:16',
    resolution: '2K',
    count: 2,
  })
})

test('agent video plan applies only supported canvas parameters', () => {
  const result = resolveAgentVideoGenerationParams(
    {
      model: 'seedance-2.0',
      mode: 'text_to_video',
      aspectRatio: '16:9',
      resolution: '720P',
      durationSeconds: 5,
      count: 1,
      quality: 'standard',
    },
    {
      model: 'seedance-2.0-vip',
      mode: 'first_last_frame',
      aspectRatio: '9:16',
      resolution: '1080p',
      durationSeconds: 11,
      count: 4,
      quality: 'high',
    },
    ['seedance-2.0', 'seedance-2.0-vip'],
  )

  assert.deepEqual(result, {
    model: 'seedance-2.0-vip',
    mode: 'first_last_frame',
    aspectRatio: '9:16',
    resolution: '1080P',
    durationSeconds: 11,
    count: 4,
    quality: 'high',
  })
})
