import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  AGENT_DEFAULT_IMAGE_ASPECT_RATIO,
  buildAgentImageCompletionPatch,
  buildAgentVideoReferences,
  closestAgentImageAspectRatio,
  createOwnedAgentGenerationCallbacks,
  getAgentToolInputImageNodes,
  getAgentVideoUpstreamImageNodeIds,
  pickAgentConfiguredModel,
  resolveAgentImageParams,
  resolveAgentVideoMode,
  selectAgentVideoTargetNodeId,
  summarizeCanvasNodes,
} from '../src/utils/agentTools'

const call = (args: Record<string, unknown>) => ({
  id: 'a1',
  tool: 'generate_image' as const,
  label: '生成图片',
  args,
})

test('image params default to 16:9 instead of 1:1', () => {
  assert.equal(AGENT_DEFAULT_IMAGE_ASPECT_RATIO, '16:9')

  const params = resolveAgentImageParams(call({ prompt: '猫' }), 'jimeng-5.0')
  assert.equal(params.aspectRatio, '16:9')
  assert.equal(params.resolution, '2K')
  assert.equal(params.count, 1)

  const invalid = resolveAgentImageParams(
    call({ prompt: '猫', aspectRatio: '7:3', resolution: '8K' }),
    'gpt-image-1',
  )
  assert.equal(invalid.aspectRatio, '16:9')
  assert.equal(invalid.resolution, '1K')
})

test('image params keep valid model-specified ratio and resolution', () => {
  const params = resolveAgentImageParams(
    call({ prompt: '猫', aspectRatio: '9:16', resolution: '4k', count: 4 }),
    'jimeng-5.0-pro',
  )
  assert.deepEqual(params, { aspectRatio: '9:16', resolution: '4K', count: 4 })
})

test('closestAgentImageAspectRatio derives ratio from pixel dimensions', () => {
  assert.equal(closestAgentImageAspectRatio(2048, 1152), '16:9')
  assert.equal(closestAgentImageAspectRatio(1152, 2048), '9:16')
  assert.equal(closestAgentImageAspectRatio(1024, 1024), '1:1')
  assert.equal(closestAgentImageAspectRatio(undefined, 100), null)
  assert.equal(closestAgentImageAspectRatio(0, 100), null)
})

const imageNode = (id: string, assetId?: string) => ({
  id,
  type: 'image',
  data: assetId ? { assetId, title: `图 ${id}` } : { title: `图 ${id}` },
})

test('getAgentToolInputImageNodes keeps only image nodes that have an asset', () => {
  const nodes = [
    imageNode('n1', 'asset_1'),
    imageNode('n2'),
    { id: 'n3', type: 'video', data: { assetIds: ['asset_v'] } },
    imageNode('n4', 'asset_1'),
    imageNode('n5', 'asset_5'),
  ]

  const result = getAgentToolInputImageNodes({
    referenceNodeIds: ['n1', 'n2', 'n3', 'n4', 'n5', 'missing'],
    nodes,
  })

  assert.deepEqual(result.nodes.map((node) => node.id), ['n1', 'n5'])
  assert.deepEqual(result.assetIds, ['asset_1', 'asset_5'])
})

test('getAgentVideoUpstreamImageNodeIds returns image sources connected to the video node', () => {
  // 重新生成已有视频时,没显式给参考图就沿用这些上游图片(保持图生视频)
  const edges = [
    { source: 'image-1', target: 'video-1' },
    { source: 'image-2', target: 'video-1' },
    { source: 'image-3', target: 'video-2' },
  ]

  assert.deepEqual(getAgentVideoUpstreamImageNodeIds('video-1', edges), ['image-1', 'image-2'])
  assert.deepEqual(getAgentVideoUpstreamImageNodeIds('video-2', edges), ['image-3'])
  assert.deepEqual(getAgentVideoUpstreamImageNodeIds('video-3', edges), [])
})

test('selectAgentVideoTargetNodeId returns the first referenced video node', () => {
  const nodes = [
    imageNode('n1', 'asset_1'),
    { id: 'v1', type: 'video', data: {} },
    { id: 'v2', type: 'video', data: {} },
  ]

  assert.equal(selectAgentVideoTargetNodeId(['n1', 'v1', 'v2'], nodes), 'v1')
  assert.equal(selectAgentVideoTargetNodeId(['n1'], nodes), null)
})

