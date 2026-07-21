// 即梦 Flow 前端 - Agent 对话状态
// 对话式协议：消息里带 actions（工具调用）与 actionResults（执行结果），
// 执行模式（手动确认 / 全自动）持久化在 localStorage。

import type {
  AgentChatTurn,
  AgentMessage,
  AgentToolResult,
} from '@jimeng-flow/shared/agentMessage'
import { create } from 'zustand'

export type AgentExecutionMode = 'manual' | 'auto'

export interface AgentConversationContext {
  lastPrompt?: string
  lastGeneratedAssetIds?: string[]
}

export interface AgentConversation {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  messages: AgentMessage[]
  conversationContext: AgentConversationContext
}

interface ProjectConversationState {
  activeConversationId: string
  conversations: AgentConversation[]
}

interface AgentStore {
  activeProjectId: string | null
  setActiveProject: (projectId: string | null) => void

  activeConversationId: string
  conversations: AgentConversation[]
  messages: AgentMessage[]
  loading: boolean
  error?: string
  conversationContext: AgentConversationContext

  executionMode: AgentExecutionMode
  setExecutionMode: (mode: AgentExecutionMode) => void

  newConversation: () => string
  openConversation: (conversationId: string) => void
  deleteConversation: (conversationId: string) => void
  reset: () => void

  addMessage: (message: AgentMessage) => void
  addActionResults: (messageId: string, results: AgentToolResult[]) => void
  setLoading: (loading: boolean) => void
  setError: (error?: string) => void
  touchConversationTitle: (title: string) => void
  setConversationContext: (ctx: Partial<AgentConversationContext>) => void
}

const CONVERSATION_STORAGE_KEY = 'jimeng-flow-agent-conversations-v2'
const EXECUTION_MODE_STORAGE_KEY = 'mok-agent-execution-mode'

const projectConversationCache = new Map<string, ProjectConversationState>()

