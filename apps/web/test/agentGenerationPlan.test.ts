import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  AGENT_IMAGE_ASPECT_RATIOS,
  AGENT_IMAGE_RESOLUTIONS,
  getAgentImageDimensions,
  getAgentImageResolutionOptions,
} from '../src/utils/agentGenerationPlan'

test('getAgentImageDimensions maps ratios and resolutions to pixels', () => {
  assert.deepEqual(getAgentImageDimensions('1:1', '1K'), { width: 1024, height: 1024 })
  assert.deepEqual(getAgentImageDimensions('1:1', '2K'), { width: 2048, height: 2048 })
  assert.deepEqual(getAgentImageDimensions('16:9', '2K'), { width: 2048, height: 1152 })
  assert.deepEqual(getAgentImageDimensions('9:16', '4K'), { width: 2304, height: 4096 })
})

test('getAgentImageResolutionOptions depends on the image model', () => {
  assert.deepEqual(getAgentImageResolutionOptions('jimeng-5.0-pro'), ['1K', '2K', '4K'])
  assert.deepEqual(getAgentImageResolutionOptions('jimeng-5.0'), ['2K', '4K'])
  assert.deepEqual(getAgentImageResolutionOptions('gpt-image-1'), ['1K', '2K'])
})

test('declared ratio and resolution lists stay stable', () => {
  assert.deepEqual([...AGENT_IMAGE_ASPECT_RATIOS], [
    '1:1',
    '16:9',
    '9:16',
    '4:3',
    '3:4',
    '3:2',
    '2:3',
    '21:9',
  ])
  assert.deepEqual([...AGENT_IMAGE_RESOLUTIONS], ['1K', '2K', '4K'])
})
