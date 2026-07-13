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
  /** 文本框背景色（顶部工具栏可选） */
  frameColor?: string
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
  /**
   * 上游图片资产 ID 列表（可选）。
   * 传入后走多模态识图/反推：message 可为空，后端会使用默认反推指令。
   */
  inputImages?: string[]
}

/**
 * 文本节点通用 system 指令：只产出可用结果，禁止客套与解释废话。
 * 适用于改写、反推、扩写等所有文本节点 LLM 调用。
 */
export const TEXT_NODE_SYSTEM_PROMPT = [
  '你是创作工作台里的内容生成器，只输出用户任务要求的最终结果正文。',
  '禁止输出任何客套、确认、开场或收尾话术，例如：',
  '「当然可以」「好的」「以下是」「希望对你有帮助」「如果需要我可以再改」等。',
  '不要解释你的思考过程，不要加标题装饰（除非用户明确要求），不要用 markdown 代码块包裹纯文本结果（除非用户明确要求）。',
  '直接给出可用内容本身。',
].join('')

/** 文本节点「图片反推」默认指令（上游连图且用户未写提示词时使用） */
export const DEFAULT_IMAGE_REVERSE_PROMPT = [
  '请仔细观察这张（或这些）图片，反推一段可直接用于 AI 生图/生视频的详细中文提示词。',
  '覆盖：主体与构图、画风、色彩与光影、材质细节、氛围情绪。',
  '只输出提示词正文本身，不要任何解释、确认或收尾语。',
].join('')

/** GET /api/llm/models 返回的模型信息 */
export interface LlmModelInfo {
  id: string
  label: string
  description?: string
  /** 预计耗时标签，例如 "约 2-5s" */
  estimatedLatency?: string
}
