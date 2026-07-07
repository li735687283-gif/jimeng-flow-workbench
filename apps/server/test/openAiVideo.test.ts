import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import {
  extractOpenAiVideoResults,
  generateOpenAiCompatibleVideo,
  getOpenAiCompatibleVideoPayload,
} from '../src/services/openaiVideo'
import { getAssetFilePath, saveUploadFile } from '../src/services/assets'

test('getOpenAiCompatibleVideoPayload carries frame and reference images', () => {
  const payload = getOpenAiCompatibleVideoPayload({
    flowId: 'local',
    nodeId: 'video-1',
    mediaType: 'video',
    mode: 'first_last_frame',
    prompt: 'camera flies through the city',
    inputImages: ['asset_first', 'asset_last'],
    references: [
      { kind: 'image', role: 'first_frame', url: 'data:image/png;base64,first' },
      { kind: 'image', role: 'last_frame', url: 'data:image/png;base64,last' },
    ],
    model: 'veo3.1-fast',
    aspectRatio: '16:9',
    resolution: '720P',
    quality: 'standard',
    durationSeconds: 5,
    count: 1,
    generateAudio: true,
  })

  assert.deepEqual(payload, {
    model: 'veo3.1-fast',
    prompt: 'camera flies through the city',
    duration: 5,
    aspect_ratio: '16:9',
    resolution: '720P',
    n: 1,
    generate_audio: true,
    image_urls: ['data:image/png;base64,first', 'data:image/png;base64,last'],
    image_with_roles: [
      { url: 'data:image/png;base64,first', role: 'first_frame' },
      { url: 'data:image/png;base64,last', role: 'last_frame' },
    ],
    generation_type: 'frame',
  })
})

test('extractOpenAiVideoResults reads common video response shapes', () => {
  const results = extractOpenAiVideoResults({
    data: {
      result: {
        videos: [{ url: 'https://example.com/a.mp4' }],
      },
    },
    output_videos: ['https://example.com/b.mp4'],
  })

  assert.deepEqual(results, [
    { remoteUrl: 'https://example.com/a.mp4' },
    { remoteUrl: 'https://example.com/b.mp4' },
  ])
})

test('generateOpenAiCompatibleVideo polls task results', async () => {
  const calls: { url: string; body?: unknown }[] = []
  const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
    const body =
      typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
    calls.push({ url: String(url), body })

    if (String(url).endsWith('/videos')) {
      return Response.json({
        id: 'task_video_123',
        status: 'queued',
      })
    }

    if (String(url).endsWith('/videos/task_video_123')) {
      return Response.json({
        id: 'task_video_123',
        status: 'completed',
        data: [{ video_url: 'https://example.com/result.mp4' }],
      })
    }

    return Response.json({ message: 'unexpected url' }, { status: 404 })
  }

  const results = await generateOpenAiCompatibleVideo(
    {
      flowId: 'local',
      nodeId: 'video-1',
      mediaType: 'video',
      mode: 'text_to_video',
      prompt: 'a quiet cinematic shot',
      inputImages: [],
      model: 'veo3.1-fast',
      aspectRatio: '16:9',
      resolution: '720P',
      quality: 'standard',
      durationSeconds: 5,
      count: 1,
      generateAudio: false,
    },
    {
      settings: {
        llmBaseUrl: 'https://api.example.com/v1',
        llmApiKey: 'test-key',
      },
      fetchImpl,
      pollIntervalMs: 0,
    },
  )

  assert.deepEqual(results, [{ remoteUrl: 'https://example.com/result.mp4' }])
  assert.equal(calls.length, 2)
  assert.equal(calls[0].url, 'https://api.example.com/v1/videos')
  assert.equal(calls[1].url, 'https://api.example.com/v1/videos/task_video_123')
})

