import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { GenerationResponse } from '@jimeng-flow/shared/generateNode'
import type {
  VideoGenerationRequest,
  VideoGenerationRun,
} from '@jimeng-flow/shared/videoNode'
import {
  buildAgentVideoRunningPatch,
  buildAgentVideoCompletionPatch,
  buildAgentVideoReferences,
  getAgentVideoGeneratedAssetIds,
  resolveAgentVideoMode,
  selectAgentVideoTargetNodeId,
} from '../src/utils/agentVideoGeneration'
import * as agentVideoGeneration from '../src/utils/agentVideoGeneration'

test('resolveAgentVideoMode keeps text-to-video when there are no image refs', () => {
  assert.equal(resolveAgentVideoMode('first_last_frame', []), 'text_to_video')
  assert.equal(resolveAgentVideoMode('all_reference', []), 'text_to_video')
})

test('selectAgentVideoTargetNodeId reuses a referenced video node for another draw', () => {
  const nodes = [
    { id: 'image-1', type: 'image' },
    { id: 'video-1', type: 'video' },
    { id: 'video-2', type: 'video' },
  ]

  assert.equal(
    selectAgentVideoTargetNodeId(['image-1', 'video-2', 'video-1'], nodes),
    'video-2',
  )
  assert.equal(selectAgentVideoTargetNodeId(['image-1'], nodes), null)
})

test('getAgentVideoInputImageNodes includes generated source images for references and edges', () => {
  const getAgentVideoInputImageNodes = (
    agentVideoGeneration as typeof agentVideoGeneration & {
      getAgentVideoInputImageNodes?: (input: {
        contextNodeIds: string[]
        sourceImageNodeIds?: string[]
        nodes: Array<{ id: string; type?: string | null; data?: unknown }>
      }) => {
        nodes: Array<{ id: string }>
        assetIds: string[]
      }
    }
  ).getAgentVideoInputImageNodes
  assert.equal(typeof getAgentVideoInputImageNodes, 'function')

  const nodes = [
    { id: 'image-context', type: 'image', data: { assetId: 'asset_context' } },
    { id: 'text-1', type: 'text', data: { content: 'prompt' } },
    { id: 'image-generated', type: 'image', data: { assetId: 'asset_generated' } },
    { id: 'image-empty', type: 'image', data: {} },
  ]

  const result = getAgentVideoInputImageNodes!({
    contextNodeIds: ['image-context', 'text-1'],
    sourceImageNodeIds: ['image-generated', 'image-context', 'image-empty'],
    nodes,
  })

  assert.deepEqual(
    result.nodes.map((node) => node.id),
    ['image-context', 'image-generated'],
  )
  assert.deepEqual(result.assetIds, ['asset_context', 'asset_generated'])
})

test('getAgentStoryboardVideoSource keeps the image node behind a storyboard asset', () => {
  const getAgentStoryboardVideoSource = (
    agentVideoGeneration as typeof agentVideoGeneration & {
      getAgentStoryboardVideoSource?: (input: {
        imageAssetId?: string
        imageNodeId?: string
        nodes: Array<{ id: string; type?: string | null; data?: unknown }>
      }) => {
        assetId: string
        nodeId: string | null
      } | null
    }
  ).getAgentStoryboardVideoSource
  assert.equal(typeof getAgentStoryboardVideoSource, 'function')

  const nodes = [
    { id: 'image-old', type: 'image', data: { assetId: 'asset_old' } },
    { id: 'image-shot', type: 'image', data: { assetId: 'asset_shot' } },
  ]

  assert.deepEqual(
    getAgentStoryboardVideoSource!({
      imageAssetId: 'asset_shot',
      imageNodeId: 'image-shot',
      nodes,
    }),
    { assetId: 'asset_shot', nodeId: 'image-shot' },
  )
  assert.deepEqual(
    getAgentStoryboardVideoSource!({
      imageAssetId: 'asset_old',
      imageNodeId: 'missing-node',
      nodes,
    }),
    { assetId: 'asset_old', nodeId: 'image-old' },
  )
  assert.equal(
    getAgentStoryboardVideoSource!({
      imageNodeId: 'image-shot',
      nodes,
    }),
    null,
  )
})

