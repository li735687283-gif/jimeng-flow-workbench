import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import {
  extractOpenAiImageResults,
  generateOpenAiCompatibleImage,
  getOpenAiCompatibleImagePayload,
  getOpenAiCompatibleImageSize,
} from '../src/services/openaiImage'
import { getAssetFilePath, saveUploadFile } from '../src/services/assets'

test('extractOpenAiImageResults reads url image results', () => {
  const results = extractOpenAiImageResults({
    data: [{ url: 'https://example.com/image.png' }],
  })

  assert.deepEqual(results, [{ remoteUrl: 'https://example.com/image.png' }])
})

test('extractOpenAiImageResults reads base64 image results', () => {
  const results = extractOpenAiImageResults({
    data: [{ b64_json: 'aGVsbG8=' }],
  })

  assert.deepEqual(results, [{ base64Data: 'aGVsbG8=', mimeType: 'image/png' }])
})

test('getOpenAiCompatibleImageSize maps freeform ratios to provider-safe sizes', () => {
  assert.equal(
    getOpenAiCompatibleImageSize({
      model: 'gpt-image-1',
      width: 1536,
      height: 864,
    }),
    '1536x1024',
  )
  assert.equal(
    getOpenAiCompatibleImageSize({
      model: 'dall-e-3',
      width: 864,
      height: 1536,
    }),
    '1024x1792',
  )
  assert.equal(
    getOpenAiCompatibleImageSize({
      model: 'qwen-image-2.0',
      width: 1024,
      height: 1024,
    }),
    '1024x1024',
  )
})

test('getOpenAiCompatibleImagePayload uses APIMart async image parameters', () => {
  const payload = getOpenAiCompatibleImagePayload(
    {
      flowId: 'local',
      nodeId: 'image-1',
      mediaType: 'image',
      prompt: 'city skyline',
      model: 'gemini-3-pro-image-preview',
      width: 1536,
      height: 864,
      count: 4,
    },
    'https://api.apimart.ai/v1',
  )

  assert.deepEqual(payload, {
    model: 'gemini-3-pro-image-preview',
    prompt: 'city skyline',
    n: 1,
    size: '16:9',
    resolution: '2k',
  })
})

test('getOpenAiCompatibleImagePayload maps unified size table to APIMart resolution labels', () => {
  const base = {
    flowId: 'local',
    nodeId: 'image-1',
    mediaType: 'image' as const,
    prompt: 'city skyline',
    model: 'qwen-image-2.0',
    count: 1,
  }
  const payloadAt = (width: number, height: number) =>
    getOpenAiCompatibleImagePayload(
      { ...base, width, height },
      'https://api.apimart.ai/v1',
    )

  // 统一尺寸表：长边 1024/2048/4096 → 1k/2k/4k（2048 不再被误标为 4k）
  assert.equal(payloadAt(1024, 576).resolution, '1k')
  assert.equal(payloadAt(2048, 1152).resolution, '2k')
  assert.equal(payloadAt(4096, 2304).resolution, '4k')
})