test('resolveAgentVideoMode falls back by available input images', () => {
  assert.equal(resolveAgentVideoMode('image_to_video', []), 'text_to_video')
  assert.equal(resolveAgentVideoMode('first_last_frame', ['a']), 'image_to_video')
  assert.equal(resolveAgentVideoMode('first_last_frame', ['a', 'b']), 'first_last_frame')
  assert.equal(resolveAgentVideoMode('text_to_video', ['a']), 'image_to_video')
})

test('buildAgentVideoReferences matches the resolved mode', () => {
  const single = buildAgentVideoReferences('text_to_video', ['asset_a'])
  assert.equal(single.length, 1)
  assert.equal(single[0]?.assetId, 'asset_a')

  const pair = buildAgentVideoReferences('first_last_frame', ['asset_a', 'asset_b'])
  assert.equal(pair.length, 2)

  const none = buildAgentVideoReferences('image_to_video', [])
  assert.equal(none.length, 0)
})

test('pickAgentConfiguredModel only accepts models from the configured list', () => {
  const configured = ['jimeng-5.0', 'gpt-image-1']

  // 配置列表里的模型被采纳
  assert.equal(
    pickAgentConfiguredModel('gpt-image-1', configured, 'jimeng-5.0'),
    'gpt-image-1',
  )
  // 未配置的模型(包括视频模型混入)一律回退默认
  assert.equal(
    pickAgentConfiguredModel('seedance-2.0', configured, 'jimeng-5.0'),
    'jimeng-5.0',
  )
  assert.equal(pickAgentConfiguredModel('', configured, 'jimeng-5.0'), 'jimeng-5.0')
  assert.equal(pickAgentConfiguredModel(undefined, configured, 'jimeng-5.0'), 'jimeng-5.0')
  assert.equal(pickAgentConfiguredModel(42, configured, 'jimeng-5.0'), 'jimeng-5.0')
})

test('summarizeCanvasNodes truncates prompts and caps the list', () => {

  const nodes = [
    {
      id: 'n1',
      type: 'image',
      data: { title: '海报', prompt: '猫'.repeat(500), status: 'success' },
    },
    { id: 'n2', type: 'text', data: {} },
  ]

  const summary = summarizeCanvasNodes(nodes)
  assert.equal(summary.length, 2)
  assert.equal(summary[0]?.title, '海报')
  assert.equal(summary[0]?.prompt?.length, 200)
  assert.equal(summary[0]?.status, 'success')
  assert.equal(summary[1]?.prompt, undefined)

  const many = Array.from({ length: 60 }, (_, index) => ({
    id: `n${index}`,
    type: 'image',
    data: {},
  }))
  assert.equal(summarizeCanvasNodes(many).length, 40)
})

test('agent image completion preserves and appends generation history', () => {
  const patch = buildAgentImageCompletionPatch(
    {
      id: 'gen-new',
      nodeId: 'image-1',
      status: 'success',
      results: [{ assetId: 'asset-new' }],
      createdAt: '2026-07-28T10:00:00.000Z',
      finishedAt: '2026-07-28T10:01:00.000Z',
    },
    {
      flowId: 'flow-a',
      nodeId: 'image-1',
      mediaType: 'image',
      prompt: 'new prompt',
      inputImages: [],
      model: 'jimeng-5.0',
      width: 2048,
      height: 1152,
      count: 1,
      seed: null,
    },
    [{
      id: 'gen-old',
      generationId: 'gen-old',
      status: 'success',
      assetIds: ['asset-old'],
      prompt: 'old prompt',
      model: 'jimeng-5.0',
      width: 2048,
      height: 1152,
      count: 1,
      seed: null,
      inputImageAssetIds: [],
      createdAt: '2026-07-27T10:00:00.000Z',
    }],
    {
      ratio: '16:9',
      resolution: '2K',
      inputImageAssetIds: [],
      updatedAt: '2026-07-28T10:01:01.000Z',
    },
  )

  assert.deepEqual(patch.generationRuns.map((run) => run.generationId), [
    'gen-old',
    'gen-new',
  ])
  assert.deepEqual(patch.outputAssetIds, ['asset-new'])
  assert.equal(patch.assetId, 'asset-new')
})