test('applyAgentStoryboardVideoResult records generated video asset and node on the matching shot', () => {
  const applyAgentStoryboardVideoResult = (
    agentVideoGeneration as typeof agentVideoGeneration & {
      applyAgentStoryboardVideoResult?: (
        items: Array<{
          id: string
          shotNumber: number
          shotDescription: string
          prompt: string
          imageAssetId?: string
          imageNodeId?: string
          videoAssetId?: string
          videoNodeId?: string
        }>,
        index: number,
        result: { videoAssetId?: string; videoNodeId?: string },
      ) => Array<{
        id: string
        shotNumber: number
        shotDescription: string
        prompt: string
        imageAssetId?: string
        imageNodeId?: string
        videoAssetId?: string
        videoNodeId?: string
      }>
    }
  ).applyAgentStoryboardVideoResult
  assert.equal(typeof applyAgentStoryboardVideoResult, 'function')

  const items = [
    {
      id: 'shot-1',
      shotNumber: 1,
      shotDescription: 'first shot',
      prompt: 'first image',
      imageAssetId: 'asset_image_1',
      imageNodeId: 'image-1',
    },
    {
      id: 'shot-2',
      shotNumber: 2,
      shotDescription: 'second shot',
      prompt: 'second image',
      imageAssetId: 'asset_image_2',
      imageNodeId: 'image-2',
    },
  ]

  const updated = applyAgentStoryboardVideoResult!(items, 1, {
    videoAssetId: 'asset_video_2',
    videoNodeId: 'video-2',
  })

  assert.equal(updated[0].videoAssetId, undefined)
  assert.equal(updated[0].videoNodeId, undefined)
  assert.equal(updated[1].videoAssetId, 'asset_video_2')
  assert.equal(updated[1].videoNodeId, 'video-2')
  assert.notEqual(updated, items)
})

test('getAgentStoryboardVideoTargetNodeId reuses the generated video node for another storyboard draw', () => {
  const getAgentStoryboardVideoTargetNodeId = (
    agentVideoGeneration as typeof agentVideoGeneration & {
      getAgentStoryboardVideoTargetNodeId?: (input: {
        videoNodeId?: string
        nodes: Array<{ id: string; type?: string | null }>
      }) => string | null
    }
  ).getAgentStoryboardVideoTargetNodeId
  assert.equal(typeof getAgentStoryboardVideoTargetNodeId, 'function')

  const nodes = [
    { id: 'image-1', type: 'image' },
    { id: 'video-existing', type: 'video' },
  ]

  assert.equal(
    getAgentStoryboardVideoTargetNodeId!({
      videoNodeId: 'video-existing',
      nodes,
    }),
    'video-existing',
  )
  assert.equal(
    getAgentStoryboardVideoTargetNodeId!({
      videoNodeId: 'image-1',
      nodes,
    }),
    null,
  )
  assert.equal(
    getAgentStoryboardVideoTargetNodeId!({
      videoNodeId: 'missing-video',
      nodes,
    }),
    null,
  )
})