function createMessageId(): string {
  return `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function conversationTitleFromFirstMessage(messages: AgentMessage[]): string {
  const firstUser = messages.find((message) => message.role === 'user')
  const text = firstUser?.content.replace(/\s+/g, ' ').trim() ?? ''
  return text ? text.slice(0, 24) : '新对话'
}

function createConversation(): AgentConversation {
  const now = new Date().toISOString()
  return {
    id: createMessageId().replace('msg', 'conv'),
    title: '新对话',
    createdAt: now,
    updatedAt: now,
    messages: [],
    conversationContext: {},
  }
}

function isValidMessage(candidate: unknown): candidate is AgentMessage {
  if (!candidate || typeof candidate !== 'object') return false
  const message = candidate as Partial<AgentMessage>
  return (
    typeof message.id === 'string' &&
    (message.role === 'user' || message.role === 'assistant' || message.role === 'system') &&
    typeof message.content === 'string' &&
    typeof message.createdAt === 'string'
  )
}

function normalizeConversation(candidate: unknown): AgentConversation | null {
  if (!candidate || typeof candidate !== 'object') return null
  const value = candidate as Partial<AgentConversation>
  if (
    typeof value.id !== 'string' ||
    typeof value.title !== 'string' ||
    typeof value.createdAt !== 'string' ||
    typeof value.updatedAt !== 'string' ||
    !Array.isArray(value.messages) ||
    !value.messages.every(isValidMessage) ||
    !value.conversationContext ||
    typeof value.conversationContext !== 'object'
  ) {
    return null
  }
  return {
    id: value.id,
    title: value.title,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    messages: value.messages.map((message) => ({
      ...message,
      contextNodeIds: Array.isArray(message.contextNodeIds) ? message.contextNodeIds : [],
    })),
    conversationContext: value.conversationContext,
  }
}

function normalizeProjectState(candidate: unknown): ProjectConversationState | null {
  if (!candidate || typeof candidate !== 'object') return null
  const value = candidate as Partial<ProjectConversationState>
  if (typeof value.activeConversationId !== 'string' || !Array.isArray(value.conversations)) {
    return null
  }
  const conversations = value.conversations
    .map((item) => normalizeConversation(item))
    .filter((item): item is AgentConversation => !!item)
  if (!conversations.length) return null
  return { activeConversationId: value.activeConversationId, conversations }
}

function loadProjectConversations(projectId: string): ProjectConversationState | null {
  const cached = projectConversationCache.get(projectId)
  if (cached) return cached
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(CONVERSATION_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { projects?: Record<string, unknown> }
    const projectState = normalizeProjectState(parsed.projects?.[projectId])
    if (projectState) projectConversationCache.set(projectId, projectState)
    return projectState
  } catch {
    return null
  }
}

function persistProjectConversations(
  projectId: string,
  activeConversationId: string,
  conversations: AgentConversation[],
): void {
  const projectState = { activeConversationId, conversations }
  projectConversationCache.set(projectId, projectState)
  if (typeof window === 'undefined') return
  try {
    const raw = localStorage.getItem(CONVERSATION_STORAGE_KEY)
    const parsed = raw
      ? (JSON.parse(raw) as { projects?: Record<string, ProjectConversationState> })
      : {}
    localStorage.setItem(
      CONVERSATION_STORAGE_KEY,
      JSON.stringify({
        projects: {
          ...(parsed.projects ?? {}),
          [projectId]: projectState,
        },
      }),
    )
  } catch {
    // 浏览器存储不可用时仍允许在当前页面内按项目隔离会话。
  }
}

function loadExecutionMode(): AgentExecutionMode {
  if (typeof window === 'undefined') return 'manual'
  return localStorage.getItem(EXECUTION_MODE_STORAGE_KEY) === 'auto' ? 'auto' : 'manual'
}

const fallbackConversation = createConversation()

export const useAgentStore = create<AgentStore>((set, get) => ({
  activeProjectId: null,
  setActiveProject: (projectId) => {
    const normalizedProjectId = projectId?.trim() || null
    if (normalizedProjectId === get().activeProjectId) return

    const fallback = createConversation()
    const projectState = normalizedProjectId
      ? loadProjectConversations(normalizedProjectId)
      : null
    const conversations = projectState?.conversations ?? [fallback]
    const activeConversationId = projectState?.activeConversationId ?? fallback.id
    const activeConversation =
      conversations.find((item) => item.id === activeConversationId) ?? fallback

    set({
      activeProjectId: normalizedProjectId,
      activeConversationId,
      conversations,
      messages: activeConversation.messages,
      loading: false,
      error: undefined,
      conversationContext: activeConversation.conversationContext,
    })
  },

  activeConversationId: fallbackConversation.id,
  conversations: [fallbackConversation],
  messages: [],
  loading: false,
  error: undefined,
  conversationContext: {},

  executionMode: loadExecutionMode(),
  setExecutionMode: (mode) => {
    set({ executionMode: mode })
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(EXECUTION_MODE_STORAGE_KEY, mode)
      } catch {
        // 忽略存储失败
      }
    }
  },

  newConversation: () => {
    const conversation = createConversation()
    set((state) => ({
      activeConversationId: conversation.id,
      conversations: [...state.conversations, conversation],
      messages: [],
      loading: false,
      error: undefined,
      conversationContext: {},
    }))
    return conversation.id
  },

  openConversation: (conversationId) => {
    const conversation = get().conversations.find((item) => item.id === conversationId)
    if (!conversation) return
    set({
      activeConversationId: conversation.id,
      messages: conversation.messages,
      loading: false,
      error: undefined,
      conversationContext: conversation.conversationContext,
    })
  },

  deleteConversation: (conversationId) => {
    const state = get()
    const remaining = state.conversations.filter((item) => item.id !== conversationId)
    if (remaining.length === state.conversations.length) return
    if (state.activeConversationId !== conversationId) {
      set({ conversations: remaining })
      return
    }
    const replacement = remaining.at(-1) ?? createConversation()
    const conversations = remaining.length ? remaining : [replacement]
    set({
      activeConversationId: replacement.id,
      conversations,
      messages: replacement.messages,
      loading: false,
      error: undefined,
      conversationContext: replacement.conversationContext,
    })
  },

  reset: () => {
    const conversation = createConversation()
    set({
      activeConversationId: conversation.id,
      conversations: [conversation],
      messages: [],
      loading: false,
      error: undefined,
      conversationContext: {},
    })
  },

  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  addActionResults: (messageId, results) =>
    set((state) => ({
      messages: state.messages.map((message) =>
        message.id === messageId
          ? { ...message, actionResults: [...(message.actionResults ?? []), ...results] }
          : message,
      ),
    })),

  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  touchConversationTitle: (title) => {
    const trimmed = title.trim()
    if (!trimmed) return
    set((state) => ({
      conversations: state.conversations.map((item) =>
        item.id === state.activeConversationId
          ? { ...item, title: trimmed.slice(0, 24), updatedAt: new Date().toISOString() }
          : item,
      ),
    }))
  },

  setConversationContext: (ctx) =>
    set((state) => ({
      conversationContext: { ...state.conversationContext, ...ctx },
    })),
}))

// 消息或上下文变化时同步回当前会话，并按项目持久化。
useAgentStore.subscribe((state, previousState) => {
  if (
    state.messages === previousState.messages &&
    state.conversationContext === previousState.conversationContext
  ) {
    return
  }
  const now = new Date().toISOString()
  const conversations = state.conversations.map((item) =>
    item.id === state.activeConversationId
      ? {
          ...item,
          title:
            item.title === '新对话'
              ? conversationTitleFromFirstMessage(state.messages)
              : item.title,
          updatedAt: now,
          messages: state.messages,
          conversationContext: state.conversationContext,
        }
      : item,
  )
  useAgentStore.setState({ conversations })
  if (state.activeProjectId) {
    persistProjectConversations(
      state.activeProjectId,
      state.activeConversationId,
      conversations,
    )
  }
})

/** 把消息列表整理成发给后端的对话历史（含工具调用与结果）。 */
export function buildAgentChatHistory(messages: AgentMessage[]): AgentChatTurn[] {
  const turns: AgentChatTurn[] = []
  for (const message of messages) {
    if (message.role !== 'user' && message.role !== 'assistant') continue
    // 用户 @ 引用的画布节点必须写进文本里,否则模型只能靠猜——
    // 引用关系只存在于结构化字段,模型看不到。
    const mentionSuffix =
      message.role === 'user' && message.contextNodeIds.length > 0
        ? `\n（用户引用的画布节点 id：${message.contextNodeIds.join('、')}）`
        : ''
    turns.push({
      role: message.role,
      content: message.content + mentionSuffix,
      actions: message.actions,
    })
    // 协议约定工具结果放在随后的 user 回合里（服务端也要求最后一条是 user），
    // 因此助手消息的执行结果转换成一个携带 toolResults 的用户回合。
    // 内容必须明确标注"这是回执、不是用户的新请求",否则模型会把最后一条
    // user 回合当成新指令,把刚执行过的工具再执行一遍（重复生成）。
    if (message.role === 'assistant' && message.actionResults?.length) {
      turns.push({
        role: 'user',
        content: '（工具执行回执：以下是刚才工具的执行结果，不是用户的新消息）',
        toolResults: message.actionResults,
      })
    }
  }
  return turns
}
