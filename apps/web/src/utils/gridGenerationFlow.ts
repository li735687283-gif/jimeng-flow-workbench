// 即梦 Flow 前端 - 宫格生成流程
// 从宫格派生节点（canvasStore.createGridImageNode 创建）读取 data，
// 发起一次图生图生成并把结果写回该节点。
//
// 两个关键约束：
// 1. 订阅必须登记到 trackExternalGenerationSubscription，
//    否则 ImageNode 的恢复订阅会对同一任务形成双重订阅，
//    把 onComplete 写入的 success 覆盖回 running（进度条永不停）。
// 2. 图生图实际产出比例由 provider 决定，常与源图不同；
//    结果落地后必须实测原图尺寸写回 width/height，否则节点外框比例错误。

import type { GenerationRequest } from '@jimeng-flow/shared/generateNode'
import { appendImageGenerationRun } from '@jimeng-flow/shared/generateNode'
import {
  createGeneration,
  getGeneration,
  subscribeGeneration,
} from '../api/generations'
import { getAssetFileUrl } from '../api/assets'
import { useCanvasStore } from '../state/canvasStore'
import { useFlowStore } from '../state/flowStore'
import { useGenerationDefaultsStore } from '../state/generationDefaultsStore'
import type { BaseNodeData } from '../types/nodeTypes'
import { getImageDimensionsByRatio } from './agentGenerationPlan'
import { startImageGenerationFlow } from './imageGenerationFlow'
import { buildImageGenerationRunFromResponse } from './imageGenerationHistory'
import { trackExternalGenerationSubscription } from './generationSubscription'

export interface GridGenerationFlowDeps {
  createGenerationImpl?: typeof createGeneration
  getGenerationImpl?: typeof getGeneration
  subscribeGenerationImpl?: typeof subscribeGeneration
  measureImageSizeImpl?: typeof measureImageAssetSize
}

interface GridNodeDataLike {
  prompt?: unknown
  model?: unknown
  ratio?: unknown
  width?: unknown
  height?: unknown
  inputImageAssetIds?: unknown
  generationRuns?: unknown
}

interface ImageSize {
  width: number
  height: number
}

/** 实测结果原图的真实像素尺寸（生成接口不返回尺寸，浏览器加载原图测量） */
export function measureImageAssetSize(assetId: string): Promise<ImageSize | null> {
  if (typeof Image === 'undefined') return Promise.resolve(null)
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const { naturalWidth: width, naturalHeight: height } = img
      resolve(width > 0 && height > 0 ? { width, height } : null)
    }
    img.onerror = () => resolve(null)
    img.src = getAssetFileUrl(assetId)
  })
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && !!item)
    : []
}

/**
 * 启动宫格生成：节点 data 里的 prompt / inputImageAssetIds 已由
 * createGridImageNode 写好，这里只负责发任务、订阅状态、写回结果。
 * 返回的 Promise 在生成收尾（成功或失败）后 resolve。
 */
export async function startGridGeneration(
  nodeId: string,
  deps: GridGenerationFlowDeps = {},
): Promise<void> {
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

  // 比例优先取节点 ratio；源节点未存 ratio 时用其实际宽高推导，避免默认 1:1 方图
  const dataWidth = typeof data.width === 'number' ? data.width : 0
  const dataHeight = typeof data.height === 'number' ? data.height : 0
  const ratio =
    typeof data.ratio === 'string' && data.ratio
      ? data.ratio
      : dataWidth > 0 && dataHeight > 0
        ? `${dataWidth}:${dataHeight}`
        : '1:1'
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

  const measureImageSize = deps.measureImageSizeImpl ?? measureImageAssetSize

  return new Promise<void>((resolve) => {
    let untrack: () => void = () => undefined
    const settle = () => {
      untrack()
      resolve()
    }

    const flow = startImageGenerationFlow(
      request,
      {
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
          // 结果落地后实测真实尺寸，校准节点外框与宫格切分坐标
          let dimensions: ImageSize | null = null
          if (!failedMessage && outputAssetIds[0]) {
            dimensions = await measureImageSize(outputAssetIds[0])
          }
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
            ...(dimensions ?? {}),
            generationRuns: appendImageGenerationRun(latestRuns, generationRun),
            updatedAt: new Date().toISOString(),
          } as unknown as Partial<BaseNodeData>)
          try {
            await useFlowStore.getState().saveCurrent()
          } catch (saveError) {
            console.warn('[gridGenerationFlow] save grid result failed', saveError)
          }
          settle()
        },
        onError: (message) => {
          fail(message)
          settle()
        },
      },
      {
        createGenerationImpl: deps.createGenerationImpl,
        getGenerationImpl: deps.getGenerationImpl,
        subscribeGenerationImpl: deps.subscribeGenerationImpl,
      },
    )
    untrack = trackExternalGenerationSubscription(nodeId, flow.cancel)
  })
}
