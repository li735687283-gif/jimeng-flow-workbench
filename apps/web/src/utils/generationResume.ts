import type { GenerationResponse } from '@jimeng-flow/shared/generateNode'
import type { BaseNodeData } from '../types/nodeTypes'
import type { GenerateCallState } from '../state/generateStore'
import { subscribeGenerationWithFallback } from './generationStatusSubscription'
import { useCanvasStore } from '../state/canvasStore'
import { getCurrentFlowId, useFlowStore } from '../state/flowStore'
import { useGenerateStore } from '../state/generateStore'

interface ResumeOptions {
  nodeId: string
  generationId: string
}

interface GenerationResumeOwner {
  nodeId: string
  flowId: string
}

interface GenerationResumeDeps {
  getCurrentFlowId: () => string | null
  loadFlow: (flowId: string) => Promise<unknown>
  updateNodeData: (nodeId: string, patch: Partial<BaseNodeData>) => void
  patchGenerateState: (
    nodeId: string,
    patch: Partial<GenerateCallState>,
  ) => void
  resetGenerateState: (nodeId: string) => void
  saveCurrent: () => Promise<unknown>
  now: () => string
}

export interface GenerationResumeCallbacks {
  onUpdate: (response: GenerationResponse) => void
  onComplete: (response: GenerationResponse) => Promise<void>
  onError: (error: string) => void
}

const REFRESH_FAILURE_MESSAGE = '生成已完成，但刷新画布失败，请手动刷新页面'

export function createGenerationResumeCallbacks(
  { nodeId, flowId }: GenerationResumeOwner,
  deps: GenerationResumeDeps,
): GenerationResumeCallbacks {
  const isOwnerActive = () => deps.getCurrentFlowId() === flowId

  const patchError = (message: string) => {
    deps.updateNodeData(nodeId, {
      status: 'error',
      error: message,
      updatedAt: deps.now(),
    })
    deps.patchGenerateState(nodeId, {
      status: 'error',
      error: message,
    })
  }

  return {
    onUpdate: (response) => {
      if (!isOwnerActive()) return
      if (response.status === 'success' || response.status === 'error') return
      deps.updateNodeData(nodeId, {
        status: response.status,
        error: response.error,
        generationId: response.id,
        updatedAt: deps.now(),
      })
      deps.patchGenerateState(nodeId, {
        status: response.status,
        error: response.error,
        generationId: response.id,
      })
    },
    onComplete: async (response) => {
      if (response.status !== 'success' && response.status !== 'error') return
      if (!isOwnerActive()) return
      try {
        await deps.loadFlow(flowId)
        if (!isOwnerActive()) return
        deps.resetGenerateState(nodeId)
      } catch {
        if (!isOwnerActive()) return
        patchError(REFRESH_FAILURE_MESSAGE)
        void deps.saveCurrent().catch(() => undefined)
      }
    },
    onError: (error) => {
      if (!isOwnerActive()) return
      const message = error || '生成任务连接中断，请重试'
      patchError(message)
      void deps.saveCurrent().catch(() => undefined)
    },
  }
}

/**
 * 页面刷新后恢复正在进行的生成任务订阅。
 *
 * 刷新后 generateStore 中的 callState 丢失，但 flow 文件中节点 status 仍为 running/queued。
 * 后端任务继续执行，完成后会把结果写回 flow 文件。
 */
export function resumeGenerationSubscription({
  nodeId,
  generationId,
}: ResumeOptions): () => void {
  const flowId = getCurrentFlowId()
  if (!flowId) return () => undefined

  const callbacks = createGenerationResumeCallbacks(
    { nodeId, flowId },
    {
      getCurrentFlowId,
      loadFlow: async (ownerFlowId) => {
        await useFlowStore.getState().loadFlow(ownerFlowId, { mode: 'refresh' })
      },
      updateNodeData: (ownerNodeId, patch) => {
        useCanvasStore.getState().updateNodeData(ownerNodeId, patch)
      },
      patchGenerateState: (ownerNodeId, patch) => {
        useGenerateStore.getState().patch(ownerNodeId, patch)
      },
      resetGenerateState: (ownerNodeId) => {
        useGenerateStore.getState().reset(ownerNodeId)
      },
      saveCurrent: async () => {
        await useFlowStore.getState().saveCurrent()
      },
      now: () => new Date().toISOString(),
    },
  )

  return subscribeGenerationWithFallback(generationId, {
    onUpdate: callbacks.onUpdate,
    onComplete: (response) => {
      void callbacks.onComplete(response)
    },
    onError: callbacks.onError,
  })
}
