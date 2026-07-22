import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  extractImageNodeAssetId,
  getUpstreamImageAssetIds,
  getUpstreamImageReferences,
} from '../src/utils/textNodeImageInputs'

test('text node collects direct upstream image assets for reverse prompt', () => {
  const refs = getUpstreamImageReferences({
    nodeId: 'text_1',
    nodes: [
      {
        id: 'img_a',
        type: 'image',
        data: { assetId: 'asset_a', title: '参考图 A' },
      },
      {
        id: 'img_empty',
        type: 'image',
        data: { assetId: '  ', title: '空图' },
      },
      {
        id: 'text_up',
        type: 'text',
        data: { title: '上游文本' },
      },
      { id: 'text_1', type: 'text', data: {} },
    ],
    edges: [
      { source: 'img_a', target: 'text_1' },
      { source: 'img_empty', target: 'text_1' },
      { source: 'text_up', target: 'text_1' },
    ],
  })

  assert.deepEqual(refs, [
    {
      nodeId: 'img_a',
      assetId: 'asset_a',
      title: '参考图 A',
    },
  ])
  assert.deepEqual(
    getUpstreamImageAssetIds({
      nodeId: 'text_1',
      nodes: [
        {
          id: 'img_a',
          type: 'image',
          data: { assetId: 'asset_a' },
        },
        { id: 'text_1', type: 'text', data: {} },
      ],
      edges: [{ source: 'img_a', target: 'text_1' }],
    }),
    ['asset_a'],
  )
})

test('text node ignores non-direct upstream images', () => {
  assert.deepEqual(
    getUpstreamImageAssetIds({
      nodeId: 'text_1',
      nodes: [
        { id: 'img_root', type: 'image', data: { assetId: 'asset_root' } },
        { id: 'img_mid', type: 'image', data: { assetId: 'asset_mid' } },
        { id: 'text_1', type: 'text', data: {} },
      ],
      edges: [
        { source: 'img_root', target: 'img_mid' },
        { source: 'img_mid', target: 'text_1' },
      ],
    }),
    ['asset_mid'],
  )
})

test('extractImageNodeAssetId falls back to outputAssetIds', () => {
  assert.equal(
    extractImageNodeAssetId({
      outputAssetIds: ['asset_from_output'],
    }),
    'asset_from_output',
  )
})

test('syncAllTextNodeImageRefs writes inputImageAssetIds onto text targets', async () => {
  const { syncAllTextNodeImageRefs } = await import(
    '../src/utils/syncTextNodeImageRefs'
  )
  const nodes = [
    {
      id: 'img_a',
      type: 'image',
      position: { x: 0, y: 0 },
      data: { title: '图', assetId: 'asset_a' },
    },
    {
      id: 'text_b',
      type: 'text',
      position: { x: 100, y: 0 },
      data: { title: '文本' },
    },
  ] as any
  const edges = [
    { id: 'e1', source: 'img_a', target: 'text_b' },
  ] as any
  const next = syncAllTextNodeImageRefs(nodes, edges)
  const text = next.find((n) => n.id === 'text_b')
  assert.deepEqual((text?.data as any).inputImageAssetIds, ['asset_a'])
})
