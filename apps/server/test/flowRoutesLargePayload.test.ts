import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const workspaceDir = await mkdtemp(join(tmpdir(), 'mok-flow-large-payload-'))
process.env.MOK_WORKSPACE_DIR = workspaceDir

const { default: flowsRoutes } = await import('../src/routes/flows')

after(async () => {
  await rm(workspaceDir, { recursive: true, force: true })
})

test('flow update accepts an embedded captured frame larger than the default body limit', async () => {
  const app = Fastify()
  await app.register(flowsRoutes)
  await app.ready()

  try {
    const created = await app.inject({
      method: 'POST',
      url: '/api/flows',
      payload: { name: 'embedded frame' },
    })
    assert.equal(created.statusCode, 200)
    const flowId = created.json().id as string
    const dataUrl = `data:image/jpeg;base64,${'A'.repeat(1_200_000)}`
    const response = await app.inject({
      method: 'PUT',
      url: `/api/flows/${flowId}`,
      payload: {
        nodes: [
          {
            id: 'captured-frame',
            type: 'image',
            position: { x: 0, y: 0 },
            data: {
              title: '00:09.375 帧',
              status: 'success',
              sourceOnly: true,
              localPreviewUrl: dataUrl,
              capturedFromVideoNodeId: 'video-source',
            },
          },
        ],
        edges: [],
      },
    })

    assert.equal(response.statusCode, 200, response.body)
    const captured = response.json().nodes[0].data
    assert.equal(captured.localPreviewUrl, dataUrl)
    assert.equal(captured.assetId, undefined)
    assert.equal(captured.outputAssetIds, undefined)
  } finally {
    await app.close()
  }
})