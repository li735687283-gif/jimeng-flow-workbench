import type { Asset } from '@jimeng-flow/shared/asset'
import type { ImageGenerationRun } from '@jimeng-flow/shared/generateNode'
import { normalizeImageGenerationRuns } from '@jimeng-flow/shared/generateNode'
import {
  normalizeVideoGenerationRuns,
  type VideoGenerationRun,
} from '@jimeng-flow/shared/videoNode'
import type { BaseNodeData, FlowNodeType, NodeStatus } from '../types/nodeTypes'
import { getEditorStateFromVideoGenerationHistoryItem } from './videoGenerationHistory'

export function resolveAssetSourceNodeId(
  asset: Asset,
  nodeIds: string[],
): string | null {
  const sourceNodeId = asset.sourceNodeId?.trim()
  if (!sourceNodeId) return null
  return nodeIds.includes(sourceNodeId) ? sourceNodeId : null
}

interface AssetRestoreNode {
  id: string
  type?: string | null
  data?: Partial<BaseNodeData> | null
}

type AssetRestorePatch = Partial<BaseNodeData>

export function buildAssetInsertPatch(asset: Asset): AssetRestorePatch {
  const prompt = asset.prompt?.trim()
  const common = {
    status: 'success' as NodeStatus,
    ...(prompt ? { prompt } : {}),
  }

  if (asset.type === 'video') {
    return {
      ...common,
      assetIds: [asset.id],
    }
  }

  return {
    ...common,
    assetId: asset.id,
    outputAssetIds: [asset.id],
  }
}

function rotateAssetFirst(assetId: string, assetIds: unknown): string[] {
  const existing = Array.isArray(assetIds)
    ? assetIds.filter(
        (item): item is string => typeof item === 'string' && item.length > 0,
      )
    : []
  return [assetId, ...existing.filter((item) => item !== assetId)]
}

function toNodeStatus(status: ImageGenerationRun['status']): NodeStatus {
  if (status === 'error') return 'error'
  if (status === 'idle') return 'idle'
  if (status === 'queued' || status === 'running') return 'running'
  return 'success'
}

function findVideoRun(
  assetId: string,
  generationRuns: unknown,
): VideoGenerationRun | null {
  return (
    normalizeVideoGenerationRuns(generationRuns).find((run) =>
      run.assetIds.includes(assetId),
    ) ?? null
  )
}

function findImageRun(
  assetId: string,
  generationRuns: unknown,
): ImageGenerationRun | null {
  return (
    normalizeImageGenerationRuns(generationRuns).find((run) =>
      run.assetIds.includes(assetId),
    ) ?? null
  )
}

function buildImageRestorePatch(
  asset: Asset,
  node: AssetRestoreNode,
  updatedAt: string,
): AssetRestorePatch {
  const data = node.data ?? {}
  const run = findImageRun(asset.id, data.generationRuns)

  if (!run) {
    return {
      assetId: asset.id,
      outputAssetIds: rotateAssetFirst(asset.id, data.outputAssetIds),
      status: 'success',
      error: undefined,
      updatedAt,
    }
  }

  return {
    assetId: asset.id,
    outputAssetIds: rotateAssetFirst(asset.id, run.assetIds),
    generationId: run.generationId,
    prompt: run.prompt,
    model: run.model,
    width: run.width,
    height: run.height,
    count: run.count,
    seed: run.seed ?? null,
    quality: run.quality,
    ratio: run.ratio,
    resolution: run.resolution,
    inputImageAssetIds: run.inputImageAssetIds,
    status: toNodeStatus(run.status),
    error: run.error,
    updatedAt,
  }
}

function buildVideoRestorePatch(
  asset: Asset,
  node: AssetRestoreNode,
  updatedAt: string,
): AssetRestorePatch {
  const data = node.data ?? {}
  const run = findVideoRun(asset.id, data.generationRuns)

  if (!run) {
    return {
      assetIds: rotateAssetFirst(asset.id, data.assetIds),
      status: 'success',
      error: undefined,
      updatedAt,
    }
  }

  const assetIndex = run.assetIds.indexOf(asset.id)
  const state = getEditorStateFromVideoGenerationHistoryItem({
    run,
    assetId: asset.id,
    assetIndex,
  })

  return {
    ...state,
    generationId: run.generationId,
    status: toNodeStatus(run.status),
    error: run.error,
    updatedAt,
  }
}

export function buildAssetRestorePatch(
  asset: Asset,
  node: AssetRestoreNode,
  updatedAt = new Date().toISOString(),
): AssetRestorePatch | null {
  if (asset.sourceNodeId !== node.id) return null

  const nodeType = node.type as FlowNodeType | undefined
  if (asset.type === 'image' && nodeType === 'image') {
    return buildImageRestorePatch(asset, node, updatedAt)
  }
  if (asset.type === 'video' && nodeType === 'video') {
    return buildVideoRestorePatch(asset, node, updatedAt)
  }
  return null
}
