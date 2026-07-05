// 即梦 Flow 前端 - Agent 状态 store
// 管理 Agent 面板的对话状态（messages/loading/error/lastResponse）。
// 参考 textNodeStore 的 per-node store 模式。
// 参考 PRD 8.8（Agent 面板）、8.7（Agent 输出结构）、12.2（错误处理）。

import { create } from 'zustand'
import type {
  PromptOptimizeResponse,
  AgentMessage,
  AgentRole,
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
    role?: AgentRole
  }

  /** 当前 Agent 角色模式 */
  role: AgentRole

  /** 同一会话内的对话上下文记忆（用于引用"那张图"、"刚才的"等） */
  conversationContext: {
    /** 最近一次生成操作的类型 */
    lastActionType?: 'image' | 'video' | 'text'
    /** 最近一次生成的节点 id */
    lastGeneratedNodeIds?: string[]
    /** 最近一次生成的 assetIds */
    lastGeneratedAssetIds?: string[]
    /** 最近一次使用的提示词 */
    lastPrompt?: string
    /** 最近一次使用的参数 */
    lastParams?: Record<string, unknown>
    /** 已锁定的参考图 assetId（用于风格一致性） */
    referenceAssetId?: string
  }

  /** 提交 Prompt 优化请求（不实际调用 API，仅记录请求参数；API 调用在组件中完成） */
  submitPrompt: (params: {
    userIdea: string
    contextNodeIds?: string[]
    selectedNodeId?: string
    targetPromptNodeId?: string
    role?: AgentRole
  }) => AgentMessage

  /** 追加 assistant 消息并保存响应 */
  appendAssistant: (response: PromptOptimizeResponse) => void

  /** 设置 loading */
  setLoading: (loading: boolean) => void

  /** 设置错误 */
  setError: (error?: string) => void

  /** 设置角色 */
  setRole: (role: AgentRole) => void

  /** 更新对话上下文 */
  setConversationContext: (ctx: Partial<AgentStore['conversationContext']>) => void

  /** 重置全部状态 */
  reset: () => void
}

let msgSeq = 0
function nextId(): string {
  msgSeq += 1
  return `agent_msg_${Date.now()}_${msgSeq}`
}

export const useAgentStore = create<AgentStore>((set, get) => ({
  messages: [],
  loading: false,
  error: undefined,
  lastResponse: undefined,
  lastRequest: undefined,
  role: (typeof window !== 'undefined' && localStorage.getItem('agentRole') as AgentRole) || 'general',
  conversationContext: {},

  submitPrompt: ({ userIdea, contextNodeIds, selectedNodeId, targetPromptNodeId, role }) => {
    const currentRole = role || get().role
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
        role: currentRole,
      },
    }))
    return userMsg
  },

  appendAssistant: (response) => {
    const assistantMsg: AgentMessage = {
      id: nextId(),
      role: 'assistant',
      content: response.reasoning,
      thinking: response.thinking,
      intent: response.intent,
      suggestedParams: response.suggestedParams,
      storyboard: response.storyboard,
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

  setRole: (role) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('agentRole', role)
    }
    set({ role })
  },

  setConversationContext: (ctx) =>
    set((state) => ({
      conversationContext: { ...state.conversationContext, ...ctx },
    })),

  reset: () =>
    set((state) => ({
      messages: [],
      loading: false,
      error: undefined,
      lastResponse: undefined,
      lastRequest: undefined,
      conversationContext: {},
      // role 不被重置，保持用户的选择
      role: state.role,
    })),
}))

