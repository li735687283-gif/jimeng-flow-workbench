// 即梦 Flow 前端 - 图片生成生命周期编排
// 后端 /api/generations 是异步的：createGeneration 立刻返回 queued 状态，
// 真正的生成在后台跑，结果（含成功/失败）通过 SSE（/api/generations/:id/sse）推送。
// 图片节点之前只读同步返回的空结果，导致「点击发送没反应 / 没有错误提示」。
// 这里把「创建 + 订阅 SSE + 完成回填」封装成可复用的生命周期，
// 与 VideoComposer 的订阅模式保持一致。
// 参考 P0 任务 2（回填当前节点）/ 任务 3（第三方模型无响应、错误要透传）。

import {
  createGeneration,
  subscribeGeneration,
} from '../api/generations'
import type {
  GenerationRequest,
  GenerationResponse,
} from '@jimeng-flow/shared/generateNode'

export interface ImageGenerationFlowCallbacks {
  /** 后端已同步返回终态（罕见，一般为同步错误） */
  onQueued?: (response: GenerationResponse) => void
  /** 生成进行中（running），用于进度/状态刷新 */
  onUpdate?: (response: GenerationResponse) => void
  /** 生成完成（success / error），用于回填节点 */
  onComplete?: (response: GenerationResponse) => void
  /** SSE 连接错误或请求异常 */
  onError?: (message: string) => void
}

export interface ImageGenerationFlowHandle {
  /** 取消当前订阅（注意：不会中止后端生成，只停止前端监听） */
  cancel: () => void
}

export interface ImageGenerationFlowDeps {
  createGenerationImpl?: typeof createGeneration
  subscribeGenerationImpl?: typeof subscribeGeneration
}

/**
 * 启动一次图片生成并订阅其状态。
 * - 若后端同步返回终态（success/error），直接回调 onComplete。
 * - 若返回 queued/running，则订阅 SSE，待 onComplete 时回填。
 * 任意异常都会通过 onError 透传，保证「不会无响应、错误清晰可见」。
 */
export function startImageGenerationFlow(
  request: GenerationRequest,
  callbacks: ImageGenerationFlowCallbacks = {},
  deps: ImageGenerationFlowDeps = {},
): ImageGenerationFlowHandle {
  const createGen = deps.createGenerationImpl ?? createGeneration
  const subscribe = deps.subscribeGenerationImpl ?? subscribeGeneration
  let unsubscribe: (() => void) | null = null

  const finish = () => {
    if (unsubscribe) {
      unsubscribe()
      unsubscribe = null
    }
  }

  void (async () => {
    try {
      const response = await createGen(request)
      if (response.status === 'success' || response.status === 'error') {
        callbacks.onComplete?.(response)
        return
      }
      callbacks.onQueued?.(response)
      unsubscribe = subscribe(response.id, {
        onUpdate: (data) => {
          if (data.status !== 'success' && data.status !== 'error') {
            callbacks.onUpdate?.(data)
          }
        },
        onComplete: (data) => {
          finish()
          callbacks.onComplete?.(data)
        },
        onError: (error) => {
          finish()
          callbacks.onError?.(error)
        },
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      callbacks.onError?.(message)
    }
  })()

  return { cancel: finish }
}
