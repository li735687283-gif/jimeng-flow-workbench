// Agent 工具执行器：把模型返回的工具调用转换为画布操作。
// generate_image / generate_video / edit_image 会创建节点并提交生成任务，
// 生成进度通过 SSE 在后台持续更新节点；read_canvas 只读取画布信息。

import type {
  AgentCanvasNodeSummary,
  AgentToolCall,
  AgentToolResult,
} from '@jimeng-flow/shared/agentMessage'
import {
  IMAGE_COUNTS,
  type GenerationRequest,
  type GenerationResult,
} from '@jimeng-flow/shared/generateNode'
import {
  VIDEO_ASPECT_RATIOS,
  VIDEO_COUNTS,
  VIDEO_DURATIONS,
  VIDEO_MODES,
  VIDEO_RESOLUTIONS,
  buildVideoReferencesFromInputImages,
  type VideoAspectRatio,
  type VideoGenerationRequest,
  type VideoMediaReference,
  type VideoMode,
  type VideoNodeData,
  type VideoResolution,
} from '@jimeng-flow/shared/videoNode'
import {
  createEditGeneration,
  createGeneration,
  subscribeGeneration,
} from '../api/generations'
import { useAgentStore } from '../state/agentStore'
import { useCanvasStore } from '../state/canvasStore'
import { useFlowStore, getCurrentFlowId } from '../state/flowStore'
import { useGenerateStore } from '../state/generateStore'
import { useSettingsStore } from '../state/settingsStore'
import type { BaseNodeData } from '../types/nodeTypes'
import {
  AGENT_IMAGE_ASPECT_RATIOS,
  getAgentImageDimensions,
  getAgentImageResolutionOptions,
  type AgentImageAspectRatio,
  type AgentImageResolution,
} from './agentGenerationPlan'
import { prepareAgentImagePrompt } from './agentImagePrompt'
import { shouldBlockAgentImageEditGeneration } from './agentImageNodes'
import { resolveGenerationFlowId } from './generationFlow'
import {
  getConfiguredDefaultImageModel,
  getConfiguredImageModels,
  shouldRequireJimengCliForImageModel,
} from './imageModels'
import {
  getConfiguredDefaultVideoModel,
  getConfiguredVideoModels,
  getUnsupportedVideoModelMessage,
  videoModelNeedsJimeng,
} from './videoModels'
import {
  buildVideoCompletionNodePatch,
  buildVideoRunningNodePatch,
} from './videoGenerationState'

/** 执行工具时唯一需要外部注入的能力：新节点的落点（依赖 react-flow 视口） */
export interface AgentToolExecutionContext {
  getDropPosition: () => { x: number; y: number }
}

interface CanvasNodeLike {
  id: string
  type?: string | null
  data?: unknown
  position?: { x: number; y: number }
}

function ok(call: AgentToolCall, summary: string): AgentToolResult {
  return { callId: call.id, tool: call.tool, ok: true, summary }
}

function fail(call: AgentToolCall, summary: string): AgentToolResult {
  return { callId: call.id, tool: call.tool, ok: false, summary }
}

/**
 * Agent 提交的生成任务如果在后台失败(提交成功、但生成过程挂了),
 * 画布节点上只有一个不显眼的红点,用户会以为"已提交=迟早出图"。
 * 这里往 Agent 当前会话追加一条失败说明,让失败可见、可追问。
 * 只在用户仍停留在该项目的会话里时追加,避免串到别的项目的对话。
 */
