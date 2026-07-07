import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { JimengGenerateVideoParams } from '../src/services/jimeng'
import { buildJimengVideoArgs } from '../src/services/jimeng'

const baseParams: JimengGenerateVideoParams = {
  flowId: 'local',
  nodeId: 'video-1',
  mediaType: 'video',
  mode: 'first_last_frame',
  prompt: 'camera move from day to night',
  inputImages: ['asset_first', 'asset_last'],
  references: [
    { kind: 'image', role: 'first_frame', assetId: 'asset_first' },
    { kind: 'image', role: 'last_frame', assetId: 'asset_last' },
  ],
  model: 'seedance-2.0',
  aspectRatio: '16:9',
  resolution: '720P',
  quality: 'standard',
  durationSeconds: 5,
  count: 1,
  generateAudio: true,
}

test('buildJimengVideoArgs uses frames2video for first and last frame references', () => {
  const args = buildJimengVideoArgs(baseParams, [
    { path: 'F:\\refs\\first.png', role: 'first_frame' },
    { path: 'F:\\refs\\last.png', role: 'last_frame' },
  ])

  assert.equal(args[0], 'frames2video')
  assert.ok(args.includes('--first=F:\\refs\\first.png'))
  assert.ok(args.includes('--last=F:\\refs\\last.png'))
  assert.equal(args.some((arg) => arg.startsWith('--images=')), false)
  assert.ok(args.includes('--prompt=camera move from day to night'))
  assert.ok(args.includes('--duration=5'))
})

test('buildJimengVideoArgs keeps all-reference multi-image inputs on multimodal2video', () => {
  const args = buildJimengVideoArgs(
    {
      ...baseParams,
      mode: 'all_reference',
      references: [
        { kind: 'image', role: 'reference', assetId: 'asset_a' },
        { kind: 'image', role: 'reference', assetId: 'asset_b' },
      ],
    },
    [
      { path: 'F:\\refs\\a.png', role: 'reference' },
      { path: 'F:\\refs\\b.png', role: 'reference' },
    ],
  )

  assert.equal(args[0], 'multimodal2video')
  assert.ok(args.includes('--image=F:\\refs\\a.png'))
  assert.ok(args.includes('--image=F:\\refs\\b.png'))
})

test('buildJimengVideoArgs sends action mimic inputs to multimodal video', () => {
  const args = buildJimengVideoArgs(
    {
      ...baseParams,
      mode: 'action_mimic',
      references: [
        { kind: 'image', role: 'reference', assetId: 'asset_a' },
        { kind: 'image', role: 'reference', assetId: 'asset_b' },
      ],
    },
    [
      { path: 'F:\\refs\\a.png', role: 'reference' },
      { path: 'F:\\refs\\b.png', role: 'reference' },
    ],
  )

  assert.equal(args[0], 'multimodal2video')
  assert.ok(args.includes('--image=F:\\refs\\a.png'))
  assert.ok(args.includes('--image=F:\\refs\\b.png'))
})

test('buildJimengVideoArgs adds video resolution only once for single image video', () => {
  const args = buildJimengVideoArgs(
    {
      ...baseParams,
      mode: 'image_to_video',
      inputImages: ['asset_first'],
      references: [
        { kind: 'image', role: 'first_frame', assetId: 'asset_first' },
      ],
      resolution: '720P',
    },
    [{ path: 'F:\\refs\\first.png', role: 'first_frame' }],
  )

  assert.equal(args[0], 'image2video')
  assert.deepEqual(
    args.filter((arg) => arg.startsWith('--video_resolution=')),
    ['--video_resolution=720p'],
  )
})

test('buildJimengVideoArgs omits unsupported model and resolution args for multi-frame video', () => {
  const args = buildJimengVideoArgs(
    {
      ...baseParams,
      mode: 'image_to_video',
      references: [
        { kind: 'image', role: 'reference', assetId: 'asset_a' },
        { kind: 'image', role: 'reference', assetId: 'asset_b' },
      ],
      resolution: '720P',
    },
    [
      { path: 'F:\\refs\\a.png', role: 'reference' },
      { path: 'F:\\refs\\b.png', role: 'reference' },
    ],
  )

  assert.equal(args[0], 'multiframe2video')
  assert.equal(args.some((arg) => arg.startsWith('--model_version=')), false)
  assert.equal(args.some((arg) => arg.startsWith('--video_resolution=')), false)
})

test('buildJimengVideoArgs uses multi-frame command for multi-image reference mode', () => {
  const args = buildJimengVideoArgs(
    {
      ...baseParams,
      mode: 'image_reference',
      references: [
        { kind: 'image', role: 'reference', assetId: 'asset_a' },
        { kind: 'image', role: 'reference', assetId: 'asset_b' },
      ],
    },
    [
      { path: 'F:\\refs\\a.png', role: 'reference' },
      { path: 'F:\\refs\\b.png', role: 'reference' },
    ],
  )

  assert.equal(args[0], 'multiframe2video')
  assert.ok(args.includes('--images=F:\\refs\\a.png,F:\\refs\\b.png'))
})
