// 即梦 Flow 工作台 - Agent 共享类型
// 参考 PRD 8.7（Agent Prompt 优化流程）、10.5（Agent 接口请求/响应示例）、
//       11.4（AgentMessage 数据模型）、9.4（Agent 数据流）。

/** Agent 消息角色 */
export type AgentMessageRole = 'user' | 'assistant' | 'system'

/**
 * Agent 对话消息数据模型。
 * 参考 PRD 11.4。
 */
export interface AgentMessage {
  id: string
  /** 所属工作流 id */
  flowId?: string
  role: AgentMessageRole
  content: string
  /** Agent 引用了哪些节点上下文 */
  contextNodeIds: string[]
  /** 关联的当前选中节点（例如选中的 Image 节点） */
  selectedNodeId?: string
  /** 优化后的 Prompt（role==='assistant' 时） */
  optimizedPrompt?: string
  /** 建议动作列表（role==='assistant' 时） */
  proposedActions?: AgentProposedAction[]
  createdAt: string
}

/** Agent 建议的参数（参考 PRD 8.7、10.5） */
export interface AgentSuggestedParams {
  width?: number
  height?: number
  count?: number
  /** 其他可选参数，例如模型、比例等 */
  [key: string]: unknown
}

/** Agent 建议的动作（参考 PRD 8.7、10.5 proposedActions） */
export interface AgentProposedAction {
  id: string
  /** 动作类型，例如 create_prompt_node / create_edit_branch / overwrite_prompt */
  type: string
  /** 展示给用户的动作标签 */
  label: string
  /** 动作附带的数据，例如源节点 id、写回的 prompt 等 */
  payload?: Record<string, unknown>
}

/**
 * POST /api/agent/prompt-optimize 请求体。
 * 参考 PRD 8.7、10.5。
 */
export interface PromptOptimizeRequest {
  /** 用户粗略想法 */
  userIdea: string
  /** 要写回的 Prompt 节点 id（可选，由前端指定） */
  targetPromptNodeId?: string
  /** 用户提供作为上下文的节点 id 数组 */
  contextNodeIds?: string[]
  /** 当前选中的节点 id（例如选中的 Image 节点） */
  selectedNodeId?: string
  /** 所属工作流 id */
  flowId?: string
  /** 模型（可选，默认用 settings.llmModel） */
  model?: string
}

/**
 * POST /api/agent/prompt-optimize 响应体。
 * 参考 PRD 8.7、10.5。
 */
export interface PromptOptimizeResponse {
  /** Agent 思考说明（自然语言，给用户看） */
  reasoning: string
  /** 优化后的提示词 */
  optimizedPrompt: string
  /** 负面约束（需要避免的内容） */
  negativePrompt: string
  /** 建议参数（例如 width/height/count） */
  suggestedParams: AgentSuggestedParams
  /** 建议动作数组 */
  proposedActions: AgentProposedAction[]
  /** Agent 实际使用了哪些节点上下文 */
  usedContextNodeIds: string[]
  /** 原始 LLM 输出，便于调试 */
  rawLlmResponse: string
}