test('applyAgentStoryboardVideoRestoreResult syncs a restored video history asset back to storyboard', () => {
  const applyAgentStoryboardVideoRestoreResult = (
    agentVideoGeneration as typeof agentVideoGeneration & {
      applyAgentStoryboardVideoRestoreResult?: (
        messages: Array<{
          id: string
          role: 'user' | 'assistant'
          content: string
          createdAt: string
          storyboard?: {
            title: string
            style: string
            items: Array<{
              id: string
              shotNumber: number
              shotDescription: string
              prompt: string
              videoAssetId?: string
              videoNodeId?: string
            }>
          }
        }>,
        result: { videoNodeId?: string; videoAssetId?: string },
      ) => Array<{
        id: string
        storyboard?: {
          items: Array<{
            id: string
            videoAssetId?: string
            videoNodeId?: string
          }>
        }
      }>
    }
  ).applyAgentStoryboardVideoRestoreResult
  assert.equal(typeof applyAgentStoryboardVideoRestoreResult, 'function')

  const messages = [
    {
      id: 'msg-user',
      role: 'user' as const,
      content: 'make a storyboard',
      createdAt: '2026-07-07T09:00:00.000Z',
    },
    {
      id: 'msg-story',
      role: 'assistant' as const,
      content: 'storyboard',
      createdAt: '2026-07-07T09:01:00.000Z',
      storyboard: {
        title: 'Story',
        style: 'cinematic',
        items: [
          {
            id: 'shot-1',
            shotNumber: 1,
            shotDescription: 'first',
            prompt: 'first image',
            videoAssetId: 'asset_video_old',
            videoNodeId: 'video-1',
          },
          {
            id: 'shot-2',
            shotNumber: 2,
            shotDescription: 'second',
            prompt: 'second image',
            videoAssetId: 'asset_video_other',
            videoNodeId: 'video-2',
          },
        ],
      },
    },
  ]

  const updated = applyAgentStoryboardVideoRestoreResult!(messages, {
    videoNodeId: 'video-1',
    videoAssetId: 'asset_video_restored',
  })

  assert.equal(
    updated[1].storyboard?.items[0]?.videoAssetId,
    'asset_video_restored',
  )
  assert.equal(
    updated[1].storyboard?.items[1]?.videoAssetId,
    'asset_video_other',
  )
  assert.notEqual(updated, messages)
})

test('getAgentStoryboardItemMediaStatus names the latest storyboard media state', () => {
  const getAgentStoryboardItemMediaStatus = (
    agentVideoGeneration as typeof agentVideoGeneration & {
      getAgentStoryboardItemMediaStatus?: (item: {
        imageAssetId?: string
        videoAssetId?: string
      }) => string
    }
  ).getAgentStoryboardItemMediaStatus
  assert.equal(typeof getAgentStoryboardItemMediaStatus, 'function')

  assert.equal(getAgentStoryboardItemMediaStatus!({}), '待生成')
  assert.equal(
    getAgentStoryboardItemMediaStatus!({ imageAssetId: 'asset_image_1' }),
    '图片已生成',
  )
  assert.equal(
    getAgentStoryboardItemMediaStatus!({
      imageAssetId: 'asset_image_1',
      videoAssetId: 'asset_video_1',
    }),
    '视频已生成',
  )
})

test('getAgentStoryboardVideoActionLabel names repeat draws after videos exist', () => {
  const getAgentStoryboardVideoActionLabel = (
    agentVideoGeneration as typeof agentVideoGeneration & {
      getAgentStoryboardVideoActionLabel?: (
        items: Array<{ imageAssetId?: string; videoAssetId?: string }>,
      ) => string
    }
  ).getAgentStoryboardVideoActionLabel
  assert.equal(typeof getAgentStoryboardVideoActionLabel, 'function')

  assert.equal(
    getAgentStoryboardVideoActionLabel!([
      { imageAssetId: 'asset_image_1' },
      { imageAssetId: 'asset_image_2' },
    ]),
    '生成视频',
  )
  assert.equal(
    getAgentStoryboardVideoActionLabel!([
      { imageAssetId: 'asset_image_1', videoAssetId: 'asset_video_1' },
      { imageAssetId: 'asset_image_2', videoAssetId: 'asset_video_2' },
    ]),
    '再抽一次',
  )
})

