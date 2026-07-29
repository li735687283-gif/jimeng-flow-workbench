import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { Asset } from '@jimeng-flow/shared/asset'
import { normalizeVideoTrimRequest } from '@jimeng-flow/shared/videoTrim'

const workspaceDir = await mkdtemp(join(tmpdir(), 'mok-video-trim-test-'))
process.env.MOK_WORKSPACE_DIR = workspaceDir

const { default: assetsRoutes } = await import('../src/routes/assets')
const { getAssetFilePath, saveUploadFile } = await import('../src/services/assets')
const { buildVideoTrimArgs, trimVideoAsset } = await import(
  '../src/services/videoTrim'
)

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

test('video trim request accepts only one-to-four-second selections', () => {
  assert.deepEqual(
    normalizeVideoTrimRequest({ startSeconds: 1.2345, durationSeconds: 3.4567 }),
    { startSeconds: 1.235, durationSeconds: 3.457 },
  )
  assert.equal(
    normalizeVideoTrimRequest({ startSeconds: -1, durationSeconds: 2 }),
    null,
  )
  assert.equal(
    normalizeVideoTrimRequest({ startSeconds: 0, durationSeconds: 0.9 }),
    null,
  )
  assert.equal(
    normalizeVideoTrimRequest({ startSeconds: 0, durationSeconds: 4.1 }),
    null,
  )
})

test('video trim builds frame-accurate H.264 arguments without resizing', () => {
  const args = buildVideoTrimArgs('source.mp4', 'output.mp4', {
    startSeconds: 2.5,
    durationSeconds: 3.2,
  })
  assert.deepEqual(args.slice(0, 6), [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-i',
    'source.mp4',
  ])
  assert.equal(args[args.indexOf('-ss') + 1], '2.500')
  assert.equal(args[args.indexOf('-t') + 1], '3.200')
  assert.ok(args.includes('0:a?'))
  assert.ok(args.includes('libx264'))
  assert.ok(args.includes('aac'))
  assert.equal(args.includes('-vf'), false)
  assert.equal(args.at(-1), 'output.mp4')
})

test('video trim saves a derived asset without buffering the result', async () => {
  const sourceAsset = await createAsset()
  const result = await trimVideoAsset(
    {
      sourceAsset,
      trim: { startSeconds: 1.2, durationSeconds: 3.4 },
    },
    {
      runFfmpeg: async (_command, args) => {
        await writeFile(args.at(-1)!, Buffer.from('trimmed-video'))
      },
    },
  )

  assert.equal(result.type, 'video')
  assert.deepEqual(result.inputAssetIds, [sourceAsset.id])
  assert.equal(result.provider, 'local-ffmpeg')
  assert.equal(result.params?.operation, 'video_trim')
  assert.equal(result.params?.startSeconds, 1.2)
  assert.equal(result.params?.durationSeconds, 3.4)
  await access(getAssetFilePath(result))
  assert.equal(
    (await readFile(getAssetFilePath(result))).toString(),
    'trimmed-video',
  )
})

test('video trim route rejects invalid durations and non-video assets', async () => {
  const sourceAsset = await createAsset()
  const imageAsset = await createAsset('source.png', 'image/png')
  const calls: Array<{ sourceAssetId: string; start: number; duration: number }> = []
  const app = Fastify()
  await app.register(assetsRoutes, {
    trimVideo: async ({ sourceAsset, trim }) => {
      calls.push({
        sourceAssetId: sourceAsset.id,
        start: trim.startSeconds,
        duration: trim.durationSeconds,
      })
      return saveUploadFile({
        fileBuffer: Buffer.from('trimmed-video'),
        originalName: 'trimmed.mp4',
        mimeType: 'video/mp4',
        inputAssetIds: [sourceAsset.id],
        provider: 'local-ffmpeg',
        params: { operation: 'video_trim', ...trim },
      })
    },
  })
  await app.ready()

  try {
    const success = await app.inject({
      method: 'POST',
      url: `/api/assets/${sourceAsset.id}/trim-video`,
      payload: { startSeconds: 2, durationSeconds: 4 },
    })
    assert.equal(success.statusCode, 201, success.body)
    assert.deepEqual(calls, [
      { sourceAssetId: sourceAsset.id, start: 2, duration: 4 },
    ])

    for (const durationSeconds of [0.9, 4.1]) {
      const invalid = await app.inject({
        method: 'POST',
        url: `/api/assets/${sourceAsset.id}/trim-video`,
        payload: { startSeconds: 0, durationSeconds },
      })
      assert.equal(invalid.statusCode, 400)
    }

    const invalidType = await app.inject({
      method: 'POST',
      url: `/api/assets/${imageAsset.id}/trim-video`,
      payload: { startSeconds: 0, durationSeconds: 2 },
    })
    assert.equal(invalidType.statusCode, 400)
    assert.match(invalidType.json().message, /只有视频资产/)
  } finally {
    await app.close()
  }
})
