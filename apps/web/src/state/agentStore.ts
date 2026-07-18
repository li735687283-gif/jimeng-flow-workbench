// 即梦 Flow 前端 - Agent 状态 store
// 管理 Agent 面板的多对话状态与独立上下文记忆。

import { create } from 'zustand'
import type {
  PromptOptimizeResponse,
  AgentMessage,
  AgentRole,
} from '@jimeng-flow/shared/agentMessage'

export interface AgentConversationContext {
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

export interface AgentGenerationResult {
  id: string
  assetId?: string
  url?: string
  type: 'image' | 'video'
  prompt?: string
  timestamp: string
}

interface AgentRequestSnapshot {
  userIdea: string
  contextNodeIds: string[]
  selectedNodeId?: string
  targetPromptNodeId?: string
  role?: AgentRole
}

export interface AgentConversation {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  messages: AgentMessage[]
  lastResponse?: PromptOptimizeResponse
  lastRequest?: AgentRequestSnapshot
  conversationContext: AgentConversationContext
  generationResults: AgentGenerationResult[]
}

interface AgentStore {
  activeConversationId: string
  conversations: AgentConversation[]
  newConversation: () => string
  openConversation: (conversationId: string) => void
  deleteConversation: (conversationId: string) => void

  /** 对话消息列表（user 与 assistant 交替） */
  messages: AgentMessage[]
  /** 是否正在调用 LLM */
  loading: boolean
  /** 最近一次错误（undefined 表示无错误） */
  error?: string
  /** 最近一次结构化响应（用于展示和写回） */
  lastResponse?: PromptOptimizeResponse
  /** 最近一次请求参数，用于失败后重试 */
  lastRequest?: AgentRequestSnapshot

  /** 当前 Agent 角色模式 */
  role: AgentRole
  /** 同一会话内的对话上下文记忆 */
  conversationContext: AgentConversationContext

  submitPrompt: (params: {
    userIdea: string
    contextNodeIds?: string[]
    selectedNodeId?: string
    targetPromptNodeId?: string
    role?: AgentRole
  }) => AgentMessage
  appendAssistant: (response: PromptOptimizeResponse) => void
  setLoading: (loading: boolean) => void
  setError: (error?: string) => void
  setRole: (role: AgentRole) => void
  setConversationContext: (ctx: Partial<AgentConversationContext>) => void

  generationResults: AgentGenerationResult[]
  addGenerationResult: (result: {
    assetId?: string
    url?: string
    type: 'image' | 'video'
    prompt?: string
  }) => void
  clearGenerationResults: () => void
  reset: () => void
}

const CONVERSATION_STORAGE_KEY = 'jimeng-flow-agent-conversations-v1'
const DEFAULT_CONVERSATION_TITLE = '新对话'

let msgSeq = 0
function nextId(): string {
  msgSeq += 1
  return 'agent_msg_' + Date.now() + '_' + msgSeq
}

function nextConversationId(): string {
  return 'agent_conversation_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
}

function createConversation(): AgentConversation {
  const timestamp = new Date().toISOString()
  return {
    id: nextConversationId(),
    title: DEFAULT_CONVERSATION_TITLE,
    createdAt: timestamp,
    updatedAt: timestamp,
    messages: [],
    conversationContext: {},
    generationResults: [],
  }
}

function titleFromMessages(messages: AgentMessage[]): string {
  const firstUserMessage = messages.find((message) => message.role === 'user')
  const content = firstUserMessage?.content.replace(/\s+/g, ' ').trim()
  if (!content) return DEFAULT_CONVERSATION_TITLE
  return content.length > 24 ? content.slice(0, 24) + '…' : content
}

function loadConversations(): {
  activeConversationId: string
  conversations: AgentConversation[]
} | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(CONVERSATION_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as {
      activeConversationId?: unknown
      conversations?: unknown
    }
    if (
      typeof parsed.activeConversationId !== 'string' ||
      !Array.isArray(parsed.conversations)
    ) {
      return null
    }
    const conversations = parsed.conversations.filter(
      (item): item is AgentConversation => {
        if (!item || typeof item !== 'object') return false
        const candidate = item as Partial<AgentConversation>
        return (
          typeof candidate.id === 'string' &&
          typeof candidate.title === 'string' &&
          typeof candidate.createdAt === 'string' &&
          typeof candidate.updatedAt === 'string' &&
          Array.isArray(candidate.messages) &&
          Array.isArray(candidate.generationResults) &&
          !!candidate.conversationContext &&
          typeof candidate.conversationContext === 'object'
        )
      },
    )
    if (!conversations.some((item) => item.id === parsed.activeConversationId)) {
      return null
    }
    return { activeConversationId: parsed.activeConversationId, conversations }
  } catch {
    return null
  }
}

