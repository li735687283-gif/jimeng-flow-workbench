import {
  buildVideoReferencesFromInputImages,
  type VideoGenerationRequest,
  type VideoGenerationRun,
  type VideoMediaReference,
  type VideoMode,
  type VideoNodeData,
} from '@jimeng-flow/shared/videoNode'
import type { GenerationResponse } from '@jimeng-flow/shared/generateNode'
import {
  buildVideoCompletionNodePatch,
  buildVideoRunningNodePatch,
} from './videoGenerationState'
import type {
  AgentMessage,
  StoryboardItem,
} from '@jimeng-flow/shared/agentMessage'

interface AgentVideoTargetCandidate {
  id: string
  type?: string | null
}

interface AgentVideoInputImageNode {
  id: string
  type?: string | null
  data?: unknown
}

function getNodeAssetId(node: AgentVideoInputImageNode): string | null {
  if (!node.data || typeof node.data !== 'object') return null
  const assetId = (node.data as { assetId?: unknown }).assetId
  return typeof assetId === 'string' && assetId.trim() ? assetId : null
}

function uniqueAssetIds(ids: Array<string | null | undefined>): string[] {
  const result: string[] = []
  const seen = new Set<string>()
  ids.forEach((id) => {
    const assetId = id?.trim()
    if (!assetId || seen.has(assetId)) return
    seen.add(assetId)
    result.push(assetId)
  })
  return result
}

export function getAgentVideoInputImageNodes({
  contextNodeIds,
  sourceImageNodeIds = [],
  nodes,
}: {
  contextNodeIds: string[]
  sourceImageNodeIds?: string[]
  nodes: AgentVideoInputImageNode[]
}): {
  nodes: AgentVideoInputImageNode[]
  assetIds: string[]
} {
  const imageNodes: AgentVideoInputImageNode[] = []
  const assetIds: string[] = []
  const seenNodeIds = new Set<string>()
  const seenAssetIds = new Set<string>()

  const addNode = (nodeId: string) => {
    if (seenNodeIds.has(nodeId)) return
    const node = nodes.find((item) => item.id === nodeId)
    if (node?.type !== 'image') return
    const assetId = getNodeAssetId(node)
    if (!assetId || seenAssetIds.has(assetId)) return
    seenNodeIds.add(node.id)
    seenAssetIds.add(assetId)
    imageNodes.push(node)
    assetIds.push(assetId)
  }

  contextNodeIds.forEach(addNode)
  sourceImageNodeIds.forEach(addNode)

  return { nodes: imageNodes, assetIds }
}

export function getAgentStoryboardVideoSource({
  imageAssetId,
  imageNodeId,
  nodes,
}: {
  imageAssetId?: string
  imageNodeId?: string
  nodes: AgentVideoInputImageNode[]
}): {
  assetId: string
  nodeId: string | null
} | null {
  const assetId = imageAssetId?.trim()
  if (!assetId) return null

  const explicitNodeId = imageNodeId?.trim()
  if (explicitNodeId) {
    const explicitNode = nodes.find(
      (node) =>
        node.id === explicitNodeId &&
        node.type === 'image' &&
        getNodeAssetId(node) === assetId,
    )
    if (explicitNode) return { assetId, nodeId: explicitNode.id }
  }

  const fallbackNode = nodes.find(
    (node) => node.type === 'image' && getNodeAssetId(node) === assetId,
  )
  return { assetId, nodeId: fallbackNode?.id ?? null }
}

export function getAgentStoryboardVideoReferenceSources({
  items,
  nodes,
}: {
  items: Array<Pick<StoryboardItem, 'imageAssetId' | 'imageNodeId'>>
  nodes: AgentVideoInputImageNode[]
}): Array<{ assetId: string; nodeId: string | null }> {
  const sources: Array<{ assetId: string; nodeId: string | null }> = []
  const seen = new Set<string>()

  items.forEach((item) => {
    const source = getAgentStoryboardVideoSource({
      imageAssetId: item.imageAssetId,
      imageNodeId: item.imageNodeId,
      nodes,
    })
    if (!source || seen.has(source.assetId)) return
    seen.add(source.assetId)
    sources.push(source)
  })

  return sources
}

export function applyAgentStoryboardVideoResult(
  items: StoryboardItem[],
  index: number,
  result: { videoAssetId?: string; videoNodeId?: string },
): StoryboardItem[] {
  const videoAssetId = result.videoAssetId?.trim()
  const videoNodeId = result.videoNodeId?.trim()
  if (!videoAssetId && !videoNodeId) return items

  return items.map((item, itemIndex) => {
    if (itemIndex !== index) return item
    return {
      ...item,
      videoAssetId: videoAssetId || item.videoAssetId,
      videoNodeId: videoNodeId || item.videoNodeId,
    }
  })
}

