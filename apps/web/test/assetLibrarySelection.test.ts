import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Asset } from '@jimeng-flow/shared/asset'
import {
  buildAssetInsertPatch,
  buildAssetRestorePatch,
  resolveAssetSourceNodeId,
} from '../src/utils/assetLibrarySelection'

test('resolveAssetSourceNodeId returns the source node when it still exists on the canvas', () => {
  const asset: Asset = {
    id: 'asset_video_1',
    type: 'video',
    path: 'workspace/outputs/asset_video_1.mp4',
    sourceNodeId: 'video-2',
    createdAt: '2026-07-07T11:00:00.000Z',
  }

  assert.equal(
    resolveAssetSourceNodeId(asset, ['video-1', 'video-2']),
    'video-2',
  )
})

test('resolveAssetSourceNodeId ignores missing or stale source node ids', () => {
  const assetWithoutSource: Asset = {
    id: 'asset_video_1',
    type: 'video',
    path: 'workspace/outputs/asset_video_1.mp4',
    createdAt: '2026-07-07T11:00:00.000Z',
  }
  const staleAsset: Asset = {
    ...assetWithoutSource,
    sourceNodeId: 'deleted-video',
  }

  assert.equal(resolveAssetSourceNodeId(assetWithoutSource, ['video-1']), null)
  assert.equal(resolveAssetSourceNodeId(staleAsset, ['video-1']), null)
})

test('buildAssetRestorePatch restores a selected video asset as the current video result', () => {
  const asset: Asset = {
    id: 'asset_video_2',
    type: 'video',
    path: 'workspace/outputs/asset_video_2.mp4',
    sourceNodeId: 'video-1',
    createdAt: '2026-07-07T11:00:00.000Z',
  }

  const patch = buildAssetRestorePatch(
    asset,
    {
      id: 'video-1',
      type: 'video',
      data: {
        title: '视频节点 1',
        status: 'success',
        assetIds: ['asset_video_1'],
        generationRuns: [
          {
            id: 'gen_video_1',
            generationId: 'gen_video_1',
            status: 'success',
            assetIds: ['asset_video_1', 'asset_video_2'],
            prompt: 'old draw',
            model: 'seedance-2.0',
            mode: 'text_to_video',
            aspectRatio: '16:9',
            resolution: '720P',
            quality: 'standard',
            durationSeconds: 5,
            count: 2,
            generateAudio: true,
            inputImageAssetIds: [],
            createdAt: '2026-07-07T11:00:00.000Z',
          },
        ],
      },
    },
    '2026-07-07T12:00:00.000Z',
  )

  assert.deepEqual(patch, {
    prompt: 'old draw',
    model: 'seedance-2.0',
    mode: 'text_to_video',
    aspectRatio: '16:9',
    resolution: '720P',
    quality: 'standard',
    durationSeconds: 5,
    count: 2,
    generateAudio: true,
    assetIds: ['asset_video_2', 'asset_video_1'],
    inputImageAssetIds: [],
    references: [],
    generationId: 'gen_video_1',
    status: 'success',
    error: undefined,
    updatedAt: '2026-07-07T12:00:00.000Z',
  })
})

test('buildAssetRestorePatch restores a selected image asset as the current image result', () => {
  const asset: Asset = {
    id: 'asset_image_2',
    type: 'image',
    path: 'workspace/outputs/asset_image_2.png',
    sourceNodeId: 'image-1',
    createdAt: '2026-07-07T11:00:00.000Z',
  }

  const patch = buildAssetRestorePatch(
    asset,
    {
      id: 'image-1',
      type: 'image',
      data: {
        title: '图片节点 1',
        status: 'success',
        assetId: 'asset_image_1',
        outputAssetIds: ['asset_image_1'],
        generationRuns: [
          {
            id: 'gen_image_1',
            generationId: 'gen_image_1',
            status: 'success',
            assetIds: ['asset_image_1', 'asset_image_2'],
            prompt: 'old image draw',
            model: 'gpt-image-2-official',
            width: 1792,
            height: 1024,
            count: 2,
            seed: null,
            inputImageAssetIds: ['asset_ref_1'],
            quality: 'standard',
            ratio: '16:9',
            resolution: '2K',
            createdAt: '2026-07-07T11:00:00.000Z',
          },
        ],
      },
    },
    '2026-07-07T12:00:00.000Z',
  )

  assert.deepEqual(patch, {
    assetId: 'asset_image_2',
    outputAssetIds: ['asset_image_2', 'asset_image_1'],
    generationId: 'gen_image_1',
    prompt: 'old image draw',
    model: 'gpt-image-2-official',
    width: 1792,
    height: 1024,
    count: 2,
    seed: null,
    quality: 'standard',
    ratio: '16:9',
    resolution: '2K',
    inputImageAssetIds: ['asset_ref_1'],
    status: 'success',
    error: undefined,
    updatedAt: '2026-07-07T12:00:00.000Z',
  })
})

test('buildAssetRestorePatch ignores assets that do not belong to the node', () => {
  const asset: Asset = {
    id: 'asset_video_2',
    type: 'video',
    path: 'workspace/outputs/asset_video_2.mp4',
    sourceNodeId: 'video-2',
    createdAt: '2026-07-07T11:00:00.000Z',
  }

  assert.equal(
    buildAssetRestorePatch(asset, {
      id: 'video-1',
      type: 'video',
      data: { title: '视频节点 1', status: 'success' },
    }),
    null,
  )
})

test('buildAssetInsertPatch creates image node data from an orphan image asset', () => {
  const asset: Asset = {
    id: 'asset_image_orphan',
    type: 'image',
    path: 'workspace/outputs/asset_image_orphan.png',
    prompt: 'orphan image prompt',
    createdAt: '2026-07-07T11:00:00.000Z',
  }

  assert.deepEqual(buildAssetInsertPatch(asset), {
    status: 'success',
    assetId: 'asset_image_orphan',
    outputAssetIds: ['asset_image_orphan'],
    prompt: 'orphan image prompt',
  })
})

test('buildAssetInsertPatch creates video node data from an orphan video asset', () => {
  const asset: Asset = {
    id: 'asset_video_orphan',
    type: 'video',
    path: 'workspace/outputs/asset_video_orphan.mp4',
    prompt: 'orphan video prompt',
    createdAt: '2026-07-07T11:00:00.000Z',
  }

  assert.deepEqual(buildAssetInsertPatch(asset), {
    status: 'success',
    assetIds: ['asset_video_orphan'],
    prompt: 'orphan video prompt',
  })
})