test('agent generation callbacks stop mutating state after project switch', () => {
  let activeFlowId: string | null = 'flow-a'
  const events: string[] = []
  const callbacks = createOwnedAgentGenerationCallbacks(
    'flow-a',
    {
      onUpdate: (data) => events.push(`update:${data.status}`),
      onComplete: (data) => events.push(`complete:${data.status}`),
      onError: (error) => events.push(`error:${error}`),
    },
    () => activeFlowId,
  )
  const response = {
    id: 'gen-agent-1',
    nodeId: 'image-1',
    status: 'running' as const,
    createdAt: '2026-07-28T10:00:00.000Z',
  }

  callbacks.onUpdate?.(response)
  activeFlowId = 'flow-b'
  callbacks.onUpdate?.({ ...response, status: 'success' })
  callbacks.onComplete?.({ ...response, status: 'success' })
  callbacks.onError?.('SSE 连接错误')

  assert.deepEqual(events, ['update:running'])
})

test('agent generation settlement callbacks survive a project switch', () => {
  let activeFlowId: string | null = 'flow-a'
  const canvasEvents: string[] = []
  const settlementEvents: string[] = []
  const callbacks = createOwnedAgentGenerationCallbacks(
    'flow-a',
    {
      onComplete: () => canvasEvents.push('complete'),
      onError: () => canvasEvents.push('error'),
    },
    () => activeFlowId,
    {
      onComplete: () => settlementEvents.push('complete'),
      onError: () => settlementEvents.push('error'),
    },
  )
  const response = {
    id: 'gen-agent-settlement',
    nodeId: 'image-1',
    status: 'success' as const,
    createdAt: '2026-07-28T10:00:00.000Z',
  }

  activeFlowId = 'flow-b'
  callbacks.onComplete?.(response)
  callbacks.onError?.('连接失败')

  assert.deepEqual(canvasEvents, [])
  assert.deepEqual(settlementEvents, ['complete', 'error'])
})

test('agent-created generations notify their originating chat when they fail', () => {
  // 提交成功但后台跑挂时,不能只在画布节点上留个红点——用户会以为迟早出图。
  // 图片和视频两条路径都定向写回发起时的项目与会话，不能串到当前会话。
  const source = readFileSync('apps/web/src/utils/agentTools.ts', 'utf8')
  assert.match(source, /function notifyAgentGenerationFailure\(/)
  assert.match(source, /刚才提交的\$\{mediaLabel\}生成失败了/)
  assert.match(source, /addMessageToConversation\(\s*owner\.projectId,\s*owner\.conversationId,/)
  assert.match(source, /setConversationContextFor\(/)
  // 完成回调里的 error 状态和 SSE onError 都要覆盖(图片 + 视频)
  assert.equal((source.match(/data\.status === 'error'/g) ?? []).length >= 2, true)
  assert.equal((source.match(/notifyAgentGenerationFailure\(/g) ?? []).length >= 5, true)
})

test('tool results carry a user-facing displaySummary free of internal ids', () => {
  // summary 是给模型看的工作日志(带节点 id / 任务号);面板必须展示
  // displaySummary,不能把内部编号糊到用户脸上。
  const source = readFileSync('apps/web/src/utils/agentTools.ts', 'utf8')
  const panel = readFileSync('apps/web/src/components/AgentPanel.tsx', 'utf8')
  // 四类工具的成功结果都要提供用户友好文案
  assert.match(source, /已创建图片节点并提交生成（\$\{count\} 张 \$\{aspectRatio\}）/)
  assert.match(source, /已创建视频节点并提交生成，完成后视频会自动出现在画布上。/)
  assert.match(source, /图片编辑完成，生成了 \$\{outputAssetIds\.length\} 张结果图。/)
  assert.match(source, /已读取画布内容。/)
  // 面板渲染优先 displaySummary
  assert.match(panel, /result\.displaySummary \?\? result\.summary/)
})

test('Agent generation creation persists the task identity on the active canvas node', () => {
  const source = readFileSync('apps/web/src/utils/agentTools.ts', 'utf8')
  assert.match(source, /function persistActiveAgentGenerationIdentity\(/)
  assert.match(source, /generationId: response\.id/)
  assert.match(source, /void useFlowStore\.getState\(\)\.saveCurrent\(\)\.catch/)
  assert.equal(
    (source.match(/persistActiveAgentGenerationIdentity\(/g) ?? []).length,
    3,
  )
})
