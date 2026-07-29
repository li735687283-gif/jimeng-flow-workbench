import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { Asset } from '@jimeng-flow/shared/asset'

const workspaceDir = await mkdtemp(join(tmpdir(), 'mok-video-compression-'))
process.env.MOK_WORKSPACE_DIR = workspaceDir

const { default: assetsRoutes } = await import('../src/routes/assets')
const { getAssetFilePath, saveUploadFile } = await import('../src/services/assets')
const {
  buildVideoCompressionArgs,
  compressVideoAsset,
  resolveFfmpegExecutable,
} = await import('../src/services/videoCompression')

after(async () => {
  await rm(workspaceDir, { recursive: true, force: true })
})

async function createAsset(
  originalName = 'source.mp4',
  mimeType = 'video/mp4',
): Promise<Asset> {
  return saveUploadFile({
    fileBuffer: Buffer.from('source-video'),
    originalName,
    mimeType,
  })
}

test('video compression builds a packaged FFmpeg path and safe 480P arguments', () => {
  assert.match(
    resolveFfmpegExecutable(
      { MOK_RESOURCES_DIR: 'C:\\Program Files\\MO.K\\resources' },
      'win32',
    ),
    /resources[\\/]ffmpeg[\\/]ffmpeg\.exe$/,
  )
  const args = buildVideoCompressionArgs('source.mp4', 'output.mp4', 480)
  assert.deepEqual(args.slice(0, 4), ['-hide_banner', '-loglevel', 'error', '-y'])
  assert.ok(args.includes('scale=-2:480'))
  assert.ok(args.includes('0:a?'))
  assert.ok(args.includes('aac'))
  assert.equal(args.at(-1), 'output.mp4')
})

test('video compression saves a derived video asset without buffering the result', async () => {
  const sourceAsset = await createAsset()
  const calls: Array<{ command: string; args: string[] }> = []
  const result = await compressVideoAsset(
    { sourceAsset, targetHeight: 480 },
    {
      runFfmpeg: async (command, args) => {
        calls.push({ command, args })
        await writeFile(args.at(-1)!, Buffer.from('compressed-video'))
      },
    },
  )

  assert.equal(calls.length, 1)
  assert.equal(result.type, 'video')
  assert.deepEqual(result.inputAssetIds, [sourceAsset.id])
  assert.equal(result.provider, 'local-ffmpeg')
  assert.equal(result.params?.operation, 'video_compression')
  assert.equal(result.params?.targetHeight, 480)
  await access(getAssetFilePath(result))
  assert.equal(
    (await readFile(getAssetFilePath(result))).toString(),
    'compressed-video',
  )
})

test('video compression route accepts only video assets and 480P or 360P', async () => {
  const sourceAsset = await createAsset()
  const imageAsset = await createAsset('source.png', 'image/png')
  const calls: Array<{ sourceAssetId: string; targetHeight: number }> = []
  const app = Fastify()
  await app.register(assetsRoutes, {
    compressVideo: async ({ sourceAsset, targetHeight }) => {
      calls.push({ sourceAssetId: sourceAsset.id, targetHeight })
      return saveUploadFile({
        fileBuffer: Buffer.from('compressed-video'),
        originalName: `compressed-${targetHeight}.mp4`,
        mimeType: 'video/mp4',
        inputAssetIds: [sourceAsset.id],
        provider: 'local-ffmpeg',
        params: { operation: 'video_compression', targetHeight },
      })
    },
  })
  await app.ready()

  try {
    const success = await app.inject({
      method: 'POST',
      url: `/api/assets/${sourceAsset.id}/compress-video`,
      payload: { targetHeight: 360 },
    })
    assert.equal(success.statusCode, 201, success.body)
    assert.deepEqual(calls, [
      { sourceAssetId: sourceAsset.id, targetHeight: 360 },
    ])

    const invalidTarget = await app.inject({
      method: 'POST',
      url: `/api/assets/${sourceAsset.id}/compress-video`,
      payload: { targetHeight: 720 },
    })
    assert.equal(invalidTarget.statusCode, 400)

    const invalidType = await app.inject({
      method: 'POST',
      url: `/api/assets/${imageAsset.id}/compress-video`,
      payload: { targetHeight: 480 },
    })
    assert.equal(invalidType.statusCode, 400)
    assert.match(invalidType.json().message, /只有视频资产/)
  } finally {
    await app.close()
  }
})