function persistConversations(
  activeConversationId: string,
  conversations: AgentConversation[],
): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(
      CONVERSATION_STORAGE_KEY,
      JSON.stringify({ activeConversationId, conversations }),
    )
  } catch {
    // 浏览器存储不可用时仍允许在当前页面内使用多会话。
  }
}

const restoredConversationState = loadConversations()
const fallbackConversation = createConversation()
const initialConversations = restoredConversationState?.conversations ?? [fallbackConversation]
const initialActiveConversationId =
  restoredConversationState?.activeConversationId ?? fallbackConversation.id
const initialConversation =
  initialConversations.find((item) => item.id === initialActiveConversationId) ??
  fallbackConversation

export const useAgentStore = create<AgentStore>((set, get) => ({
  activeConversationId: initialActiveConversationId,
  conversations: initialConversations,
  messages: initialConversation.messages,
  loading: false,
  error: undefined,
  lastResponse: initialConversation.lastResponse,
  lastRequest: initialConversation.lastRequest,
  role:
    (typeof window !== 'undefined' &&
      (localStorage.getItem('agentRole') as AgentRole)) ||
    'general',
  conversationContext: initialConversation.conversationContext,
  generationResults: initialConversation.generationResults,

  newConversation: () => {
    const conversation = createConversation()
    const state = get()
    const conversations =
      state.messages.length === 0
        ? state.conversations.filter((item) => item.id !== state.activeConversationId)
        : state.conversations
    set({
      activeConversationId: conversation.id,
      conversations: [conversation, ...conversations],
      messages: [],
      loading: false,
      error: undefined,
      lastResponse: undefined,
      lastRequest: undefined,
      conversationContext: {},
      generationResults: [],
    })
    return conversation.id
  },

  openConversation: (conversationId) => {
    const conversation = get().conversations.find(
      (item) => item.id === conversationId,
    )
    if (!conversation || conversation.id === get().activeConversationId) return
    set({
      activeConversationId: conversation.id,
      messages: conversation.messages,
      loading: false,
      error: undefined,
      lastResponse: conversation.lastResponse,
      lastRequest: conversation.lastRequest,
      conversationContext: conversation.conversationContext,
      generationResults: conversation.generationResults,
    })
  },

  deleteConversation: (conversationId) => {
    const state = get()
    const remaining = state.conversations.filter(
      (item) => item.id !== conversationId,
    )
    if (conversationId !== state.activeConversationId) {
      set({ conversations: remaining })
      return
    }

    const replacement = remaining[0] ?? createConversation()
    set({
      activeConversationId: replacement.id,
      conversations: remaining.length > 0 ? remaining : [replacement],
      messages: replacement.messages,
      loading: false,
      error: undefined,
      lastResponse: replacement.lastResponse,
      lastRequest: replacement.lastRequest,
      conversationContext: replacement.conversationContext,
      generationResults: replacement.generationResults,
    })
  },

  submitPrompt: ({
    userIdea,
    contextNodeIds,
    selectedNodeId,
    targetPromptNodeId,
    role,
  }) => {
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

  addGenerationResult: (result) =>
    set((state) => ({
      generationResults: [
        ...state.generationResults,
        {
          id:
            'gen_result_' +
            Date.now() +
            '_' +
            Math.random().toString(36).slice(2, 7),
          ...result,
          timestamp: new Date().toISOString(),
        },
      ],
    })),

  clearGenerationResults: () => set({ generationResults: [] }),

  reset: () =>
    set((state) => ({
      messages: [],
      loading: false,
      error: undefined,
      lastResponse: undefined,
      lastRequest: undefined,
      conversationContext: {},
      generationResults: [],
      role: state.role,
    })),
}))

let syncingConversation = false
useAgentStore.subscribe((state, previousState) => {
  const conversationChanged =
    state.messages !== previousState.messages ||
    state.lastResponse !== previousState.lastResponse ||
    state.lastRequest !== previousState.lastRequest ||
    state.conversationContext !== previousState.conversationContext ||
    state.generationResults !== previousState.generationResults

  if (conversationChanged && !syncingConversation) {
    const current = state.conversations.find(
      (item) => item.id === state.activeConversationId,
    )
    if (current) {
      const updatedConversation: AgentConversation = {
        ...current,
        title:
          current.title === DEFAULT_CONVERSATION_TITLE
            ? titleFromMessages(state.messages)
            : current.title,
        updatedAt: new Date().toISOString(),
        messages: state.messages,
        lastResponse: state.lastResponse,
        lastRequest: state.lastRequest,
        conversationContext: state.conversationContext,
        generationResults: state.generationResults,
      }
      syncingConversation = true
      useAgentStore.setState({
        conversations: state.conversations.map((item) =>
          item.id === updatedConversation.id ? updatedConversation : item,
        ),
      })
      syncingConversation = false
      return
    }
  }

  if (
    state.activeConversationId !== previousState.activeConversationId ||
    state.conversations !== previousState.conversations
  ) {
    persistConversations(state.activeConversationId, state.conversations)
  }
})

