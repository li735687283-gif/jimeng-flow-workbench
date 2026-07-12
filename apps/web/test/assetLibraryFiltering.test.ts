import assert from 'node:assert/strict'
import test from 'node:test'
import type { Asset } from '@jimeng-flow/shared/asset'
import { filterAssetLibraryAssets } from '../src/utils/assetLibraryFiltering'

const assets: Asset[] = [
  {
    id: 'asset_imported',
    type: 'image',
    path: 'workspace/outputs/imported.png',
    prompt: 'Mountain reference',
    createdAt: '2026-07-07T09:00:00.000Z',
  },
  {
    id: 'asset_generated_image',
    type: 'image',
    path: 'workspace/outputs/generated.png',
    prompt: 'Neon forest',
    provider: 'codex',
    params: { flowId: 'flow_current' },
    createdAt: '2026-07-07T10:00:00.000Z',
  },
  {
    id: 'asset_generated_video',
    type: 'video',
    path: 'workspace/outputs/generated.mp4',
    prompt: 'Forest camera move',
    provider: 'dreamina',
    params: { flowId: 'flow_other' },
    createdAt: '2026-07-07T11:00:00.000Z',
  },
]

test('asset library search matches labels without losing type filters', () => {
  assert.deepEqual(
    filterAssetLibraryAssets(assets, {
      filter: '图片',
      query: 'forest',
      mode: 'library',
    }).map((asset) => asset.id),
    ['asset_generated_image'],
  )
})

test('history mode keeps all generated image and video assets', () => {
  assert.deepEqual(
    filterAssetLibraryAssets(assets, {
      filter: '全部',
      query: '',
      mode: 'history',
      projectId: 'flow_current',
    }).map((asset) => asset.id),
    ['asset_generated_image'],
  )
})

test('history mode can include legacy generated assets referenced by this project', () => {
  assert.deepEqual(
    filterAssetLibraryAssets(
      [
        {
          id: 'legacy_generated',
          type: 'image',
          path: 'workspace/outputs/legacy.png',
          provider: 'codex',
          createdAt: '2026-07-07T10:00:00.000Z',
        },
      ],
      {
        filter: '全部',
        query: '',
        mode: 'history',
        projectId: 'flow_current',
        projectAssetIds: new Set(['legacy_generated']),
      },
    ).map((asset) => asset.id),
    ['legacy_generated'],
  )
})
