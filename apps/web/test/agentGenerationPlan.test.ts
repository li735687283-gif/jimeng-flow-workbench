import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  AGENT_IMAGE_ASPECT_RATIOS,
  AGENT_IMAGE_RESOLUTIONS,
  getAgentImageDimensions,
  getAgentImageResolutionOptions,
  getImageDimensionsByRatio,
  IMAGE_RESOLUTION_LONG_SIDES,
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
  // Codex CLI（gpt-image-2）支持真 2K/4K，服务端会把长边规范化到 ≤3840
  assert.deepEqual(getAgentImageResolutionOptions('codex:gpt-5.5'), ['1K', '2K', '4K'])
  assert.deepEqual(getAgentImageResolutionOptions('gpt-image-2'), ['1K', '2K', '4K'])
  // 第三方兼容接口只认固定三档尺寸，不开放 4K
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

test('shared size table: resolution tier equals long-side pixels', () => {
  assert.deepEqual(IMAGE_RESOLUTION_LONG_SIDES, { '1K': 1024, '2K': 2048, '4K': 4096 })
})

test('getImageDimensionsByRatio covers canvas-only ratios and fallback', () => {
  // 画布图片节点额外支持的比例，同样遵循「档位 = 长边」
  assert.deepEqual(getImageDimensionsByRatio('5:4', '2K'), { width: 2048, height: 1640 })
  assert.deepEqual(getImageDimensionsByRatio('1:2', '4K'), { width: 2048, height: 4096 })
  assert.deepEqual(getImageDimensionsByRatio('21:9', '2K'), { width: 2048, height: 880 })
  // 无法解析的比例（如「自适应」）按方形处理
  assert.deepEqual(getImageDimensionsByRatio('自适应', '1K'), { width: 1024, height: 1024 })
})
