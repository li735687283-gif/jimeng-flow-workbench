import type { GenerationResponse } from '@jimeng-flow/shared/generateNode'
import type { BaseNodeData } from '../types/nodeTypes'
import { subscribeGeneration } from '../api/generations'
import { useCanvasStore } from '../state/canvasStore'
import { getCurrentFlowId, useFlowStore } from '../state/flowStore'
import { useGenerateStore } from '../state/generateStore'

interface ResumeOptions {
  nodeId: string
  generationId: string
}

/**
 * 页面刷新后恢复正在进行的生成任务订阅。
 *
 * 刷新后 generateStore 中的 callState 丢失，但 flow 文件中节点 status 仍为 running/queued。
 * 后端任务继续执行，完成后会把结果写回 flow 文件。
 * 此函数重新订阅 SSE，收到进度更新时只刷新 status，收到终态时重新加载 flow
 * 以获取后端写回的完整结果（assetIds、generationRuns 等）。
 */
export function resumeGenerationSubscription({
  nodeId,
  generationId,
}: ResumeOptions): () => void {
  const patchProgress = (response: GenerationResponse) => {
    useCanvasStore.getState().updateNodeData(nodeId, {
      status: response.status,
      error: response.error,
      generationId: response.id,
      updatedAt: new Date().toISOString(),
    } as unknown as Partial<BaseNodeData>)
    useGenerateStore.getState().patch(nodeId, {
      status: response.status,
      error: response.error,
      generationId: response.id,
    })
  }

  const handleTerminal = async () => {
    const flowId = getCurrentFlowId()
    if (flowId) {
      try {
        await useFlowStore.getState().loadFlow(flowId)
      } catch {
        // 重新加载失败时降级：只更新状态为 error
        useCanvasStore.getState().updateNodeData(nodeId, {
          status: 'error',
          error: '生成已完成，但刷新画布失败，请手动刷新页面',
          updatedAt: new Date().toISOString(),
        } as unknown as Partial<BaseNodeData>)
        useGenerateStore.getState().patch(nodeId, {
          status: 'error',
          error: '生成已完成，但刷新画布失败，请手动刷新页面',
        })
      }
    }
  }

  const unsubscribe = subscribeGeneration(generationId, {
    onUpdate: (data) => {
      if (data.status !== 'success' && data.status !== 'error') {
        patchProgress(data)
      }
    },
    onComplete: (data) => {
      // 后端已经把结果写回 flow 文件，重新加载以获取完整结果
      if (data.status === 'success' || data.status === 'error') {
        void handleTerminal()
      }
    },
    onError: () => {
      // SSE 连接错误，标记为 error 让用户知道需要重试
      useCanvasStore.getState().updateNodeData(nodeId, {
        status: 'error',
        error: '生成任务连接中断，请重试',
        updatedAt: new Date().toISOString(),
      } as unknown as Partial<BaseNodeData>)
      useGenerateStore.getState().patch(nodeId, {
        status: 'error',
        error: '生成任务连接中断，请重试',
      })
    },
  })

  return unsubscribe
}
