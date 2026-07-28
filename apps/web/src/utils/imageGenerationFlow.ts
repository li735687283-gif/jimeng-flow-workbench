// 即梦 Flow 前端 - 图片生成生命周期编排
// 后端 /api/generations 是异步的：createGeneration 立刻返回 queued 状态，
// 真正的生成在后台跑，结果通过 SSE 推送；断线后由统一订阅器轮询恢复。

import {
  createGeneration,
  getGeneration,
  subscribeGeneration,
} from '../api/generations'
import type {
  GenerationRequest,
  GenerationResponse,
} from '@jimeng-flow/shared/generateNode'
import { subscribeGenerationWithFallback } from './generationStatusSubscription'

export interface ImageGenerationFlowCallbacks {
  /** 后端已接受异步任务 */
  onQueued?: (response: GenerationResponse) => void
  /** 生成进行中（queued / running），用于进度/状态刷新 */
  onUpdate?: (response: GenerationResponse) => void
  /** 生成完成（success / error），用于回填节点 */
  onComplete?: (response: GenerationResponse) => void
  /** 创建请求失败，或状态追踪最终超时 */
  onError?: (message: string) => void
}

export interface ImageGenerationFlowHandle {
  /** 取消当前订阅（不会中止后端生成，只停止前端监听） */
  cancel: () => void
}

export interface ImageGenerationFlowDeps {
  createGenerationImpl?: typeof createGeneration
  getGenerationImpl?: typeof getGeneration
  subscribeGenerationImpl?: typeof subscribeGeneration
  pollIntervalMs?: number
  maxPollAttempts?: number
  maxWaitMs?: number
}

/**
 * 启动一次图片生成并可靠追踪其状态。
 * - 若后端同步返回终态，直接回调 onComplete。
 * - 若返回 queued/running，优先订阅 SSE；断线后轮询到终态。
 */
export function startImageGenerationFlow(
  request: GenerationRequest,
  callbacks: ImageGenerationFlowCallbacks = {},
  deps: ImageGenerationFlowDeps = {},
): ImageGenerationFlowHandle {
  const createGen = deps.createGenerationImpl ?? createGeneration
  let unsubscribe: (() => void) | null = null
  let settled = false

  const finish = () => {
    if (!unsubscribe) return
    const cancel = unsubscribe
    unsubscribe = null
    cancel()
  }

  const complete = (response: GenerationResponse) => {
    if (settled) return
    settled = true
    finish()
    callbacks.onComplete?.(response)
  }

  const fail = (message: string) => {
    if (settled) return
    settled = true
    finish()
    callbacks.onError?.(message)
  }

  void (async () => {
    try {
      const response = await createGen(request)
      if (response.status === 'success' || response.status === 'error') {
        complete(response)
        return
      }

      callbacks.onQueued?.(response)
      const cancelSubscription = subscribeGenerationWithFallback(
        response.id,
        {
          onUpdate: (data) => {
            if (data.status !== 'success' && data.status !== 'error') {
              callbacks.onUpdate?.(data)
            }
          },
          onComplete: complete,
          onError: fail,
        },
        {
          getGenerationImpl: deps.getGenerationImpl,
          subscribeGenerationImpl: deps.subscribeGenerationImpl,
          pollIntervalMs: deps.pollIntervalMs,
          maxPollAttempts: deps.maxPollAttempts,
          maxWaitMs: deps.maxWaitMs,
        },
      )
      if (settled) {
        cancelSubscription()
      } else {
        unsubscribe = cancelSubscription
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      fail(message)
    }
  })()

  return {
    cancel: () => {
      settled = true
      finish()
    },
  }
}