test('generateOpenAiCompatibleImage fans out APIMart Gemini multi-image requests', async () => {
  let submitted = 0
  const requestedCounts: number[] = []
  const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
    const urlText = String(url)
    if (urlText.endsWith('/images/generations')) {
      const payload = JSON.parse(String(init?.body)) as { n?: number }
      requestedCounts.push(payload.n ?? 0)
      submitted++
      return Response.json({
        code: 200,
        data: [{ status: 'submitted', task_id: `task_fanout_${submitted}` }],
      })
    }

    const taskId = /\/tasks\/([^?]+)/.exec(urlText)?.[1] ?? 'unknown'
    return Response.json({
      code: 200,
      data: {
        status: 'completed',
        result: {
          images: [
            {
              url: [`https://upload.apimart.ai/f/image/${taskId}.png`],
            },
          ],
        },
      },
    })
  }

  const results = await generateOpenAiCompatibleImage(
    {
      flowId: 'local',
      nodeId: 'image-fanout',
      mediaType: 'image',
      prompt: 'four distinct options',
      model: 'gemini-3-pro-image-preview',
      width: 1536,
      height: 864,
      count: 4,
    },
    {
      settings: {
        llmBaseUrl: 'https://api.apimart.ai/v1',
        llmApiKey: 'test-key',
      },
      fetchImpl,
      pollIntervalMs: 0,
    },
  )

  assert.equal(submitted, 4)
  assert.deepEqual(requestedCounts, [1, 1, 1, 1])
  assert.equal(results.length, 4)
  assert.equal(new Set(results.map((item) => item.remoteUrl)).size, 4)
})
test('generateOpenAiCompatibleImage polls APIMart task results', async () => {
  const calls: { url: string; body?: unknown }[] = []
  const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
    const urlText = String(url)
    const body =
      typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
    calls.push({ url: urlText, body })

    if (urlText.endsWith('/images/generations')) {
      return Response.json({
        code: 200,
        data: [{ status: 'submitted', task_id: 'task_123' }],
      })
    }

    if (urlText.includes('/tasks/task_123')) {
      return Response.json({
        code: 200,
        data: {
          id: 'task_123',
          status: 'completed',
          result: {
            images: [
              {
                url: ['https://upload.apimart.ai/f/image/result.png'],
              },
            ],
          },
        },
      })
    }

    return Response.json({ message: 'unexpected url' }, { status: 404 })
  }

  const results = await generateOpenAiCompatibleImage(
    {
      flowId: 'local',
      nodeId: 'image-1',
      mediaType: 'image',
      prompt: 'city skyline',
      model: 'gpt-image-2-official',
      width: 1536,
      height: 864,
      count: 1,
    },
    {
      settings: {
        llmBaseUrl: 'https://api.apimart.ai/v1',
        llmApiKey: 'test-key',
      },
      fetchImpl,
      pollIntervalMs: 0,
    },
  )

  assert.deepEqual(results, [
    { remoteUrl: 'https://upload.apimart.ai/f/image/result.png' },
  ])
  assert.equal(calls.length, 2)
  assert.equal(calls[1].url, 'https://api.apimart.ai/v1/tasks/task_123?language=en')
})

test('generateOpenAiCompatibleImage waits for completed task before using image urls', async () => {
  let pollCount = 0
  const fetchImpl = async (url: string | URL | Request) => {
    const urlText = String(url)
    if (urlText.endsWith('/images/generations')) {
      return Response.json({
        code: 200,
        data: [{ status: 'submitted', task_id: 'task_pending_url' }],
      })
    }

    pollCount++
    return Response.json({
      code: 200,
      data: {
        status: pollCount === 1 ? 'processing' : 'completed',
        result: {
          images: [
            {
              url: [
                pollCount === 1
                  ? 'https://upload.apimart.ai/f/image/not-ready.png'
                  : 'https://upload.apimart.ai/f/image/ready.png',
              ],
            },
          ],
        },
      },
    })
  }

  const results = await generateOpenAiCompatibleImage(
    {
      flowId: 'local',
      nodeId: 'image-wait',
      mediaType: 'image',
      prompt: 'wait until ready',
      model: 'gemini-3-pro-image-preview',
      width: 1536,
      height: 864,
      count: 1,
    },
    {
      settings: {
        llmBaseUrl: 'https://api.apimart.ai/v1',
        llmApiKey: 'test-key',
      },
      fetchImpl,
      pollIntervalMs: 0,
    },
  )

  assert.equal(pollCount, 2)
  assert.deepEqual(results, [
    { remoteUrl: 'https://upload.apimart.ai/f/image/ready.png' },
  ])
})

