import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  NANO_BANANA_PRO_MODEL,
  NanoBananaUpscaleError,
  getNanoBananaTargetSize,
  upscaleWithNanoBananaPro,
} from '../src/services/nanoBananaUpscale'

test('Nano Banana Pro 高清按原图比例计算 2K/4K 目标尺寸', () => {
  assert.deepEqual(getNanoBananaTargetSize(1920, 1080, '2k'), {
    width: 2048,
    height: 1152,
  })
  assert.deepEqual(getNanoBananaTargetSize(1080, 1920, '4k'), {
    width: 2304,
    height: 4096,
  })
})

test('Nano Banana Pro 高清使用 APIMart 当前模型与单张参考图', async () => {
  const requests: unknown[] = []
  const results = await upscaleWithNanoBananaPro(
    {
      inputImage: 'asset_source',
      resolutionType: '4k',
      flowId: 'flow-1',
    },
    {
      readImageSizeImpl: async () => ({ width: 1920, height: 1080 }),
      generateImageImpl: async (request) => {
        requests.push(request)
        return [{ remoteUrl: 'https://example.com/upscaled.png' }]
      },
    },
  )

  assert.deepEqual(results, [
    { remoteUrl: 'https://example.com/upscaled.png' },
  ])
  assert.deepEqual(requests, [
    {
      flowId: 'flow-1',
      nodeId: 'upscale-asset_source',
      mediaType: 'image',
      prompt:
        'Upscale this image to high resolution. Preserve the original composition, subjects, text, colors, lighting, and style exactly. Improve only clarity, fine detail, edge definition, and texture. Do not add, remove, replace, crop, or rearrange anything.',
      inputImages: ['asset_source'],
      model: NANO_BANANA_PRO_MODEL,
      width: 4096,
      height: 2304,
      count: 1,
    },
  ])
})

test('Nano Banana Pro 高清拒绝 8K 和无效源图尺寸', async () => {
  await assert.rejects(
    upscaleWithNanoBananaPro(
      { inputImage: 'asset_source', resolutionType: '8k' },
      {
        readImageSizeImpl: async () => ({ width: 1920, height: 1080 }),
        generateImageImpl: async () => [],
      },
    ),
    (error: unknown) =>
      error instanceof NanoBananaUpscaleError &&
      error.code === 'UNSUPPORTED_RESOLUTION' &&
      error.statusCode === 400,
  )

  await assert.rejects(
    upscaleWithNanoBananaPro(
      { inputImage: 'asset_source', resolutionType: '2k' },
      {
        readImageSizeImpl: async () => ({ width: 0, height: 0 }),
        generateImageImpl: async () => [],
      },
    ),
    (error: unknown) =>
      error instanceof NanoBananaUpscaleError &&
      error.code === 'INVALID_INPUT' &&
      error.statusCode === 400,
  )
})