test('generateOpenAiCompatibleVideo falls back to videos generations endpoints', async () => {
  const calls: { url: string; body?: unknown }[] = []
  const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
    const body =
      typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
    const urlText = String(url)
    calls.push({ url: urlText, body })

    if (urlText.endsWith('/videos')) {
      return Response.json({ message: 'not found' }, { status: 404 })
    }

    if (urlText.endsWith('/videos/generations')) {
      return Response.json({
        task_id: 'task_video_456',
        status: 'submitted',
      })
    }

    if (urlText.endsWith('/videos/generations/task_video_456')) {
      return Response.json({
        status: 'succeeded',
        videos: ['https://example.com/fallback-result.mp4'],
      })
    }

    return Response.json({ message: 'unexpected url' }, { status: 404 })
  }

  const results = await generateOpenAiCompatibleVideo(
    {
      flowId: 'local',
      nodeId: 'video-1',
      mediaType: 'video',
      mode: 'text_to_video',
      prompt: 'a quiet cinematic shot',
      inputImages: [],
      model: 'veo3.1-fast',
      aspectRatio: '16:9',
      resolution: '720P',
      quality: 'standard',
      durationSeconds: 5,
      count: 1,
      generateAudio: false,
    },
    {
      settings: {
        llmBaseUrl: 'https://api.example.com/v1',
        llmApiKey: 'test-key',
      },
      fetchImpl,
      pollIntervalMs: 0,
    },
  )

  assert.deepEqual(results, [
    { remoteUrl: 'https://example.com/fallback-result.mp4' },
  ])
  assert.deepEqual(
    calls.map((call) => call.url),
    [
      'https://api.example.com/v1/videos',
      'https://api.example.com/v1/videos/generations',
      'https://api.example.com/v1/videos/generations/task_video_456',
    ],
  )
})

test('generateOpenAiCompatibleVideo resolves local asset file urls into reference data urls', async () => {
  const calls: { url: string; body?: unknown }[] = []
  const asset = await saveUploadFile({
    fileBuffer: Buffer.from('video-reference-frame'),
    originalName: 'first-frame.png',
    mimeType: 'image/png',
  })
  const assetPath = getAssetFilePath(asset)
  const metaPath = join(dirname(assetPath), `${asset.id}.json`)

  const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
    const body =
      typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
    calls.push({ url: String(url), body })
    return Response.json({
      videos: ['https://example.com/from-local-reference.mp4'],
    })
  }

  try {
    const results = await generateOpenAiCompatibleVideo(
      {
        flowId: 'local',
        nodeId: 'video-1',
        mediaType: 'video',
        mode: 'image_to_video',
        prompt: 'animate the local frame',
        inputImages: [],
        references: [
          {
            kind: 'image',
            role: 'first_frame',
            url: `/api/assets/${asset.id}/file`,
          },
        ],
        model: 'veo3.1-fast',
        aspectRatio: '16:9',
        resolution: '720P',
        quality: 'standard',
        durationSeconds: 5,
        count: 1,
        generateAudio: false,
      },
      {
        settings: {
          llmBaseUrl: 'https://api.example.com/v1',
          llmApiKey: 'test-key',
        },
        fetchImpl,
        pollIntervalMs: 0,
      },
    )

    assert.deepEqual(results, [
      { remoteUrl: 'https://example.com/from-local-reference.mp4' },
    ])
    assert.equal(calls.length, 1)
    assert.equal(calls[0].url, 'https://api.example.com/v1/videos')
    assert.deepEqual(
      (calls[0].body as { image_urls?: string[] }).image_urls,
      [`data:image/png;base64,${Buffer.from('video-reference-frame').toString('base64')}`],
    )
    assert.deepEqual((calls[0].body as { image_with_roles?: unknown[] }).image_with_roles, [
      {
        url: `data:image/png;base64,${Buffer.from('video-reference-frame').toString('base64')}`,
        role: 'first_frame',
      },
    ])
  } finally {
    await rm(assetPath, { force: true })
    await rm(metaPath, { force: true })
  }
})
