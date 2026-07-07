import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getImageGenerationInputImages } from '../src/utils/imageGenerationInputs'

test('image generation includes the current image asset for third-party image models', () => {
  assert.deepEqual(
    getImageGenerationInputImages({
      assetId: 'asset_current',
      modelId: 'gpt-image-2-official',
    }),
    ['asset_current'],
  )
})

test('image generation keeps blank image nodes text-to-image', () => {
  assert.deepEqual(
    getImageGenerationInputImages({
      assetId: undefined,
      modelId: 'gpt-image-2-official',
    }),
    [],
  )
})

test('image generation includes connected upstream image assets after the current image', () => {
  assert.deepEqual(
    getImageGenerationInputImages({
      assetId: 'asset_current',
      modelId: 'gpt-image-2-official',
      nodeId: 'target',
      nodes: [
        { id: 'root', type: 'image', data: { assetId: 'asset_root' } },
        { id: 'middle', type: 'image', data: { assetId: 'asset_middle' } },
        { id: 'target', type: 'image', data: { assetId: 'asset_current' } },
      ],
      edges: [
        { source: 'root', target: 'middle' },
        { source: 'middle', target: 'target' },
      ],
    }),
    ['asset_current', 'asset_root', 'asset_middle'],
  )
})

test('image generation deduplicates connected refs and ignores invalid upstream nodes', () => {
  assert.deepEqual(
    getImageGenerationInputImages({
      assetId: ' asset_current ',
      modelId: 'gpt-image-2-official',
      nodeId: 'target',
      nodes: [
        { id: 'same', type: 'image', data: { assetId: 'asset_current' } },
        { id: 'blank', type: 'image', data: { assetId: '   ' } },
        { id: 'text', type: 'text', data: { assetId: 'asset_text' } },
        { id: 'target', type: 'image', data: { assetId: 'asset_current' } },
      ],
      edges: [
        { source: 'same', target: 'target' },
        { source: 'blank', target: 'target' },
        { source: 'text', target: 'target' },
      ],
    }),
    ['asset_current'],
  )
})
