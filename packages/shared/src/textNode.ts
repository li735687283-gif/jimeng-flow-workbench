// 即梦 Flow 工作台 - Text/Prompt 节点共享类型
// 参考 PRD 6.2（节点定义）、7.6（LLM 调用流程）、8.9（LLM 能力）、
//       10.6（API 草案）、11.5（TextNodeData 数据模型）。

/** 文本节点状态机 */
export type TextNodeStatus = 'idle' | 'running' | 'success' | 'error'

/** 文本节点返回内容类型 */
export type TextContentType = 'text' | 'json'

/** LLM 提供商信息（写回节点用于追溯） */
export interface TextNodeLlmMeta {
  provider: string
  model: string
  baseUrl: string
}

/**
 * Text/Prompt 节点数据模型。
 * 参考 PRD 11.5、6.2、8.9。
 */
export interface TextNodeData {
  id: string
  type: 'text'
  title: string
  /** 用户手写输入（Composer 中提交的自然语言需求） */
  input: string
  /** LLM 返回内容或手写内容 */
  content: string
  /** 内容类型：纯文本或结构化 JSON */
  contentType: TextContentType
  /** 上次调用 LLM 的提供商信息 */
  llm?: TextNodeLlmMeta
  /** 识别出的可用于生图的 Prompt（从 JSON 返回中提取） */
  promptCandidate?: string
  status: TextNodeStatus
  /** 错误信息（status==='error' 时） */
  error?: string
  createdAt: string
  updatedAt: string
}

/** LLM 输出格式偏好 */
export type LlmOutputFormat = 'auto' | 'text' | 'json'

/**
 * POST /api/llm/chat 请求体。
 * 参考 PRD 10.6。
 */
export interface LlmChatRequest {
  model: string
  message: string
  /** 输出格式偏好，默认 'auto'（自动检测 JSON） */
  outputFormat?: LlmOutputFormat
}

/**
 * POST /api/llm/chat 与 /api/text-nodes/:id/run 响应体。
 * 参考 PRD 10.6 响应示例。
 */
export interface LlmChatResponse {
  /** 关联的文本节点 id（/api/text-nodes/:id/run 必带） */
  nodeId?: string
  model: string
  content: string
  contentType: TextContentType
  /** 从 JSON 返回中提取的可用于生图的 Prompt */
  promptCandidate?: string
  /** token 用量统计 */
  usage?: {
    promptTokens: number
    completionTokens: number
  }
}

/** POST /api/llm/transcriptions 请求体 */
export interface LlmTranscribeRequest {
  audioBase64: string
  mimeType: string
  filename?: string
  model?: string
}

/** POST /api/llm/transcriptions 响应体 */
export interface LlmTranscribeResponse {
  text: string
  model: string
}

/**
 * POST /api/text-nodes/:id/run 请求体。
 * 参考 PRD 10.6 请求示例。
 */
export interface TextNodeRunRequest {
  flowId?: string
  model: string
  message: string
  outputFormat?: LlmOutputFormat
}

/** GET /api/llm/models 返回的模型信息 */
export interface LlmModelInfo {
  id: string
  label: string
  description?: string
  /** 预计耗时标签，例如 "约 2-5s" */
  estimatedLatency?: string
}
