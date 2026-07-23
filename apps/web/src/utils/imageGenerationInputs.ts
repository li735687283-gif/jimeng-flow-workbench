interface ImageGenerationInputOptions {
  nodeId?: string | null
  nodes?: ImageGenerationInputNode[]
  edges?: ImageGenerationInputEdge[]
}

interface ImageGenerationInputNode {
  id: string
  type?: string | null
  data?: {
    assetId?: unknown
    content?: unknown
    input?: unknown
    title?: unknown
    promptCandidate?: unknown
  } | null
}

interface ImageGenerationInputEdge {
  source?: string | null
  target?: string | null
}

/** 上传/外部导入的图片节点只作为参考源，不允许在原节点直接生成。 */
export function isImageNodeSourceOnly(
  data: { sourceOnly?: unknown } | null | undefined,
): boolean {
  return data?.sourceOnly === true
}

/** 上游文本节点引用（作为图片提示词来源） */
export interface UpstreamTextReference {
  nodeId: string
  title: string
  /** 实际用于提示词的文本 */
  text: string
}

function getTrimmedAssetId(assetId: unknown): string {
  return typeof assetId === 'string' ? assetId.trim() : ''
}

function getTrimmedText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/** 从文本节点 data 提取可用提示词：优先正文 content，其次 promptCandidate / input */
export function extractTextNodePrompt(data: ImageGenerationInputNode['data']): string {
  if (!data) return ''
  return (
    getTrimmedText(data.content) ||
    getTrimmedText(data.promptCandidate) ||
    getTrimmedText(data.input)
  )
}

function collectUpstreamImageAssetIds({
  nodeId,
  nodes = [],
  edges = [],
}: Pick<ImageGenerationInputOptions, 'nodeId' | 'nodes' | 'edges'>): string[] {
  const currentNodeId = typeof nodeId === 'string' ? nodeId.trim() : ''
  if (!currentNodeId || nodes.length === 0 || edges.length === 0) return []

  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const assetIds: string[] = []
  const seen = new Set<string>()

  // 只收集直接上游一层，不递归遍历前方的前方
  for (const edge of edges) {
    if (edge.target !== currentNodeId) continue
    const sourceId = typeof edge.source === 'string' ? edge.source : ''
    if (!sourceId || seen.has(sourceId)) continue
    seen.add(sourceId)
    const sourceNode = nodeById.get(sourceId)
    if (sourceNode?.type !== 'image') continue
    const sourceAssetId = getTrimmedAssetId(sourceNode.data?.assetId)
    if (sourceAssetId) assetIds.push(sourceAssetId)
  }
  return assetIds
}

/**
 * 收集直接上游文本节点的提示词引用。
 * 文本节点常作为「提示词源」连到图片节点，引用后可不在图片节点再写提示词。
 */
export function getUpstreamTextReferences({
  nodeId,
  nodes = [],
  edges = [],
}: Pick<ImageGenerationInputOptions, 'nodeId' | 'nodes' | 'edges'>): UpstreamTextReference[] {
  const currentNodeId = typeof nodeId === 'string' ? nodeId.trim() : ''
  if (!currentNodeId || nodes.length === 0 || edges.length === 0) return []

  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const refs: UpstreamTextReference[] = []
  const seen = new Set<string>()

  for (const edge of edges) {
    if (edge.target !== currentNodeId) continue
    const sourceId = typeof edge.source === 'string' ? edge.source.trim() : ''
    if (!sourceId || seen.has(sourceId)) continue
    seen.add(sourceId)

    const sourceNode = nodeById.get(sourceId)
    const sourceType =
      typeof sourceNode?.type === 'string' ? sourceNode.type.trim().toLowerCase() : ''
    // 兼容 type 字段或 data.type
    const dataType = getTrimmedText(
      (sourceNode?.data as { type?: unknown } | null | undefined)?.type,
    ).toLowerCase()
    if (sourceType !== 'text' && dataType !== 'text') continue

    const text = extractTextNodePrompt(sourceNode?.data)
    if (!text) continue

    const title = getTrimmedText(sourceNode?.data?.title) || '文本节点'
    refs.push({
      nodeId: sourceId,
      title,
      text,
    })
  }

  return refs
}

/** 将多个上游文本引用合并为一条提示词 */
export function joinUpstreamTextPrompts(refs: UpstreamTextReference[]): string {
  return refs
    .map((ref) => ref.text.trim())
    .filter(Boolean)
    .join('\n\n')
}

/**
 * 解析最终生图提示词：
 * - 图片节点本地提示词非空 → 用本地（用户手写优先）
 * - 否则回退到上游文本节点内容
 */
export function resolveImageGenerationPrompt({
  localPrompt,
  nodeId,
  nodes,
  edges,
}: {
  localPrompt?: string | null
  nodeId?: string | null
  nodes?: ImageGenerationInputNode[]
  edges?: ImageGenerationInputEdge[]
}): {
  prompt: string
  source: 'local' | 'upstream-text' | 'empty'
  upstreamRefs: UpstreamTextReference[]
} {
  const local = getTrimmedText(localPrompt)
  const upstreamRefs = getUpstreamTextReferences({ nodeId, nodes, edges })
  if (local) {
    return { prompt: local, source: 'local', upstreamRefs }
  }
  const upstream = joinUpstreamTextPrompts(upstreamRefs)
  if (upstream) {
    return { prompt: upstream, source: 'upstream-text', upstreamRefs }
  }
  return { prompt: '', source: 'empty', upstreamRefs }
}

export function getImageGenerationInputImages({
  nodeId,
  nodes,
  edges,
}: ImageGenerationInputOptions): string[] {
  const inputImages: string[] = []
  const seen = new Set<string>()
  const pushUnique = (value: unknown) => {
    const imageAssetId = getTrimmedAssetId(value)
    if (!imageAssetId || seen.has(imageAssetId)) return
    seen.add(imageAssetId)
    inputImages.push(imageAssetId)
  }

  for (const upstreamAssetId of collectUpstreamImageAssetIds({ nodeId, nodes, edges })) {
    pushUnique(upstreamAssetId)
  }

  return inputImages
}
