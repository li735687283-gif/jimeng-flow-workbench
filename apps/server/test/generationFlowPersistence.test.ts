import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Fastify, { type FastifyInstance } from 'fastify'
import type {
  GenerationRequest,
  GenerationResponse,
} from '@jimeng-flow/shared/generateNode'
import type { VideoGenerationRequest } from '@jimeng-flow/shared/videoNode'

const workspaceDir = await mkdtemp(join(tmpdir(), 'mok-generation-flow-'))
process.env.MOK_WORKSPACE_DIR = workspaceDir

const flows = await import('../src/services/flows')
const generations = await import('../src/services/generations')
const { default: generationsRoutes } = await import('../src/routes/generations')

let app: FastifyInstance

before(async () => {
  app = Fastify({ logger: false })
  await app.register(generationsRoutes)
  await app.ready()
})

after(async () => {
  await app.close()
  await rm(workspaceDir, { recursive: true, force: true })
})

// 生成在后台真实执行（测试环境必然以 error 收尾），轮询预算要给足：
// 全量套件并发执行时单次执行可能超过 1.6s，100 次曾反复偶发超时。
const TERMINAL_POLL_ATTEMPTS = 600

async function waitForTerminalGeneration(id: string): Promise<void> {
  for (let attempt = 0; attempt < TERMINAL_POLL_ATTEMPTS; attempt++) {
    const generation = await generations.getGeneration(id)
    if (generation?.status === 'success' || generation?.status === 'error') {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error(`生成任务未按预期结束：${id}`)
}

async function waitForTerminalFlowNode(
  flowId: string,
  nodeId: string,
): Promise<void> {
  for (let attempt = 0; attempt < TERMINAL_POLL_ATTEMPTS; attempt++) {
    const flow = await flows.getFlow(flowId)
    const status = flow.nodes.find((item) => item.id === nodeId)?.data.status
    if (status === 'success' || status === 'error') return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error(`flow 节点未按预期结束：${flowId}/${nodeId}`)
}

test('createGeneration persists an image generation id before background execution starts', async () => {
  const flow = await flows.createFlow('queued image')
  await flows.updateFlow(flow.id, {
    nodes: [
      {
        id: 'image-queued',
        type: 'image',
        position: { x: 0, y: 0 },
        data: { title: '图片节点', status: 'running' },
      },
    ],
  })
  const request: GenerationRequest = {
    flowId: flow.id,
    nodeId: 'image-queued',
    mediaType: 'image',
    prompt: 'queued image prompt',
    model: 'test-openai-image-model',
    width: 1024,
    height: 1024,
    count: 1,
    seed: null,
  }

  const response = await generations.createGeneration(request)
  const saved = await flows.getFlow(flow.id)
  const node = saved.nodes.find((item) => item.id === request.nodeId)

  assert.equal(response.status, 'queued')
  assert.equal(node?.data.generationId, response.id)
  assert.equal(node?.data.status, 'queued')
  assert.equal(
    (node?.data.generationRuns as Array<{ generationId: string }> | undefined)?.[0]
      ?.generationId,
    response.id,
  )

  await waitForTerminalGeneration(response.id)
  await waitForTerminalFlowNode(flow.id, request.nodeId)
})

test('createGeneration persists a video generation id before background execution starts', async () => {
  const flow = await flows.createFlow('queued video')
  await flows.updateFlow(flow.id, {
    nodes: [
      {
        id: 'video-queued',
        type: 'video',
        position: { x: 0, y: 0 },
        data: { title: '视频节点', status: 'running' },
      },
    ],
  })
  const request: VideoGenerationRequest = {
    flowId: flow.id,
    nodeId: 'video-queued',
    mediaType: 'video',
    mode: 'text_to_video',
    prompt: 'queued video prompt',
    inputImages: [],
    model: 'test-openai-video-model',
    aspectRatio: '16:9',
    resolution: '720P',
    quality: 'standard',
    durationSeconds: 5,
    count: 1,
    generateAudio: false,
  }

  const response = await generations.createGeneration(request)
  const saved = await flows.getFlow(flow.id)
  const node = saved.nodes.find((item) => item.id === request.nodeId)

  assert.equal(response.status, 'queued')
  assert.equal(node?.data.generationId, response.id)
  assert.equal(node?.data.status, 'queued')
  assert.equal(
    (node?.data.generationRuns as Array<{ generationId: string }> | undefined)?.[0]
      ?.generationId,
    response.id,
  )

  await waitForTerminalGeneration(response.id)
  await waitForTerminalFlowNode(flow.id, request.nodeId)
})

test('concurrent image and video queue persistence preserves both node generation ids', async () => {
  const flow = await flows.createFlow('concurrent queued generations')
  await flows.updateFlow(flow.id, {
    nodes: [
      {
        id: 'image-concurrent',
        type: 'image',
        position: { x: 0, y: 0 },
        data: { title: '并发图片节点', status: 'running' },
      },
      {
        id: 'video-concurrent',
        type: 'video',
        position: { x: 300, y: 0 },
        data: { title: '并发视频节点', status: 'running' },
      },
    ],
  })
  const imageRequest: GenerationRequest = {
    flowId: flow.id,
    nodeId: 'image-concurrent',
    mediaType: 'image',
    prompt: 'concurrent image prompt',
    model: 'test-openai-image-model',
    width: 1024,
    height: 1024,
    count: 1,
    seed: null,
  }
  const videoRequest: VideoGenerationRequest = {
    flowId: flow.id,
    nodeId: 'video-concurrent',
    mediaType: 'video',
    mode: 'text_to_video',
    prompt: 'concurrent video prompt',
    inputImages: [],
    model: 'test-openai-video-model',
    aspectRatio: '16:9',
    resolution: '720P',
    quality: 'standard',
    durationSeconds: 5,
    count: 1,
    generateAudio: false,
  }

  const [imageResponse, videoResponse] = await Promise.all([
    generations.createGeneration(imageRequest),
    generations.createGeneration(videoRequest),
  ])
  const saved = await flows.getFlow(flow.id)
  const imageNode = saved.nodes.find((item) => item.id === imageRequest.nodeId)
  const videoNode = saved.nodes.find((item) => item.id === videoRequest.nodeId)

  assert.equal(imageNode?.data.generationId, imageResponse.id)
  assert.equal(videoNode?.data.generationId, videoResponse.id)
  assert.ok(['queued', 'running'].includes(String(imageNode?.data.status)))
  assert.ok(['queued', 'running'].includes(String(videoNode?.data.status)))

  await Promise.all([
    waitForTerminalGeneration(imageResponse.id),
    waitForTerminalGeneration(videoResponse.id),
  ])
  await Promise.all([
    waitForTerminalFlowNode(flow.id, imageRequest.nodeId),
    waitForTerminalFlowNode(flow.id, videoRequest.nodeId),
  ])
})
test('persistImageGenerationResponseToFlow writes a successful synchronous edit to its source flow', async () => {
  const flow = await flows.createFlow('successful edit')
  const request: GenerationRequest = {
    flowId: flow.id,
    nodeId: 'image-edit-success',
    mediaType: 'image',
    prompt: 'modify image',
    inputImages: ['asset_source'],
    model: 'test-edit-model',
    width: 1024,
    height: 1024,
    count: 1,
    seed: null,
  }
  const now = new Date().toISOString()
  const response: GenerationResponse = {
    id: 'edit_success',
    nodeId: request.nodeId,
    status: 'success',
    results: [{ assetId: 'asset_edited' }],
    createdAt: now,
    finishedAt: now,
  }

  const persist = (
    generations as typeof generations & {
      persistImageGenerationResponseToFlow?: (
        request: GenerationRequest,
        response: GenerationResponse,
      ) => Promise<void>
    }
  ).persistImageGenerationResponseToFlow
  assert.equal(typeof persist, 'function')
  await persist?.(request, response)

  const saved = await flows.getFlow(flow.id)
  const node = saved.nodes.find((item) => item.id === request.nodeId)
  assert.equal(node?.data.generationId, response.id)
  assert.equal(node?.data.status, 'success')
  assert.equal(node?.data.assetId, 'asset_edited')
})

test('POST /api/generations/edit persists a synchronous edit failure to its source flow', async () => {
  const flow = await flows.createFlow('failed edit')
  await flows.updateFlow(flow.id, {
    nodes: [
      {
        id: 'image-edit-error',
        type: 'image',
        position: { x: 0, y: 0 },
        data: { title: '编辑节点', status: 'queued' },
      },
    ],
  })

  const response = await app.inject({
    method: 'POST',
    url: '/api/generations/edit',
    payload: {
      flowId: flow.id,
      nodeId: 'image-edit-error',
      inputImage: 'asset_missing',
      editType: 'modify',
      prompt: 'modify image',
      model: 'test-openai-image-model',
      width: 1024,
      height: 1024,
    },
  })

  assert.equal(response.statusCode, 500)
  const payload = response.json() as { message: string }
  const saved = await flows.getFlow(flow.id)
  const node = saved.nodes.find((item) => item.id === 'image-edit-error')
  assert.equal(node?.data.status, 'error')
  assert.match(String(node?.data.generationId), /^edit_/)
  assert.equal(node?.data.error, payload.message)
})
