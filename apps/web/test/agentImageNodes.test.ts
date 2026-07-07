import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  createAgentImageNodeRecords,
  shouldBlockAgentImageEditGeneration,
} from '../src/utils/agentImageNodes'

test('agent image generation records generated assets and created image node ids separately', () => {
  const created: Array<{ assetId: string; index: number }> = []

  const result = createAgentImageNodeRecords(
    [
      { assetId: 'asset-a' },
      { assetId: '  ' },
      { assetId: 'asset-b' },
      {},
    ],
    (assetId, index) => {
      created.push({ assetId, index })
      return `image-node-${index}`
    },
  )

  assert.deepEqual(result.assetIds, ['asset-a', 'asset-b'])
  assert.deepEqual(result.nodeIds, ['image-node-0', 'image-node-2'])
  assert.deepEqual(created, [
    { assetId: 'asset-a', index: 0 },
    { assetId: 'asset-b', index: 2 },
  ])
})

test('agent image generation does not treat failed node creation as a video source node', () => {
  const result = createAgentImageNodeRecords(
    [{ assetId: 'asset-a' }, { assetId: 'asset-b' }],
    (assetId) => (assetId === 'asset-a' ? 'image-node-a' : ''),
  )

  assert.deepEqual(result.assetIds, ['asset-a', 'asset-b'])
  assert.deepEqual(result.nodeIds, ['image-node-a'])
})

test('agent image edit only blocks unconfigured jimeng image models', () => {
  assert.equal(
    shouldBlockAgentImageEditGeneration('jimeng-5.0', false),
    true,
  )
  assert.equal(
    shouldBlockAgentImageEditGeneration('gpt-image-2-official', false),
    false,
  )
  assert.equal(
    shouldBlockAgentImageEditGeneration('gemini-3-pro-image-preview', false),
    false,
  )
})
