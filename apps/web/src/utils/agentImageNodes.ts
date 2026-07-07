import { shouldRequireJimengCliForImageModel } from './imageModels'

export interface AgentImageResultLike {
  assetId?: string | null
}

export interface AgentCreatedImageNodes {
  assetIds: string[]
  nodeIds: string[]
}

export function createAgentImageNodeRecords(
  results: AgentImageResultLike[],
  createNode: (assetId: string, index: number) => string | null | undefined,
): AgentCreatedImageNodes {
  const assetIds: string[] = []
  const nodeIds: string[] = []

  results.forEach((result, index) => {
    const assetId = typeof result.assetId === 'string' ? result.assetId.trim() : ''
    if (!assetId) return

    assetIds.push(assetId)
    const nodeId = createNode(assetId, index)
    const trimmedNodeId = typeof nodeId === 'string' ? nodeId.trim() : ''
    if (trimmedNodeId) nodeIds.push(trimmedNodeId)
  })

  return { assetIds, nodeIds }
}

export function shouldBlockAgentImageEditGeneration(
  modelId: string,
  isJimengConfigured: boolean,
): boolean {
  return shouldRequireJimengCliForImageModel(modelId) && !isJimengConfigured
}
