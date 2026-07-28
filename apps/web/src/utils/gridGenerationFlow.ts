// 即梦 Flow 前端 - 宫格生成流程
// 从宫格派生节点（canvasStore.createGridImageNode 创建）读取 data，
// 发起一次图生图生成并把结果写回该节点。

import type { GenerationRequest } from '@jimeng-flow/shared/generateNode'
import { appendImageGenerationRun } from '@jimeng-flow/shared/generateNode'
import { useCanvasStore } from '../state/canvasStore'
import { useFlowStore } from '../state/flowStore'
import { useGenerationDefaultsStore } from '../state/generationDefaultsStore'
import type { BaseNodeData } from '../types/nodeTypes'
import { getImageDimensionsByRatio } from './agentGenerationPlan'
import { startImageGenerationFlow } from './imageGenerationFlow'
import { buildImageGenerationRunFromResponse } from './imageGenerationHistory'

interface GridNodeDataLike {
  prompt?: unknown
  model?: unknown
  ratio?: unknown
  inputImageAssetIds?: unknown
  generationRuns?: BaseNodeData['generationRuns']
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && !!item)
    : []
}

/**
 * 启动宫格生成：节点 data 里的 prompt / inputImageAssetIds 已由
 * createGridImageNode 写好，这里只负责发任务、订阅状态、写回结果。
 */
export async function startGridGeneration(nodeId: string): Promise<void> {
  const store = useCanvasStore.getState()
  const node = store.nodes.find((item) => item.id === nodeId)
  const data = (node?.data ?? {}) as GridNodeDataLike
  const prompt = typeof data.prompt === 'string' ? data.prompt.trim() : ''
  const inputImages = asStringArray(data.inputImageAssetIds)

  const fail = (message: string) => {
    useCanvasStore.getState().updateNodeData(nodeId, {
      status: 'error',
      error: message,
      updatedAt: new Date().toISOString(),
    } as unknown as Partial<BaseNodeData>)
    void useFlowStore.getState().saveCurrent().catch(() => undefined)
  }

  if (!node) return
  if (!prompt || inputImages.length === 0) {
    fail('宫格生成缺少源图片或提示词，请重新从源图发起宫格生成')
    return
  }

  let flowId = ''
  try {
    flowId = await useFlowStore.getState().ensureCurrentFlow()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    fail(`工作流准备失败：${message}`)
    return
  }

  const ratio = typeof data.ratio === 'string' && data.ratio ? data.ratio : '1:1'
  const size = getImageDimensionsByRatio(ratio, '4K')
  const rememberedModel = useGenerationDefaultsStore.getState().image?.model
  const nodeModel = typeof data.model === 'string' ? data.model.trim() : ''
  const request: GenerationRequest = {
    flowId: flowId ?? 'local',
    nodeId,
    mediaType: 'image',
    prompt,
    inputImages,
    // 节点未指定模型时沿用记忆默认值，兜底交给服务端默认模型
    model: nodeModel || rememberedModel || '',
    width: size.width,
    height: size.height,
    count: 1,
    seed: null,
  }

  try {
    await useFlowStore.getState().saveCurrent()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    fail(`生成前保存节点失败：${message}`)
    return
  }

  startImageGenerationFlow(request, {
    onQueued: (response) => {
      useCanvasStore.getState().updateNodeData(nodeId, {
        status: response.status,
        generationId: response.id,
        error: response.error,
        updatedAt: new Date().toISOString(),
      } as unknown as Partial<BaseNodeData>)
      void useFlowStore.getState().saveCurrent().catch(() => undefined)
    },
    onComplete: async (response) => {
      const results = response.results ?? []
      const outputAssetIds = results
        .map((result) => result.assetId)
        .filter((assetId): assetId is string => !!assetId)
      const failedMessage =
        response.status === 'error'
          ? response.error || '宫格生成失败，请稍后重试'
          : outputAssetIds.length === 0
            ? response.error || '宫格生成完成，但没有返回可上图的图片'
            : ''
      const latestNode = useCanvasStore
        .getState()
        .nodes.find((item) => item.id === nodeId)
      const latestRuns = (latestNode?.data as GridNodeDataLike | undefined)
        ?.generationRuns
      const generationRun = buildImageGenerationRunFromResponse(
        response,
        request,
        {
          ratio,
          resolution: '4K',
          inputImageAssetIds: inputImages,
        },
      )
      useCanvasStore.getState().updateNodeData(nodeId, {
        status: failedMessage ? 'error' : 'success',
        error: failedMessage || undefined,
        assetId: outputAssetIds[0],
        outputAssetIds,
        generationId: response.id,
        generationRuns: appendImageGenerationRun(latestRuns, generationRun),
        updatedAt: new Date().toISOString(),
      } as unknown as Partial<BaseNodeData>)
      try {
        await useFlowStore.getState().saveCurrent()
      } catch (saveError) {
        console.warn('[gridGenerationFlow] save grid result failed', saveError)
      }
    },
    onError: (message) => {
      fail(message)
    },
  })
}