function notifyAgentGenerationFailure(
  flowId: string,
  mediaLabel: string,
  error: string,
): void {
  const agentState = useAgentStore.getState()
  if (resolveGenerationFlowId(agentState.activeProjectId) !== flowId) return
  const trimmed = error.trim()
  agentState.addMessage({
    id: `agent-gen-fail-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role: 'assistant',
    content: `刚才提交的${mediaLabel}生成失败了：${trimmed || '未知错误'}\n你可以让我重试一次，或者换一个模型再试（在设置里可以调整默认模型）。`,
    contextNodeIds: [],
    createdAt: new Date().toISOString(),
  })
}

function stringArg(args: Record<string, unknown>, key: string): string {
  const value = args[key]
  return typeof value === 'string' ? value.trim() : ''
}

function stringArrayArg(args: Record<string, unknown>, key: string): string[] {
  const value = args[key]
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && !!item.trim())
}

function nearestNumber(value: unknown, options: readonly number[], fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return options.reduce((best, option) =>
    Math.abs(option - value) < Math.abs(best - value) ? option : best,
  options[0] ?? fallback)
}

function nodeTitle(node: CanvasNodeLike): string {
  const data = node.data as { title?: string } | undefined
  return data?.title ?? `${node.type ?? 'node'} ${node.id.slice(0, 4)}`
}

function getNodeAssetId(node: CanvasNodeLike): string | null {
  if (!node.data || typeof node.data !== 'object') return null
  const assetId = (node.data as { assetId?: unknown }).assetId
  return typeof assetId === 'string' && assetId.trim() ? assetId : null
}

/** 从引用的节点 id 中解析出可作为参考图输入的图片节点与素材 id */
export function getAgentToolInputImageNodes({
  referenceNodeIds,
  nodes,
}: {
  referenceNodeIds: string[]
  nodes: CanvasNodeLike[]
}): { nodes: CanvasNodeLike[]; assetIds: string[] } {
  const imageNodes: CanvasNodeLike[] = []
  const assetIds: string[] = []
  const seenNodeIds = new Set<string>()
  const seenAssetIds = new Set<string>()

  referenceNodeIds.forEach((nodeId) => {
    if (seenNodeIds.has(nodeId)) return
    const node = nodes.find((item) => item.id === nodeId)
    if (node?.type !== 'image') return
    const assetId = getNodeAssetId(node)
    if (!assetId || seenAssetIds.has(assetId)) return
    seenNodeIds.add(node.id)
    seenAssetIds.add(assetId)
    imageNodes.push(node)
    assetIds.push(assetId)
  })

  return { nodes: imageNodes, assetIds }
}

/** 引用里有视频节点时复用它继续抽卡，否则新建 */
export function selectAgentVideoTargetNodeId(
  referenceNodeIds: string[],
  nodes: CanvasNodeLike[],
): string | null {
  for (const id of referenceNodeIds) {
    const node = nodes.find((item) => item.id === id)
    if (node?.type === 'video') return node.id
  }
  return null
}

/** 视频节点已经连着(连边)的上游图片节点 id —— 重新生成视频时沿用参考图用 */
export function getAgentVideoUpstreamImageNodeIds(
  videoNodeId: string,
  edges: { source: string; target: string }[],
): string[] {
  return edges
    .filter((edge) => edge.target === videoNodeId)
    .map((edge) => edge.source)
}

export function resolveAgentVideoMode(
  requestedMode: VideoMode,
  inputImageAssetIds: string[],
): VideoMode {
  const inputCount = inputImageAssetIds.filter(Boolean).length
  if (inputCount === 0) return 'text_to_video'
  if (requestedMode === 'first_last_frame') {
    return inputCount >= 2 ? 'first_last_frame' : 'image_to_video'
  }
  if (requestedMode === 'all_reference' || requestedMode === 'image_reference') {
    return requestedMode
  }
  return 'image_to_video'
}

export function buildAgentVideoReferences(
  requestedMode: VideoMode,
  inputImageAssetIds: string[],
): VideoMediaReference[] {
  const mode = resolveAgentVideoMode(requestedMode, inputImageAssetIds)
  return buildVideoReferencesFromInputImages(mode, inputImageAssetIds)
}

/** 画布节点摘要：read_canvas 工具与发送对话上下文共用 */
export function summarizeCanvasNodes(nodes: CanvasNodeLike[]): AgentCanvasNodeSummary[] {
  return nodes.slice(0, 40).map((node) => {
    const data = (node.data ?? {}) as { prompt?: unknown; status?: unknown }
    return {
      id: node.id,
      type: node.type ?? 'unknown',
      title: nodeTitle(node),
      prompt: typeof data.prompt === 'string' && data.prompt.trim()
        ? data.prompt.trim().slice(0, 200)
        : undefined,
      status: typeof data.status === 'string' && data.status ? data.status : undefined,
    }
  })
}

function describeCanvas(nodes: CanvasNodeLike[]): string {
  if (!nodes.length) return '画布当前为空，没有任何节点。'
  const summaries = summarizeCanvasNodes(nodes)
  const lines = summaries.map((item) => {
    const parts = [`- ${item.id}（${item.type}）「${item.title}」`]
    if (item.prompt) parts.push(`提示词：${item.prompt}`)
    if (item.status) parts.push(`状态：${item.status}`)
    return parts.join('，')
  })
  return `画布共 ${nodes.length} 个节点：\n${lines.join('\n')}`
}

function connectNodes(sourceId: string, targetId: string): void {
  useCanvasStore.getState().onConnect({
    source: sourceId,
    target: targetId,
    sourceHandle: null,
    targetHandle: null,
  })
}

/** 多张结果时，从第二张起在右侧依次创建附加图片节点 */
function createAdditionalImageNodes(
  sourceNodeId: string,
  results: GenerationResult[],
  startIndex = 1,
): string[] {
  const { nodes, addNode, updateNodeData } = useCanvasStore.getState()
  const current = nodes.find((node) => node.id === sourceNodeId)
  const baseX = (current?.position?.x ?? 0) + 300
  const baseY = current?.position?.y ?? 0
  const nodeIds: string[] = []
  results.slice(startIndex).forEach((result, index) => {
    if (!result.assetId) return
    const imageNodeId = addNode('image', { x: baseX + index * 260, y: baseY })
    if (!imageNodeId) return
    updateNodeData(imageNodeId, {
      assetId: result.assetId,
    } as unknown as Partial<BaseNodeData>)
    connectNodes(sourceNodeId, imageNodeId)
    nodeIds.push(imageNodeId)
  })
  return nodeIds
}

/**
 * 工具调用里指定的模型只有在「设置里配置的模型列表」中才生效，
 * 否则回退到默认模型——图片工具只接受图片模型，视频工具只接受视频模型，
 * 两类绝不混用。
 */
export function pickAgentConfiguredModel(
  requested: unknown,
  configuredIds: string[],
  fallback: string,
): string {
  const id = typeof requested === 'string' ? requested.trim() : ''
  return id && configuredIds.includes(id) ? id : fallback
}

/** 设置里配置的图片模型 id 列表（供面板选择器与校验共用） */
export function getAgentImageModelIds(): string[] {
  const { settings } = useSettingsStore.getState()
  return getConfiguredImageModels(
    settings?.imageModels,
    undefined,
    settings?.modelConfigs,
  ).map((option) => option.id)
}

/** 设置里配置的视频模型 id 列表 */
export function getAgentVideoModelIds(): string[] {
  const { settings } = useSettingsStore.getState()
  return getConfiguredVideoModels(
    settings?.videoModels,
    settings?.modelConfigs,
  ).map((option) => option.id)
}

function resolveImageModel(requestedModel?: unknown): { model: string | null; error?: string } {
  const { settings, isJimengConfigured } = useSettingsStore.getState()
  const configuredIds = getAgentImageModelIds()
  const defaultModel = getConfiguredDefaultImageModel(
    settings?.imageModels,
    settings?.defaultModel,
    undefined,
    settings?.modelConfigs,
  )
  const model = pickAgentConfiguredModel(requestedModel, configuredIds, defaultModel)
  if (!model) {
    return { model: null, error: '还没有可用的图片生成模型，请先在设置中添加图片模型。' }
  }
  if (shouldRequireJimengCliForImageModel(model) && !isJimengConfigured) {
    return { model: null, error: '未配置 dreamina CLI，请先在设置中配置后再生成。' }
  }
  return { model }
}

/** 大部分内容是横版或竖版，方形 1:1 适用面最窄，默认 16:9 */
export const AGENT_DEFAULT_IMAGE_ASPECT_RATIO: AgentImageAspectRatio = '16:9'

/** 从已知像素尺寸推导最接近的画幅比例 */
export function closestAgentImageAspectRatio(
  width: unknown,
  height: unknown,
): AgentImageAspectRatio | null {
  if (typeof width !== 'number' || typeof height !== 'number' || width <= 0 || height <= 0) {
    return null
  }
  const ratio = width / height
  return AGENT_IMAGE_ASPECT_RATIOS.reduce((best, option) => {
    const [w, h] = option.split(':').map(Number)
    const [bestW, bestH] = best.split(':').map(Number)
    return Math.abs(w / h - ratio) < Math.abs(bestW / bestH - ratio) ? option : best
  }, AGENT_DEFAULT_IMAGE_ASPECT_RATIO as AgentImageAspectRatio)
}

export function resolveAgentImageParams(call: AgentToolCall, model: string): {
  aspectRatio: AgentImageAspectRatio
  resolution: AgentImageResolution
  count: number
} {
  const ratioArg = stringArg(call.args, 'aspectRatio')
  const aspectRatio = AGENT_IMAGE_ASPECT_RATIOS.includes(ratioArg as AgentImageAspectRatio)
    ? ratioArg as AgentImageAspectRatio
    : AGENT_DEFAULT_IMAGE_ASPECT_RATIO
  const resolutionOptions = getAgentImageResolutionOptions(model)
  const resolutionArg = stringArg(call.args, 'resolution').toUpperCase()
  const resolution = resolutionOptions.includes(resolutionArg as AgentImageResolution)
    ? resolutionArg as AgentImageResolution
    : resolutionOptions[0]
  const count = nearestNumber(call.args.count, IMAGE_COUNTS, 1)
  return { aspectRatio, resolution, count }
}

async function runGenerateImage(
  call: AgentToolCall,
  context: AgentToolExecutionContext,
): Promise<AgentToolResult> {
  const promptArg = stringArg(call.args, 'prompt')
  if (!promptArg) return fail(call, '缺少 prompt，无法生成图片。')

  const { model, error } = resolveImageModel(call.args.model)
  if (!model) return fail(call, error ?? '没有可用的图片生成模型。')

  const { aspectRatio, resolution, count } = resolveAgentImageParams(call, model)
  const size = getAgentImageDimensions(aspectRatio, resolution)
  const prompt = prepareAgentImagePrompt(promptArg)

  const canvas = useCanvasStore.getState()
  const { nodes: inputImageNodes, assetIds: inputImageAssetIds } =
    getAgentToolInputImageNodes({
      referenceNodeIds: stringArrayArg(call.args, 'referenceNodeIds'),
      nodes: canvas.nodes,
    })

  const imageNodeId = canvas.addNode('image', context.getDropPosition())
  if (!imageNodeId) return fail(call, '创建图片节点失败。')
  inputImageNodes.forEach((node) => connectNodes(node.id, imageNodeId))

  const request: GenerationRequest = {
    flowId: resolveGenerationFlowId(getCurrentFlowId()),
    nodeId: imageNodeId,
    mediaType: 'image',
    prompt,
    inputImages: inputImageAssetIds,
    model,
    width: size.width,
    height: size.height,
    count,
    seed: null,
  }

  const generateStore = useGenerateStore.getState()
  generateStore.setLastRequest(imageNodeId, request)
  generateStore.setStatus(imageNodeId, 'queued')
  generateStore.setError(imageNodeId, undefined)
  canvas.updateNodeData(imageNodeId, {
    prompt,
    model,
    width: size.width,
    height: size.height,
    count,
    seed: null,
    inputImageAssetIds,
    status: 'running',
    error: undefined,
    updatedAt: new Date().toISOString(),
  } as unknown as Partial<BaseNodeData>)

  try {
    await useFlowStore.getState().saveCurrent()
    const response = await createGeneration(request)
    generateStore.setGenerationId(imageNodeId, response.id)

    subscribeGeneration(response.id, {
      onUpdate: (data) => {
        generateStore.setStatus(imageNodeId, data.status)
        if (data.error) generateStore.setError(imageNodeId, data.error)
        useCanvasStore.getState().updateNodeData(imageNodeId, {
          status: data.status,
          error: data.error,
          updatedAt: new Date().toISOString(),
        } as unknown as Partial<BaseNodeData>)
      },
      onComplete: (data) => {
        const results = data.results ?? []
        const outputAssetIds = results
          .map((result) => result.assetId)
          .filter((assetId): assetId is string => !!assetId)
        createAdditionalImageNodes(imageNodeId, results)
        generateStore.setStatus(imageNodeId, data.status)
        if (data.error) generateStore.setError(imageNodeId, data.error)
        useCanvasStore.getState().updateNodeData(imageNodeId, {
          status: data.status,
          error: data.error,
          assetId: results[0]?.assetId,
          outputAssetIds,
          generationId: data.id,
          updatedAt: new Date().toISOString(),
        } as unknown as Partial<BaseNodeData>)
        if (outputAssetIds.length > 0) {
          useAgentStore.getState().setConversationContext({
            lastPrompt: promptArg,
            lastGeneratedAssetIds: outputAssetIds,
          })
        }
        if (data.status === 'error') {
          notifyAgentGenerationFailure(
            request.flowId ?? 'local',
            '图片',
            data.error ?? '生成任务返回了错误状态',
          )
        }
      },
      onError: (sseError) => {
        generateStore.setError(imageNodeId, sseError)
        useCanvasStore.getState().updateNodeData(imageNodeId, {
          status: 'error',
          error: sseError,
          updatedAt: new Date().toISOString(),
        } as unknown as Partial<BaseNodeData>)
        notifyAgentGenerationFailure(request.flowId ?? 'local', '图片', sseError)
      },
    })

    return ok(
      call,
      `已创建图片节点 ${imageNodeId} 并提交生成（任务 ${response.id}，${count} 张 ${aspectRatio}），生成完成后图片会自动出现在该节点。`,
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    generateStore.setError(imageNodeId, message)
    useCanvasStore.getState().updateNodeData(imageNodeId, {
      status: 'error',
      error: message,
      updatedAt: new Date().toISOString(),
    } as unknown as Partial<BaseNodeData>)
    return fail(call, `图片生成提交失败：${message}`)
  }
}

async function runGenerateVideo(
  call: AgentToolCall,
  context: AgentToolExecutionContext,
): Promise<AgentToolResult> {
  const prompt = stringArg(call.args, 'prompt')
  if (!prompt) return fail(call, '缺少 prompt，无法生成视频。')

  const { settings, isJimengConfigured } = useSettingsStore.getState()
  const defaultVideoModel = getConfiguredDefaultVideoModel(
    settings?.videoModels,
    settings?.defaultVideoModel,
    settings?.modelConfigs,
  )
  const model = pickAgentConfiguredModel(
    call.args.model,
    getAgentVideoModelIds(),
    defaultVideoModel,
  )
  if (!model) {
    return fail(call, '还没有可用的视频生成模型，请先在设置中添加视频模型。')
  }
  const unsupportedMessage = getUnsupportedVideoModelMessage(model)
  if (unsupportedMessage) return fail(call, unsupportedMessage)
  if (videoModelNeedsJimeng(model) && !isJimengConfigured) {
    return fail(call, '未配置 dreamina CLI，请先在设置中配置后再生成。')
  }

  const canvas = useCanvasStore.getState()
  const referenceNodeIds = stringArrayArg(call.args, 'referenceNodeIds')
  const resolvedInputs = getAgentToolInputImageNodes({ referenceNodeIds, nodes: canvas.nodes })
  const inputImageNodes = [...resolvedInputs.nodes]
  const inputImageAssetIds = [...resolvedInputs.assetIds]

  const existingVideoNodeId = selectAgentVideoTargetNodeId(referenceNodeIds, canvas.nodes)
  // 重新生成已有视频但没给参考图时,沿用该节点已连着(连边)的上游图片,
  // 保证"换个动态"类的重改仍然基于同一张图,而不是退化成文生视频
  if (inputImageAssetIds.length === 0 && existingVideoNodeId) {
    const inherited = getAgentToolInputImageNodes({
      referenceNodeIds: getAgentVideoUpstreamImageNodeIds(existingVideoNodeId, canvas.edges),
      nodes: canvas.nodes,
    })
    inputImageNodes.push(...inherited.nodes)
    inputImageAssetIds.push(...inherited.assetIds)
  }

  const requestedMode = stringArg(call.args, 'mode')
  const mode: VideoMode = VIDEO_MODES.some((option) => option.id === requestedMode)
    ? requestedMode as VideoMode
    : inputImageAssetIds.length > 0
      ? 'image_to_video'
      : 'text_to_video'

  const ratioArg = stringArg(call.args, 'aspectRatio')
  const aspectRatio: VideoAspectRatio = VIDEO_ASPECT_RATIOS.includes(ratioArg as VideoAspectRatio)
    ? ratioArg as VideoAspectRatio
    : (settings?.defaultVideoAspectRatio as VideoAspectRatio | undefined) ?? '16:9'
  const resolutionArg = stringArg(call.args, 'resolution').toUpperCase()
  const resolution: VideoResolution = VIDEO_RESOLUTIONS.includes(resolutionArg as VideoResolution)
    ? resolutionArg as VideoResolution
    : (settings?.defaultVideoResolution as VideoResolution | undefined) ?? '720P'
  const durationSeconds = nearestNumber(
    call.args.durationSeconds,
    VIDEO_DURATIONS,
    settings?.defaultVideoDurationSeconds ?? 5,
  )
  const count = nearestNumber(call.args.count, VIDEO_COUNTS, settings?.defaultVideoCount ?? 1)
  const quality = stringArg(call.args, 'quality') === 'high' ? 'high' : 'standard'

  const videoNodeId = existingVideoNodeId ?? canvas.addNode('video', context.getDropPosition())
  if (!videoNodeId) return fail(call, '创建视频节点失败。')

  inputImageNodes.forEach((node) => {
    const hasExistingEdge = canvas.edges.some(
      (edge) => edge.source === node.id && edge.target === videoNodeId,
    )
    if (!hasExistingEdge) connectNodes(node.id, videoNodeId)
  })

  const videoMode = resolveAgentVideoMode(mode, inputImageAssetIds)
  const request: VideoGenerationRequest = {
    flowId: resolveGenerationFlowId(getCurrentFlowId()),
    nodeId: videoNodeId,
    mediaType: 'video',
    mode: videoMode,
    prompt,
    inputImages: inputImageAssetIds,
    references: buildAgentVideoReferences(mode, inputImageAssetIds),
    model,
    aspectRatio,
    resolution,
    quality,
    durationSeconds,
    count,
    generateAudio: settings?.defaultVideoGenerateAudio ?? true,
  }

  const generateStore = useGenerateStore.getState()
  generateStore.setLastRequest(videoNodeId, request)
  generateStore.setStatus(videoNodeId, 'running')
  generateStore.setError(videoNodeId, undefined)
  const latestVideoData = useCanvasStore
    .getState()
    .nodes.find((node) => node.id === videoNodeId)
    ?.data as Partial<VideoNodeData> | undefined
  canvas.updateNodeData(videoNodeId, {
    ...buildVideoRunningNodePatch(request, latestVideoData ?? {}),
    status: 'running',
  } as unknown as Partial<BaseNodeData>)

  try {
    await useFlowStore.getState().saveCurrent()
    const response = await createGeneration(request)
    generateStore.setGenerationId(videoNodeId, response.id)

    subscribeGeneration(response.id, {
      onUpdate: (data) => {
        generateStore.setStatus(videoNodeId, data.status)
        if (data.error) generateStore.setError(videoNodeId, data.error)
        useCanvasStore.getState().updateNodeData(videoNodeId, {
          status: data.status,
          error: data.error,
          updatedAt: new Date().toISOString(),
        } as unknown as Partial<BaseNodeData>)
      },
      onComplete: (data) => {
        const latestData = useCanvasStore
          .getState()
          .nodes.find((node) => node.id === videoNodeId)
          ?.data as { assetIds?: unknown; generationRuns?: unknown } | undefined
        const currentAssetIds = Array.isArray(latestData?.assetIds)
          ? latestData.assetIds.filter(
              (assetId): assetId is string => typeof assetId === 'string',
            )
          : []
        const completionPatch = buildVideoCompletionNodePatch(
          data,
          request,
          {
            assetIds: currentAssetIds,
            generationRuns: latestData?.generationRuns as VideoNodeData['generationRuns'],
          },
          new Date().toISOString(),
        )
        generateStore.setStatus(videoNodeId, data.status)
        if (data.error) generateStore.setError(videoNodeId, data.error)
        useCanvasStore.getState().updateNodeData(
          videoNodeId,
          completionPatch as unknown as Partial<BaseNodeData>,
        )
        const generatedAssetIds = data.results
          ?.map((result) => result.assetId)
          .filter((assetId): assetId is string => !!assetId) ?? []
        if (generatedAssetIds.length > 0) {
          useAgentStore.getState().setConversationContext({
            lastPrompt: prompt,
            lastGeneratedAssetIds: generatedAssetIds,
          })
        }
        if (data.status === 'error') {
          notifyAgentGenerationFailure(
            request.flowId ?? 'local',
            '视频',
            data.error ?? '生成任务返回了错误状态',
          )
        }
      },
      onError: (sseError) => {
        generateStore.setError(videoNodeId, sseError)
        useCanvasStore.getState().updateNodeData(videoNodeId, {
          status: 'error',
          error: sseError,
          updatedAt: new Date().toISOString(),
        } as unknown as Partial<BaseNodeData>)
        notifyAgentGenerationFailure(request.flowId ?? 'local', '视频', sseError)
      },
    })

    return ok(
      call,
      existingVideoNodeId
        ? `已在视频节点 ${videoNodeId} 上重新提交生成（任务 ${response.id}），完成后视频会自动出现在该节点。`
        : `已创建视频节点 ${videoNodeId} 并提交生成（任务 ${response.id}），完成后视频会自动出现在该节点。`,
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    generateStore.setError(videoNodeId, message)
    useCanvasStore.getState().updateNodeData(videoNodeId, {
      status: 'error',
      error: message,
      updatedAt: new Date().toISOString(),
    } as unknown as Partial<BaseNodeData>)
    return fail(call, `视频生成提交失败：${message}`)
  }
}

async function runEditImage(
  call: AgentToolCall,
  context: AgentToolExecutionContext,
): Promise<AgentToolResult> {
  const canvas = useCanvasStore.getState()
  const { nodes: inputImageNodes, assetIds: inputImageAssetIds } =
    getAgentToolInputImageNodes({
      referenceNodeIds: stringArrayArg(call.args, 'referenceNodeIds'),
      nodes: canvas.nodes,
    })
  if (inputImageAssetIds.length === 0) {
    return fail(call, '没有找到可编辑的图片节点，请先在 referenceNodeIds 中指定画布上已生成图片的节点。')
  }

  const editTypeArg = stringArg(call.args, 'editType')
  const editType = editTypeArg === 'style_transfer' || editTypeArg === 'remove_bg'
    ? editTypeArg
    : 'modify'
  const prompt = stringArg(call.args, 'prompt')
  if (editType !== 'remove_bg' && !prompt) {
    return fail(call, '缺少修改要求（prompt），无法编辑图片。')
  }

  const { isJimengConfigured } = useSettingsStore.getState()
  const { model, error: modelError } = resolveImageModel(call.args.model)
  if (!model) {
    return fail(call, modelError ?? '还没有可用的图片生成模型，请先在设置中添加图片模型。')
  }
  if (shouldBlockAgentImageEditGeneration(model, isJimengConfigured)) {
    return fail(call, '未配置 dreamina CLI，请先在设置中配置后再生成。')
  }

  // 编辑结果默认沿用源图比例；也可用 args.aspectRatio 显式覆盖
  const sourceData = (inputImageNodes[0]?.data ?? {}) as { width?: unknown; height?: unknown }
  const ratioArg = stringArg(call.args, 'aspectRatio')
  const editRatio = AGENT_IMAGE_ASPECT_RATIOS.includes(ratioArg as AgentImageAspectRatio)
    ? ratioArg as AgentImageAspectRatio
    : closestAgentImageAspectRatio(sourceData.width, sourceData.height)
      ?? AGENT_DEFAULT_IMAGE_ASPECT_RATIO
  const size = getAgentImageDimensions(editRatio, getAgentImageResolutionOptions(model)[0])
  const imageNodeId = canvas.addNode('image', context.getDropPosition())
  if (!imageNodeId) return fail(call, '创建图片节点失败。')
  inputImageNodes.forEach((node) => connectNodes(node.id, imageNodeId))

  const generateStore = useGenerateStore.getState()
  generateStore.setStatus(imageNodeId, 'queued')
  generateStore.setError(imageNodeId, undefined)
  canvas.updateNodeData(imageNodeId, {
    prompt,
    model,
    width: size.width,
    height: size.height,
    count: 1,
    seed: null,
    inputImageAssetIds,
    status: 'queued',
    error: undefined,
    updatedAt: new Date().toISOString(),
  } as unknown as Partial<BaseNodeData>)

  try {
    await useFlowStore.getState().saveCurrent()
    const response = await createEditGeneration({
      inputImage: inputImageAssetIds[0],
      editType,
      prompt: editType === 'remove_bg' ? undefined : prompt,
      model,
      width: size.width,
      height: size.height,
      flowId: resolveGenerationFlowId(getCurrentFlowId()),
      nodeId: imageNodeId,
    })
    generateStore.setGenerationId(imageNodeId, response.id)
    const results = response.results ?? []
    const outputAssetIds = results
      .map((result) => result.assetId)
      .filter((assetId): assetId is string => !!assetId)
    createAdditionalImageNodes(imageNodeId, results)

    generateStore.setStatus(imageNodeId, response.status)
    if (response.error) generateStore.setError(imageNodeId, response.error)
    useCanvasStore.getState().updateNodeData(imageNodeId, {
      status: response.status,
      error: response.error,
      assetId: results[0]?.assetId,
      outputAssetIds,
      generationId: response.id,
      updatedAt: new Date().toISOString(),
    } as unknown as Partial<BaseNodeData>)
    if (outputAssetIds.length > 0) {
      useAgentStore.getState().setConversationContext({
        lastPrompt: prompt || '图片编辑',
        lastGeneratedAssetIds: outputAssetIds,
      })
    }

    return response.status === 'error'
      ? fail(call, `图片编辑失败：${response.error ?? '未知错误'}`)
      : ok(call, `已创建编辑节点 ${imageNodeId}，生成 ${outputAssetIds.length} 张结果图。`)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    generateStore.setError(imageNodeId, message)
    useCanvasStore.getState().updateNodeData(imageNodeId, {
      status: 'error',
      error: message,
      updatedAt: new Date().toISOString(),
    } as unknown as Partial<BaseNodeData>)
    return fail(call, `图片编辑失败：${message}`)
  }
}

function runReadCanvas(call: AgentToolCall): AgentToolResult {
  return ok(call, describeCanvas(useCanvasStore.getState().nodes))
}

/** 执行一个工具调用，返回可回传给模型的结果摘要。 */
export async function executeAgentToolCall(
  call: AgentToolCall,
  context: AgentToolExecutionContext,
): Promise<AgentToolResult> {
  switch (call.tool) {
    case 'generate_image':
      return runGenerateImage(call, context)
    case 'generate_video':
      return runGenerateVideo(call, context)
    case 'edit_image':
      return runEditImage(call, context)
    case 'read_canvas':
      return runReadCanvas(call)
  }
}