test('generateOpenAiCompatibleImage sends APIMart reference images as image_urls', async () => {
  const calls: { url: string; body?: unknown }[] = []
  const referenceImage =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ'
  const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
    const body =
      typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
    calls.push({ url: String(url), body })

    return Response.json({
      data: [{ url: 'https://upload.apimart.ai/f/image/edited.png' }],
    })
  }

  const results = await generateOpenAiCompatibleImage(
    {
      flowId: 'local',
      nodeId: 'image-1',
      mediaType: 'image',
      prompt: 'make it cinematic',
      inputImages: [referenceImage],
      model: 'gpt-image-2-official',
      width: 1536,
      height: 864,
      count: 1,
    },
    {
      settings: {
        llmBaseUrl: 'https://api.apimart.ai/v1',
        llmApiKey: 'test-key',
      },
      fetchImpl,
      pollIntervalMs: 0,
    },
  )

  assert.deepEqual(results, [
    { remoteUrl: 'https://upload.apimart.ai/f/image/edited.png' },
  ])
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, 'https://api.apimart.ai/v1/images/generations')
  assert.deepEqual(calls[0].body, {
    model: 'gpt-image-2-official',
    prompt: 'make it cinematic',
    n: 1,
    size: '16:9',
    resolution: '2k',
    image_urls: [referenceImage],
  })
})

test('generateOpenAiCompatibleImage resolves local asset file urls for APIMart references', async () => {
  const calls: { url: string; body?: unknown }[] = []
  const asset = await saveUploadFile({
    fileBuffer: Buffer.from('image-reference-frame'),
    originalName: 'reference.png',
    mimeType: 'image/png',
  })
  const assetPath = getAssetFilePath(asset)
  const metaPath = join(dirname(assetPath), `${asset.id}.json`)

  const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
    const body =
      typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
    calls.push({ url: String(url), body })
    return Response.json({
      data: [{ url: 'https://upload.apimart.ai/f/image/edited-from-asset.png' }],
    })
  }

  try {
    const results = await generateOpenAiCompatibleImage(
      {
        flowId: 'local',
        nodeId: 'image-1',
        mediaType: 'image',
        prompt: 'edit this asset',
        inputImages: [`/api/assets/${asset.id}/file`],
        model: 'gpt-image-2-official',
        width: 1536,
        height: 864,
        count: 1,
      },
      {
        settings: {
          llmBaseUrl: 'https://api.apimart.ai/v1',
          llmApiKey: 'test-key',
        },
        fetchImpl,
        pollIntervalMs: 0,
      },
    )

    assert.deepEqual(results, [
      { remoteUrl: 'https://upload.apimart.ai/f/image/edited-from-asset.png' },
    ])
    assert.equal(calls.length, 1)
    assert.deepEqual((calls[0].body as { image_urls?: string[] }).image_urls, [
      `data:image/png;base64,${Buffer.from('image-reference-frame').toString('base64')}`,
    ])
  } finally {
    await rm(assetPath, { force: true })
    await rm(metaPath, { force: true })
  }
})

test('generateOpenAiCompatibleImage posts reference images to OpenAI edits endpoint', async () => {
  const calls: { url: string; body?: BodyInit | null }[] = []
  const referenceImage =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ'
  const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), body: init?.body })
    if (!String(url).endsWith('/images/edits')) {
      return Response.json({ message: 'unexpected url' }, { status: 404 })
    }
    return Response.json({
      data: [{ b64_json: 'aGVsbG8=' }],
    })
  }

  const results = await generateOpenAiCompatibleImage(
    {
      flowId: 'local',
      nodeId: 'image-1',
      mediaType: 'image',
      prompt: 'turn it into a poster',
      inputImages: [referenceImage],
      model: 'gpt-image-1',
      width: 1024,
      height: 1024,
      count: 1,
    },
    {
      settings: {
        llmBaseUrl: 'https://api.openai.example/v1',
        llmApiKey: 'test-key',
      },
      fetchImpl,
      pollIntervalMs: 0,
    },
  )

  assert.deepEqual(results, [{ base64Data: 'aGVsbG8=', mimeType: 'image/png' }])
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, 'https://api.openai.example/v1/images/edits')
  assert.ok(calls[0].body instanceof FormData)
  const form = calls[0].body
  assert.equal(form.get('model'), 'gpt-image-1')
  assert.equal(form.get('prompt'), 'turn it into a poster')
  assert.equal(form.get('n'), '1')
  assert.equal(form.get('size'), '1024x1024')
  assert.ok(form.get('image') instanceof File)
})