export function getAgentStoryboardVideoTargetNodeId({
  videoNodeId,
  nodes,
}: {
  videoNodeId?: string
  nodes: AgentVideoTargetCandidate[]
}): string | null {
  const targetId = videoNodeId?.trim()
  if (!targetId) return null
  const node = nodes.find((item) => item.id === targetId)
  return node?.type === 'video' ? node.id : null
}

export function applyAgentStoryboardVideoRestoreResult(
  messages: AgentMessage[],
  result: { videoNodeId?: string; videoAssetId?: string },
): AgentMessage[] {
  const videoNodeId = result.videoNodeId?.trim()
  const videoAssetId = result.videoAssetId?.trim()
  if (!videoNodeId || !videoAssetId) return messages

  let changed = false
  const nextMessages = messages.map((message) => {
    if (!message.storyboard) return message
    let messageChanged = false
    const items = message.storyboard.items.map((item) => {
      if (item.videoNodeId !== videoNodeId) return item
      changed = true
      messageChanged = true
      return { ...item, videoAssetId }
    })
    return messageChanged
      ? { ...message, storyboard: { ...message.storyboard, items } }
      : message
  })

  return changed ? nextMessages : messages
}

export function getAgentStoryboardItemMediaStatus(
  item: Pick<StoryboardItem, 'imageAssetId' | 'videoAssetId'>,
): string {
  if (item.videoAssetId?.trim()) return '视频已生成'
  if (item.imageAssetId?.trim()) return '图片已生成'
  return '待生成'
}

export function getAgentStoryboardVideoActionLabel(
  items: Array<Pick<StoryboardItem, 'imageAssetId' | 'videoAssetId'>>,
): string {
  return items.length > 0 && items.every((item) => item.videoAssetId?.trim())
    ? '再抽一次'
    : '生成视频'
}

export function getAgentStoryboardVideoLocateLabel(
  item: Pick<StoryboardItem, 'videoAssetId' | 'videoNodeId'>,
): string | null {
  return item.videoAssetId?.trim() && item.videoNodeId?.trim()
    ? '定位视频'
    : null
}

export function selectAgentVideoTargetNodeId(
  contextNodeIds: string[],
  nodes: AgentVideoTargetCandidate[],
): string | null {
  for (const id of contextNodeIds) {
    const node = nodes.find((item) => item.id === id)
    if (node?.type === 'video') return node.id
  }
  return null
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

export function buildAgentStoryboardVideoMedia({
  requestedMode,
  sourceAssetId,
  tailAssetId,
  referenceAssetIds = [],
}: {
  requestedMode: VideoMode
  sourceAssetId: string
  tailAssetId?: string
  referenceAssetIds?: string[]
}): {
  mode: VideoMode
  inputImages: string[]
  references: VideoMediaReference[]
} {
  const source = sourceAssetId.trim()
  const tail = tailAssetId?.trim()
  let inputImages = [source]
  if (requestedMode === 'all_reference' || requestedMode === 'image_reference') {
    inputImages = uniqueAssetIds([source, ...referenceAssetIds])
  } else if (requestedMode === 'first_last_frame' && tail && tail !== source) {
    inputImages = [source, tail]
  }
  const mode = resolveAgentVideoMode(requestedMode, inputImages)
  return {
    mode,
    inputImages,
    references: buildVideoReferencesFromInputImages(mode, inputImages),
  }
}

export function getAgentVideoGeneratedAssetIds(
  response: GenerationResponse,
): string[] {
  return response.results
    ?.map((result) => result.assetId)
    .filter((assetId): assetId is string => !!assetId) ?? []
}

export function buildAgentVideoRunningPatch(
  request: VideoGenerationRequest,
  currentData: Partial<VideoNodeData>,
  updatedAt = new Date().toISOString(),
): Partial<VideoNodeData> {
  return buildVideoRunningNodePatch(request, currentData, updatedAt)
}

export function buildAgentVideoCompletionPatch(
  response: GenerationResponse,
  request: VideoGenerationRequest,
  existingRuns: unknown,
  updatedAt = new Date().toISOString(),
  currentAssetIds: string[] = [],
): {
  status: GenerationResponse['status']
  error: GenerationResponse['error']
  assetIds: string[]
  generationId: string
  generationRuns: VideoGenerationRun[]
  updatedAt: string
} {
  return buildVideoCompletionNodePatch(
    response,
    request,
    {
      assetIds: currentAssetIds,
      generationRuns: existingRuns as VideoGenerationRun[] | undefined,
    },
    updatedAt,
  )
}
