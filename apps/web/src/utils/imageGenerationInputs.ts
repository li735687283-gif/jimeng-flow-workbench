interface ImageGenerationInputOptions {
  assetId?: string | null
  modelId: string
  nodeId?: string | null
  nodes?: ImageGenerationInputNode[]
  edges?: ImageGenerationInputEdge[]
}

interface ImageGenerationInputNode {
  id: string
  type?: string | null
  data?: {
    assetId?: unknown
  } | null
}

interface ImageGenerationInputEdge {
  source?: string | null
  target?: string | null
}

function getTrimmedAssetId(assetId: unknown): string {
  return typeof assetId === 'string' ? assetId.trim() : ''
}

function collectUpstreamImageAssetIds({
  nodeId,
  nodes = [],
  edges = [],
}: Pick<ImageGenerationInputOptions, 'nodeId' | 'nodes' | 'edges'>): string[] {
  const currentNodeId = typeof nodeId === 'string' ? nodeId.trim() : ''
  if (!currentNodeId || nodes.length === 0 || edges.length === 0) return []

  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const incomingByTarget = new Map<string, ImageGenerationInputEdge[]>()
  for (const edge of edges) {
    const targetId = typeof edge.target === 'string' ? edge.target : ''
    if (!targetId) continue
    const incoming = incomingByTarget.get(targetId) ?? []
    incoming.push(edge)
    incomingByTarget.set(targetId, incoming)
  }

  const assetIds: string[] = []
  const visited = new Set([currentNodeId])
  const walk = (targetId: string) => {
    for (const edge of incomingByTarget.get(targetId) ?? []) {
      const sourceId = typeof edge.source === 'string' ? edge.source : ''
      if (!sourceId || visited.has(sourceId)) continue
      visited.add(sourceId)
      walk(sourceId)

      const sourceNode = nodeById.get(sourceId)
      if (sourceNode?.type !== 'image') continue
      const sourceAssetId = getTrimmedAssetId(sourceNode.data?.assetId)
      if (sourceAssetId) assetIds.push(sourceAssetId)
    }
  }
  walk(currentNodeId)
  return assetIds
}

export function getImageGenerationInputImages({
  assetId,
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

  pushUnique(assetId)
  for (const upstreamAssetId of collectUpstreamImageAssetIds({ nodeId, nodes, edges })) {
    pushUnique(upstreamAssetId)
  }

  return inputImages
}
