import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  generateImageResultsForRequest,
} from '../src/services/generations'

test('generateImageResultsForRequest routes third-party image edits through openai-compatible provider', async () => {
  const calls: string[] = []

  const result = await generateImageResultsForRequest(
    {
      flowId: 'local',
      nodeId: 'edit-node',
      mediaType: 'image',
      prompt: 'turn this into a poster',
      inputImages: ['asset_reference'],
      model: 'gpt-image-2-official',
      width: 1536,
      height: 864,
      count: 1,
      seed: null,
    },
    {
      settings: {
        modelConfigs: [
          {
            id: 'gpt-image-2-official',
            provider: 'openai-compatible',
            capabilities: ['image'],
          },
        ],
      },
      generateImageImpl: async () => {
        throw new Error('dreamina should not be used for third-party image edit')
      },
      generateCodexCliImageImpl: async () => {
        throw new Error('codex should not be used for this model')
      },
      generateOpenAiCompatibleImageImpl: async (req) => {
        calls.push('openai-compatible')
        assert.deepEqual(req.inputImages, ['asset_reference'])
        return [{ base64Data: 'aGVsbG8=', mimeType: 'image/png' }]
      },
      saveImageGenerationResultImpl: async (imageResult) => ({
        ...imageResult,
        assetId: 'asset_saved',
        url: 'asset_saved',
      }),
    },
  )

  assert.deepEqual(calls, ['openai-compatible'])
  assert.equal(result.provider, 'openai-compatible')
  assert.equal(result.successCount, 1)
  assert.deepEqual(result.results, [
    {
      base64Data: 'aGVsbG8=',
      mimeType: 'image/png',
      assetId: 'asset_saved',
      url: 'asset_saved',
    },
  ])
})

test('generateImageResultsForRequest routes OpenAI CLI image models through codex and preserves references', async () => {
  const calls: string[] = []

  const result = await generateImageResultsForRequest(
    {
      flowId: 'flow_codex_123',
      nodeId: 'image-node',
      mediaType: 'image',
      prompt: 'quiet black and white card',
      inputImages: ['asset_reference'],
      model: 'gpt-image-2',
      width: 1536,
      height: 864,
      count: 1,
      seed: null,
    },
    {
      settings: {
        modelConfigs: [],
      },
      generateImageImpl: async () => {
        throw new Error('dreamina should not be used for OpenAI CLI image model')
      },
      generateOpenAiCompatibleImageImpl: async () => {
        throw new Error('openai-compatible should not be used for OpenAI CLI image model')
      },
      generateCodexCliImageImpl: async (req) => {
        calls.push('codex')
        assert.deepEqual(req.inputImages, ['asset_reference'])
        assert.equal(req.model, 'gpt-image-2')
        return [{ localPath: 'F:\\repo\\workspace\\outputs\\codex.png' }]
      },
      saveImageGenerationResultImpl: async (imageResult, req, provider) => {
        calls.push(`save:${provider}`)
        assert.equal(provider, 'codex')
        assert.deepEqual(req.inputImages, ['asset_reference'])
        return {
          ...imageResult,
          assetId: 'asset_codex_saved',
          url: 'asset_codex_saved',
        }
      },
    },
  )

  assert.deepEqual(calls, ['codex', 'save:codex'])
  assert.equal(result.provider, 'codex')
  assert.equal(result.successCount, 1)
  assert.deepEqual(result.results, [
    {
      localPath: 'F:\\repo\\workspace\\outputs\\codex.png',
      assetId: 'asset_codex_saved',
      url: 'asset_codex_saved',
    },
  ])
})
