import assert from 'node:assert/strict'
import test from 'node:test'
import type { Asset } from '@jimeng-flow/shared/asset'
import {
  createAssetContentHash,
  findDuplicateImportedImage,
} from '../src/services/assetDedup'

test('identical imported image content resolves to the existing asset', () => {
  const contentHash = createAssetContentHash(Buffer.from('same image bytes'))
  const existing: Asset = {
    id: 'asset_existing',
    type: 'image',
    path: 'outputs/asset_existing.png',
    params: { origin: 'upload', contentHash },
    createdAt: '2026-07-07T09:00:00.000Z',
  }

  assert.equal(
    findDuplicateImportedImage([existing], contentHash)?.id,
    'asset_existing',
  )
})

test('generated assets and videos are not treated as duplicate image imports', () => {
  const contentHash = createAssetContentHash(Buffer.from('same bytes'))
  const assets: Asset[] = [
    {
      id: 'asset_generated',
      type: 'image',
      path: 'outputs/generated.png',
      provider: 'codex',
      params: { contentHash },
      createdAt: '2026-07-07T09:00:00.000Z',
    },
    {
      id: 'asset_video',
      type: 'video',
      path: 'outputs/video.mp4',
      params: { origin: 'upload', contentHash },
      createdAt: '2026-07-07T10:00:00.000Z',
    },
  ]

  assert.equal(findDuplicateImportedImage(assets, contentHash), null)
})
