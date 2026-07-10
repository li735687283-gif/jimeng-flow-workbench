/** 文本节点上游图片引用（用于识图/反推提示词） */

export interface UpstreamImageReference {
  nodeId: string
  assetId: string
  title: string
}

interface CanvasNodeLike {
  id: string
  type?: string | null
  data?: {
    assetId?: unknown
    outputAssetIds?: unknown
    assetIds?: unknown
    title?: unknown
  } | null
}

/** 从图片节点 data 取可用 assetId（兼容 outputAssetIds / assetIds） */
export function extractImageNodeAssetId(
  data: CanvasNodeLike['data'],
): string {
  if (!data) return ''
  const direct = trimText(data.assetId)
  if (direct) return direct
  if (Array.isArray(data.outputAssetIds)) {
    for (const item of data.outputAssetIds) {
      const id = trimText(item)
      if (id) return id
    }
  }
  if (Array.isArray(data.assetIds)) {
    for (const item of data.assetIds) {
      const id = trimText(item)
      if (id) return id
    }
  }
  return ''
}

/** Codex CLI 文本通道不支持多模态识图 */
export function isCodexTextModel(modelId: string): boolean {
  return modelId.trim().toLowerCase().startsWith('codex:')
}

interface CanvasEdgeLike {
  source?: string | null
  target?: string | null
}

function trimText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * 收集文本节点的直接上游图片资产。
 * 约定：图片节点 → 文本节点，文本侧可识图反推风格/颜色/构图等。
 */
export function getUpstreamImageReferences({
  nodeId,
  nodes = [],
  edges = [],
}: {
  nodeId?: string | null
  nodes?: CanvasNodeLike[]
  edges?: CanvasEdgeLike[]
}): UpstreamImageReference[] {
  const currentNodeId = trimText(nodeId)
  if (!currentNodeId || nodes.length === 0 || edges.length === 0) return []

  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const refs: UpstreamImageReference[] = []
  const seenAsset = new Set<string>()
  const seenSource = new Set<string>()

  for (const edge of edges) {
    if (edge.target !== currentNodeId) continue
    const sourceId = trimText(edge.source)
    if (!sourceId || seenSource.has(sourceId)) continue
    seenSource.add(sourceId)

    const sourceNode = nodeById.get(sourceId)
    const sourceType = trimText(sourceNode?.type).toLowerCase()
    if (sourceType !== 'image') continue

    const assetId = extractImageNodeAssetId(sourceNode?.data)
    if (!assetId || seenAsset.has(assetId)) continue
    seenAsset.add(assetId)

    refs.push({
      nodeId: sourceId,
      assetId,
      title: trimText(sourceNode?.data?.title) || '图片节点',
    })
  }

  return refs
}

export function getUpstreamImageAssetIds(options: {
  nodeId?: string | null
  nodes?: CanvasNodeLike[]
  edges?: CanvasEdgeLike[]
}): string[] {
  return getUpstreamImageReferences(options).map((ref) => ref.assetId)
}
