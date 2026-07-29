// 高清路由引擎分发测试：engine 缺省 dreamina（向后兼容）、
// nanobanana-pro 分发、非法 engine 400。引擎调用通过路由 deps 注入替换。

import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Jimp } from 'jimp'

const workspaceDir = await mkdtemp(join(tmpdir(), 'mok-upscale-route-'))
process.env.MOK_WORKSPACE_DIR = workspaceDir

const { default: assetsRoutes } = await import('../src/routes/assets')
const { saveUploadFile } = await import('../src/services/assets')

after(async () => {
  await rm(workspaceDir, { recursive: true, force: true })
})

async function createImageAsset(): Promise<string> {
  const image = new Jimp({ width: 20, height: 10, color: 0xff3366ff })
  const buffer = await image.getBuffer('image/png')
  const asset = await saveUploadFile({
    fileBuffer: buffer,
    originalName: 'source.png',
    mimeType: 'image/png',
  })
  return asset.id
}

/** 假引擎产出的真实 PNG（saveUpscaleResult 要读盘） */
async function createFakeResult(): Promise<{ localPath: string }> {
  const dir = await mkdtemp(join(tmpdir(), 'mok-upscale-fake-result-'))
  const path = join(dir, 'result.png')
  const image = new Jimp({ width: 40, height: 20, color: 0xff3366ff })
  await image.write(path)
  return { localPath: path }
}

function createFakeEngine(calls: string[]) {
  return async (params: { inputImage: string }) => {
    calls.push(params.inputImage)
    return [await createFakeResult()]
  }
}

async function createTestApp(calls: { dreamina: string[]; nanobanana: string[] }) {
  const app = Fastify()
  await app.register(assetsRoutes, {
    upscaleDreamina: createFakeEngine(calls.dreamina),
    upscaleNanoBananaPro: createFakeEngine(calls.nanobanana),
  })
  await app.ready()
  return app
}

test('upscale 缺省 engine 走 dreamina（向后兼容）', async () => {
  const assetId = await createImageAsset()
  const calls = { dreamina: [] as string[], nanobanana: [] as string[] }
  const app = await createTestApp(calls)
  try {
    const response = await app.inject({
      method: 'POST',
      url: `/api/assets/${assetId}/upscale`,
      payload: { resolutionType: '2k' },
    })
    assert.equal(response.statusCode, 201, response.body)
    assert.deepEqual(calls.dreamina, [assetId])
    assert.deepEqual(calls.nanobanana, [])
    assert.equal(response.json().provider, 'dreamina')
    assert.equal(response.json().params.operation, 'image_upscale')
  } finally {
    await app.close()
  }
})

test('upscale engine=nanobanana-pro 分发到 Nano Banana Pro 并记录 provider', async () => {
  const assetId = await createImageAsset()
  const calls = { dreamina: [] as string[], nanobanana: [] as string[] }
  const app = await createTestApp(calls)
  try {
    const response = await app.inject({
      method: 'POST',
      url: `/api/assets/${assetId}/upscale`,
      payload: { resolutionType: '4k', engine: 'nanobanana-pro' },
    })
    assert.equal(response.statusCode, 201, response.body)
    assert.deepEqual(calls.nanobanana, [assetId])
    assert.deepEqual(calls.dreamina, [])
    assert.equal(response.json().provider, 'nanobanana-pro')
    assert.equal(response.json().params.operation, 'image_upscale')
    assert.equal(response.json().params.resolutionType, '4k')
  } finally {
    await app.close()
  }
})

test('upscale 非法 engine 返回 400 且不调用任何引擎', async () => {
  const assetId = await createImageAsset()
  const calls = { dreamina: [] as string[], nanobanana: [] as string[] }
  const app = await createTestApp(calls)
  try {
    const response = await app.inject({
      method: 'POST',
      url: `/api/assets/${assetId}/upscale`,
      payload: { resolutionType: '2k', engine: 'bogus' },
    })
    assert.equal(response.statusCode, 400, response.body)
    assert.match(response.json().message, /dreamina|nanobanana-pro/)
    assert.deepEqual(calls.dreamina, [])
    assert.deepEqual(calls.nanobanana, [])
  } finally {
    await app.close()
  }
})

test('upscale 引擎抛错时按错误 statusCode 映射响应', async () => {
  const assetId = await createImageAsset()
  const { NanoBananaUpscaleError } = await import('../src/services/nanoBananaUpscale')
  const app = Fastify()
  await app.register(assetsRoutes, {
    upscaleDreamina: createFakeEngine([]),
    upscaleNanoBananaPro: async () => {
      throw new NanoBananaUpscaleError(
        'UNSUPPORTED_RESOLUTION',
        'Nano Banana Pro 高清仅支持 2K 或 4K',
        400,
      )
    },
  })
  await app.ready()
  try {
    const response = await app.inject({
      method: 'POST',
      url: `/api/assets/${assetId}/upscale`,
      payload: { engine: 'nanobanana-pro', resolutionType: '8k' },
    })
    assert.equal(response.statusCode, 400, response.body)
    assert.equal(response.json().code, 'UNSUPPORTED_RESOLUTION')
    assert.match(response.json().message, /2K 或 4K/)
  } finally {
    await app.close()
  }
})