test('getAgentStoryboardVideoLocateLabel only appears after a storyboard video exists', () => {
  const getAgentStoryboardVideoLocateLabel = (
    agentVideoGeneration as typeof agentVideoGeneration & {
      getAgentStoryboardVideoLocateLabel?: (item: {
        videoAssetId?: string
        videoNodeId?: string
      }) => string | null
    }
  ).getAgentStoryboardVideoLocateLabel
  assert.equal(typeof getAgentStoryboardVideoLocateLabel, 'function')

  assert.equal(getAgentStoryboardVideoLocateLabel!({}), null)
  assert.equal(
    getAgentStoryboardVideoLocateLabel!({ videoAssetId: 'asset_video_1' }),
    null,
  )
  assert.equal(
    getAgentStoryboardVideoLocateLabel!({
      videoAssetId: 'asset_video_1',
      videoNodeId: 'video-node-1',
    }),
    '定位视频',
  )
})

test('buildAgentStoryboardVideoMedia uses the shared agent video mode rules', () => {
  const buildAgentStoryboardVideoMedia = (
    agentVideoGeneration as typeof agentVideoGeneration & {
      buildAgentStoryboardVideoMedia?: (input: {
        requestedMode: 'text_to_video' | 'image_to_video' | 'first_last_frame' | 'all_reference' | 'image_reference'
        sourceAssetId: string
        tailAssetId?: string
        referenceAssetIds?: string[]
      }) => {
        mode: string
        inputImages: string[]
        references: Array<{ role: string; assetId: string }>
      }
    }
  ).buildAgentStoryboardVideoMedia
  assert.equal(typeof buildAgentStoryboardVideoMedia, 'function')

  assert.deepEqual(
    buildAgentStoryboardVideoMedia!({
      requestedMode: 'first_last_frame',
      sourceAssetId: 'asset_storyboard_frame',
    }),
    {
      mode: 'image_to_video',
      inputImages: ['asset_storyboard_frame'],
      references: [
        { kind: 'image', role: 'first_frame', assetId: 'asset_storyboard_frame' },
      ],
    },
  )
  assert.deepEqual(
    buildAgentStoryboardVideoMedia!({
      requestedMode: 'all_reference',
      sourceAssetId: 'asset_storyboard_ref',
      referenceAssetIds: [
        'asset_storyboard_ref',
        'asset_storyboard_style',
        ' asset_storyboard_layout ',
      ],
    }),
    {
      mode: 'all_reference',
      inputImages: [
        'asset_storyboard_ref',
        'asset_storyboard_style',
        'asset_storyboard_layout',
      ],
      references: [
        { kind: 'image', role: 'reference', assetId: 'asset_storyboard_ref' },
        { kind: 'image', role: 'reference', assetId: 'asset_storyboard_style' },
        { kind: 'image', role: 'reference', assetId: 'asset_storyboard_layout' },
      ],
    },
  )
  assert.deepEqual(
    buildAgentStoryboardVideoMedia!({
      requestedMode: 'first_last_frame',
      sourceAssetId: 'asset_storyboard_first',
      tailAssetId: 'asset_storyboard_last',
    }),
    {
      mode: 'first_last_frame',
      inputImages: ['asset_storyboard_first', 'asset_storyboard_last'],
      references: [
        { kind: 'image', role: 'first_frame', assetId: 'asset_storyboard_first' },
        { kind: 'image', role: 'last_frame', assetId: 'asset_storyboard_last' },
      ],
    },
  )
})

test('getAgentStoryboardVideoReferenceSources collects storyboard image sources in order', () => {
  const getAgentStoryboardVideoReferenceSources = (
    agentVideoGeneration as typeof agentVideoGeneration & {
      getAgentStoryboardVideoReferenceSources?: (input: {
        items: Array<{ imageAssetId?: string; imageNodeId?: string }>
        nodes: Array<{ id: string; type?: string | null; data?: unknown }>
      }) => Array<{ assetId: string; nodeId: string | null }>
    }
  ).getAgentStoryboardVideoReferenceSources
  assert.equal(typeof getAgentStoryboardVideoReferenceSources, 'function')

  const result = getAgentStoryboardVideoReferenceSources!({
    items: [
      { imageAssetId: 'asset_a', imageNodeId: 'image-a' },
      { imageAssetId: 'asset_b', imageNodeId: 'image-b' },
      { imageAssetId: 'asset_a', imageNodeId: 'image-a-copy' },
      { imageAssetId: ' ' },
    ],
    nodes: [
      { id: 'image-a', type: 'image', data: { assetId: 'asset_a' } },
      { id: 'image-b', type: 'image', data: { assetId: 'asset_b' } },
      { id: 'image-a-copy', type: 'image', data: { assetId: 'asset_a' } },
      { id: 'text-1', type: 'text', data: { assetId: 'asset_c' } },
    ],
  })

  assert.deepEqual(result, [
    { assetId: 'asset_a', nodeId: 'image-a' },
    { assetId: 'asset_b', nodeId: 'image-b' },
  ])
})

