// 即梦 Flow 前端 - Agent 状态 store
// 管理 Agent 面板的对话状态（messages/loading/error/lastResponse）。
// 参考 textNodeStore 的 per-node store 模式。
// 参考 PRD 8.8（Agent 面板）、8.7（Agent 输出结构）、12.2（错误处理）。

import { create } from 'zustand'
import type {
  PromptOptimizeResponse,
  AgentMessage,
} from '@jimeng-flow/shared/agentMessage'

interface AgentStore {
  /** 对话消息列表（user 与 assistant 交替） */
  messages: AgentMessage[]
  /** 是否正在调用 LLM */
  loading: boolean
  /** 最近一次错误（undefined 表示无错误） */
  error?: string
  /** 最近一次结构化响应（用于展示和写回） */
  lastResponse?: PromptOptimizeResponse
  /** 最近一次请求参数，用于失败后重试 */
  lastRequest?: {
    userIdea: string
    contextNodeIds: string[]
    selectedNodeId?: string
    targetPromptNodeId?: string
  }

  /** 提交 Prompt 优化请求（不实际调用 API，仅记录请求参数；API 调用在组件中完成） */
  submitPrompt: (params: {
    userIdea: string
    contextNodeIds?: string[]
    selectedNodeId?: string
    targetPromptNodeId?: string
  }) => AgentMessage

  /** 追加 assistant 消息并保存响应 */
  appendAssistant: (response: PromptOptimizeResponse) => void

  /** 设置 loading */
  setLoading: (loading: boolean) => void

  /** 设置错误 */
  setError: (error?: string) => void

  /** 重置全部状态 */
  reset: () => void
}

let msgSeq = 0
function nextId(): string {
  msgSeq += 1
  return `agent_msg_${Date.now()}_${msgSeq}`
}

export const useAgentStore = create<AgentStore>((set) => ({
  messages: [],
  loading: false,
  error: undefined,
  lastResponse: undefined,
  lastRequest: undefined,

  submitPrompt: ({ userIdea, contextNodeIds, selectedNodeId, targetPromptNodeId }) => {
    const userMsg: AgentMessage = {
      id: nextId(),
      role: 'user',
      content: userIdea,
      contextNodeIds: contextNodeIds ?? [],
      selectedNodeId,
      createdAt: new Date().toISOString(),
    }
    set((state) => ({
      messages: [...state.messages, userMsg],
      loading: true,
      error: undefined,
      lastRequest: {
        userIdea,
        contextNodeIds: contextNodeIds ?? [],
        selectedNodeId,
        targetPromptNodeId,
      },
    }))
    return userMsg
  },

  appendAssistant: (response) => {
    const assistantMsg: AgentMessage = {
      id: nextId(),
      role: 'assistant',
      content: response.reasoning,
      contextNodeIds: response.usedContextNodeIds,
      optimizedPrompt: response.optimizedPrompt,
      proposedActions: response.proposedActions,
      createdAt: new Date().toISOString(),
    }
    set((state) => ({
      messages: [...state.messages, assistantMsg],
      loading: false,
      error: undefined,
      lastResponse: response,
    }))
  },

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ loading: false, error }),

  reset: () =>
    set({
      messages: [],
      loading: false,
      error: undefined,
      lastResponse: undefined,
      lastRequest: undefined,
    }),
}))
