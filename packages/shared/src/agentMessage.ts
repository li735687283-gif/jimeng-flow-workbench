// 即梦 Flow 工作台 - Agent 共享类型
// 对话式协议：模型自由回复自然语言，需要操作画布时输出工具调用。

/** Agent 可调用的画布工具 */
export type AgentToolName =
  | 'generate_image'
  | 'generate_video'
  | 'edit_image'
  | 'read_canvas'

/** 一次工具调用（由模型产出，前端执行） */
export interface AgentToolCall {
  id: string
  tool: AgentToolName
  /** 给用户看的动作描述，例如「生成图片：赛博朋克风格的猫」 */
  label: string
  args: Record<string, unknown>
}

/** 工具执行结果（前端执行后回传给模型） */
export interface AgentToolResult {
  callId: string
  tool: AgentToolName
  ok: boolean
  /** 给模型看的结果摘要，例如「已创建图片节点 node_123 并提交生成」 */
  summary: string
}

/** Agent 消息角色 */
export type AgentMessageRole = 'user' | 'assistant' | 'system'

/**
 * Agent 对话消息数据模型（面板展示与本地持久化）。
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
  /** assistant 消息携带的工具调用 */
  actions?: AgentToolCall[]
  /** 工具执行结果（确认/自动执行后写回） */
  actionResults?: AgentToolResult[]
  createdAt: string
}

/** 发送给后端的单轮对话（含工具执行结果轮） */
export interface AgentChatTurn {
  role: 'user' | 'assistant'
  content: string
  /** assistant 轮当时产出的工具调用 */
  actions?: AgentToolCall[]
  /** user 轮可携带刚执行完的工具结果 */
  toolResults?: AgentToolResult[]
}

/** 画布节点摘要（注入上下文 / read_canvas 结果） */
export interface AgentCanvasNodeSummary {
  id: string
  type: string
  title: string
  prompt?: string
  status?: string
}

/**
 * POST /api/agent/chat 请求体。
 */
export interface AgentChatRequest {
  /** 完整对话历史（最新一条用户消息也在其中） */
  history: AgentChatTurn[]
  /** 当前画布节点摘要，供模型了解画布 */
  canvas: AgentCanvasNodeSummary[]
  /** 模型（可选，默认用 settings.llmModel） */
  model?: string
}

/**
 * POST /api/agent/chat 响应体。
 */
export interface AgentChatResponse {
  /** 给用户看的自然语言回复 */
  message: string
  /** 模型请求执行的工具调用（可为空数组） */
  actions: AgentToolCall[]
  /** 原始 LLM 输出，便于调试 */
  rawLlmResponse: string
}