test('resolveAgentVideoMode supports first and last frame when two images are available', () => {
  assert.equal(
    resolveAgentVideoMode('first_last_frame', ['asset_first', 'asset_last']),
    'first_last_frame',
  )
  assert.deepEqual(
    buildAgentVideoReferences('first_last_frame', ['asset_first', 'asset_last']),
    [
      { kind: 'image', role: 'first_frame', assetId: 'asset_first' },
      { kind: 'image', role: 'last_frame', assetId: 'asset_last' },
    ],
  )
})

test('resolveAgentVideoMode falls back to image-to-video for first-last mode with one image', () => {
  assert.equal(resolveAgentVideoMode('first_last_frame', ['asset_only']), 'image_to_video')
  assert.deepEqual(buildAgentVideoReferences('first_last_frame', ['asset_only']), [
    { kind: 'image', role: 'first_frame', assetId: 'asset_only' },
  ])
})

test('resolveAgentVideoMode keeps multi-image reference mode with image refs', () => {
  assert.equal(
    resolveAgentVideoMode('all_reference', ['asset_a', 'asset_b', 'asset_c']),
    'all_reference',
  )
  assert.deepEqual(
    buildAgentVideoReferences('all_reference', ['asset_a', 'asset_b']),
    [
      { kind: 'image', role: 'reference', assetId: 'asset_a' },
      { kind: 'image', role: 'reference', assetId: 'asset_b' },
    ],
  )
})

