import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  extractOpenAiImageResults,
  generateOpenAiCompatibleImage,
  getOpenAiCompatibleImagePayload,
  getOpenAiCompatibleImageSize,
} from '../src/services/openaiImage'

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
    n: 4,
    size: '16:9',
    resolution: '2k',
  })
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