test('buildAgentVideoCompletionPatch appends agent video history runs', () => {
  const olderRun: VideoGenerationRun = {
    id: 'gen_video_old',
    generationId: 'gen_video_old',
    status: 'success',
    assetIds: ['asset_video_old'],
    prompt: 'old agent video',
    model: 'seedance-2.0',
    mode: 'text_to_video',
    aspectRatio: '16:9',
    resolution: '720P',
    quality: 'standard',
    durationSeconds: 5,
    count: 1,
    generateAudio: true,
    inputImageAssetIds: [],
    createdAt: '2026-07-06T09:00:00.000Z',
  }
  const request: VideoGenerationRequest = {
    flowId: 'local',
    nodeId: 'video-agent-1',
    mediaType: 'video',
    mode: 'first_last_frame',
    prompt: 'agent asks for a cinematic transition',
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
  const response: GenerationResponse = {
    id: 'gen_video_new',
    nodeId: 'video-agent-1',
    status: 'success',
    results: [{ assetId: 'asset_video_new' }],
    createdAt: '2026-07-06T10:00:00.000Z',
    finishedAt: '2026-07-06T10:01:00.000Z',
  }

  const patch = buildAgentVideoCompletionPatch(
    response,
    request,
    [olderRun],
    '2026-07-06T10:01:05.000Z',
  )

  assert.deepEqual(patch.assetIds, ['asset_video_new'])
  assert.equal(patch.generationId, 'gen_video_new')
  assert.equal(patch.updatedAt, '2026-07-06T10:01:05.000Z')
  assert.deepEqual(
    patch.generationRuns?.map((run) => run.generationId),
    ['gen_video_old', 'gen_video_new'],
  )
  assert.deepEqual(patch.generationRuns?.[1]?.references, [
    { kind: 'image', role: 'first_frame', assetId: 'asset_first' },
    { kind: 'image', role: 'last_frame', assetId: 'asset_last' },
  ])
})

test('buildAgentVideoRunningPatch preserves the current video and history while agent redraws', () => {
  const olderRun: VideoGenerationRun = {
    id: 'gen_video_old',
    generationId: 'gen_video_old',
    status: 'success',
    assetIds: ['asset_video_old'],
    prompt: 'old agent video',
    model: 'seedance-2.0',
    mode: 'text_to_video',
    aspectRatio: '16:9',
    resolution: '720P',
    quality: 'standard',
    durationSeconds: 5,
    count: 1,
    generateAudio: true,
    inputImageAssetIds: [],
    createdAt: '2026-07-06T09:00:00.000Z',
  }
  const request: VideoGenerationRequest = {
    flowId: 'local',
    nodeId: 'video-agent-1',
    mediaType: 'video',
    mode: 'image_to_video',
    prompt: 'agent redraws with first frame',
    inputImages: ['asset_first'],
    references: [
      { kind: 'image', role: 'first_frame', assetId: 'asset_first' },
    ],
    model: 'seedance-2.0',
    aspectRatio: '16:9',
    resolution: '720P',
    quality: 'standard',
    durationSeconds: 5,
    count: 1,
    generateAudio: true,
  }

  const patch = buildAgentVideoRunningPatch(
    request,
    {
      assetIds: ['asset_video_old'],
      generationRuns: [olderRun],
    },
    '2026-07-06T10:00:00.000Z',
  )

  assert.equal(patch.status, 'running')
  assert.deepEqual(patch.assetIds, ['asset_video_old'])
  assert.deepEqual(patch.generationRuns, [olderRun])
  assert.equal(patch.prompt, 'agent redraws with first frame')
  assert.deepEqual(patch.inputImageAssetIds, ['asset_first'])
  assert.deepEqual(patch.references, [
    { kind: 'image', role: 'first_frame', assetId: 'asset_first' },
  ])
})

test('buildAgentVideoCompletionPatch keeps the previous video when agent redraw fails', () => {
  const olderRun: VideoGenerationRun = {
    id: 'gen_video_old',
    generationId: 'gen_video_old',
    status: 'success',
    assetIds: ['asset_video_old'],
    prompt: 'old agent video',
    model: 'seedance-2.0',
    mode: 'text_to_video',
    aspectRatio: '16:9',
    resolution: '720P',
    quality: 'standard',
    durationSeconds: 5,
    count: 1,
    generateAudio: true,
    inputImageAssetIds: [],
    createdAt: '2026-07-06T09:00:00.000Z',
  }
  const request: VideoGenerationRequest = {
    flowId: 'local',
    nodeId: 'video-agent-1',
    mediaType: 'video',
    mode: 'text_to_video',
    prompt: 'agent redraw that fails',
    inputImages: [],
    model: 'seedance-2.0',
    aspectRatio: '16:9',
    resolution: '720P',
    quality: 'standard',
    durationSeconds: 5,
    count: 1,
    generateAudio: true,
  }
  const response: GenerationResponse = {
    id: 'gen_video_failed',
    nodeId: 'video-agent-1',
    status: 'error',
    error: 'provider timeout',
    results: [],
    createdAt: '2026-07-06T10:00:00.000Z',
    finishedAt: '2026-07-06T10:01:00.000Z',
  }

  const patch = buildAgentVideoCompletionPatch(
    response,
    request,
    [olderRun],
    '2026-07-06T10:01:05.000Z',
    ['asset_video_old'],
  )

  assert.deepEqual(patch.assetIds, ['asset_video_old'])
  assert.equal(patch.error, 'provider timeout')
  assert.deepEqual(
    patch.generationRuns?.map((run) => run.generationId),
    ['gen_video_old', 'gen_video_failed'],
  )
  assert.deepEqual(getAgentVideoGeneratedAssetIds(response), [])
})
