// 即梦 Flow 后端 - LLM provider client
// 封装 OpenAI-compatible Chat Completions 调用。
// 参考 PRD 7.6、8.9、9.3、10.6、13.8。
// 文本节点和 Agent（Task 9）共用同一个 provider client，但使用不同的 system prompt。
// 使用 Node 18+ 内置 fetch，不引入额外依赖。

import type {
  LlmModelInfo,
  LlmOutputFormat,
  TextContentType,
} from '@jimeng-flow/shared/textNode'
import { getSettings } from '../settings'

/** LLM 调用选项 */
export interface GenerateOptions {
  /** 输出格式偏好，默认 'auto'（自动检测 JSON） */
  outputFormat?: LlmOutputFormat
  /** 请求超时（毫秒），默认 60s */
  timeoutMs?: number
  /** 透传 baseUrl / apiKey 覆盖（默认从 settings 读取） */
  baseUrl?: string
  apiKey?: string
}

/** generateText / generateAgentReply 的返回结构 */
export interface GenerateResult {
  content: string
  contentType: TextContentType
  /** 从 JSON 返回中提取的可用于生图的 Prompt */
  promptCandidate?: string
  usage?: {
    promptTokens: number
    completionTokens: number
  }
}

/** OpenAI Chat Completions 响应中单个 message 的结构 */
interface OpenAiMessage {
  role?: string
  content?: string
}

interface OpenAiChoice {
  message?: OpenAiMessage
  finish_reason?: string
}

interface OpenAiChatResponse {
  choices?: OpenAiChoice[]
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  }
}

interface OpenAiModel {
  id: string
  owned_by?: string
}

interface OpenAiModelsResponse {
  data?: OpenAiModel[]
}

/** 默认模型列表（GET /models 失败时兜底，参考 PRD 7.6 提到的 GVLM、Qwen VL） */
const DEFAULT_MODELS: LlmModelInfo[] = [
  {
    id: 'gpt-4o-mini',
    label: 'GPT-4o mini',
    description: 'OpenAI 兼容通用模型',
    estimatedLatency: '约 1-3s',
  },
  {
    id: 'gvlm-3.1',
    label: 'GVLM 3.1',
    description: '通用视觉语言模型（中转站）',
    estimatedLatency: '约 2-5s',
  },
  {
    id: 'qwen-vl-plus',
    label: 'Qwen VL Plus',
    description: '通义千问视觉模型',
    estimatedLatency: '约 2-5s',
  },
]

/** 模型 estimatedLatency 估算（基于 id 简单匹配，仅供 UI 展示） */
function guessLatency(modelId: string): string {
  const id = modelId.toLowerCase()
  if (id.includes('mini') || id.includes('fast')) return '约 1-3s'
  if (id.includes('4o') || id.includes('3.1')) return '约 2-5s'
  if (id.includes('vl') || id.includes('vision')) return '约 2-5s'
  return '约 2-6s'
}

/**
 * 从结构化 JSON 中提取可用于生图的 Prompt 候选。
 * 参考 PRD 8.9：识别 action_input / prompt / optimizedPrompt 字段。
 * 支持对象层级递归查找。
 */
function extractPromptCandidate(parsed: unknown): string | undefined {
  if (!parsed || typeof parsed !== 'object') return undefined
  if (Array.isArray(parsed)) {
    for (const item of parsed) {
      const found = extractPromptCandidate(item)
      if (found) return found
    }
    return undefined
  }
  const obj = parsed as Record<string, unknown>
  // 优先级：optimizedPrompt > action_input > prompt
  const candidates = ['optimizedPrompt', 'action_input', 'prompt']
  for (const key of candidates) {
    const v = obj[key]
    if (typeof v === 'string' && v.trim().length > 0) return v.trim()
  }
  // 递归查找嵌套对象
  for (const key of Object.keys(obj)) {
    const v = obj[key]
    if (v && typeof v === 'object') {
      const found = extractPromptCandidate(v)
      if (found) return found
    }
  }
  return undefined
}

/**
 * 判断内容类型并尝试提取 promptCandidate。
 * - outputFormat='text'：直接判为 text，不尝试 JSON 解析。
 * - outputFormat='json'：强制判为 json（即便解析失败也保留原内容为 json 文本，但尝试提取）。
 * - outputFormat='auto'：尝试 JSON.parse，成功且为对象则判为 json。
 */
function detectContentTypeAndPrompt(
  content: string,
  outputFormat: LlmOutputFormat,
): { contentType: TextContentType; promptCandidate?: string } {
  if (outputFormat === 'text') {
    return { contentType: 'text' }
  }
  // 尝试 JSON 解析
  try {
    const parsed = JSON.parse(content)
    if (parsed && typeof parsed === 'object') {
      return {
        contentType: 'json',
        promptCandidate: extractPromptCandidate(parsed),
      }
    }
  } catch {
    // 解析失败
    if (outputFormat === 'json') {
      // 期望 JSON 但解析失败，仍按 json 文本展示（前端可用代码块样式）
      return { contentType: 'json' }
    }
  }
  return { contentType: 'text' }
}

/** 构建 Chat Completions 请求体 */
function buildChatRequestBody(
  model: string,
  messages: OpenAiMessage[],
  opts: GenerateOptions,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model,
    messages,
    stream: false,
  }
  // json 模式：请求 OpenAI response_format（部分中转站支持）
  if (opts.outputFormat === 'json') {
    body.response_format = { type: 'json_object' }
  }
  return body
}

/**
 * 调用 OpenAI-compatible Chat Completions。
 * 内部复用，generateText / generateAgentReply 都走这里。
 */
async function callChatCompletions(
  model: string,
  messages: OpenAiMessage[],
  opts: GenerateOptions,
): Promise<GenerateResult> {
  const settings = await getSettings()
  const baseUrl = (opts.baseUrl ?? settings.llmBaseUrl ?? '').replace(/\/+$/, '')
  const apiKey = opts.apiKey ?? settings.llmApiKey ?? ''

  if (!baseUrl) {
    throw new Error('LLM base URL 未配置，请先在设置中配置 llmBaseUrl')
  }
  if (!apiKey) {
    throw new Error('LLM API key 未配置，请先在设置中配置 llmApiKey')
  }

  const url = `${baseUrl}/chat/completions`
  const body = buildChatRequestBody(model, messages, opts)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 60_000)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      const summary = text.length > 300 ? `${text.slice(0, 300)}...` : text
      throw new Error(
        `LLM 调用失败：HTTP ${res.status} ${res.statusText}${summary ? ` - ${summary}` : ''}`,
      )
    }

    const json = (await res.json()) as OpenAiChatResponse
    const choice = json.choices?.[0]
    const content = choice?.message?.content ?? ''
    if (!content) {
      throw new Error('LLM 返回内容为空')
    }

    const outputFormat: LlmOutputFormat = opts.outputFormat ?? 'auto'
    const { contentType, promptCandidate } = detectContentTypeAndPrompt(
      content,
      outputFormat,
    )

    const usage = json.usage
      ? {
          promptTokens: json.usage.prompt_tokens ?? 0,
          completionTokens: json.usage.completion_tokens ?? 0,
        }
      : undefined

    return { content, contentType, promptCandidate, usage }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 调用 LLM 生成文本（文本节点用）。
 * 参考 PRD 7.6、10.6。
 * @param model 模型 id（例如 gpt-4o-mini、gvlm-3.1）
 * @param message 用户输入的自然语言需求
 * @param opts 输出格式 / 超时 / 覆盖配置
 */
export async function generateText(
  model: string,
  message: string,
  opts?: GenerateOptions,
): Promise<GenerateResult> {
  return callChatCompletions(
    model,
    [{ role: 'user', content: message }],
    opts ?? {},
  )
}

/**
 * 调用 LLM 生成 Agent 回复（Task 9 复用）。
 * 与 generateText 相同的封装，但接受 system prompt。
 * 参考 PRD 8.7、9.3。
 * @param model 模型 id
 * @param systemPrompt Agent 系统提示词
 * @param userMessage 用户消息
 * @param opts 输出格式 / 超时 / 覆盖配置
 */
export async function generateAgentReply(
  model: string,
  systemPrompt: string,
  userMessage: string,
  opts?: GenerateOptions,
): Promise<GenerateResult> {
  return callChatCompletions(
    model,
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    opts ?? {},
  )
}

/**
 * 列出可用 LLM 模型。
 * 调 GET ${baseUrl}/models，失败时返回默认占位列表。
 * 参考 PRD 7.6、8.9。
 */
export async function listModels(
  opts?: Pick<GenerateOptions, 'baseUrl' | 'apiKey' | 'timeoutMs'>,
): Promise<LlmModelInfo[]> {
  const settings = await getSettings()
  const baseUrl = (opts?.baseUrl ?? settings.llmBaseUrl ?? '').replace(/\/+$/, '')
  const apiKey = opts?.apiKey ?? settings.llmApiKey ?? ''

  if (!baseUrl || !apiKey) {
    return DEFAULT_MODELS
  }

  const url = `${baseUrl}/models`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts?.timeoutMs ?? 10_000)
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
    })
    if (!res.ok) {
      return DEFAULT_MODELS
    }
    const json = (await res.json()) as OpenAiModelsResponse
    const list = json.data ?? []
    if (list.length === 0) return DEFAULT_MODELS
    return list.map((m) => ({
      id: m.id,
      label: m.id,
      estimatedLatency: guessLatency(m.id),
    }))
  } catch {
    return DEFAULT_MODELS
  } finally {
    clearTimeout(timer)
  }
}

/** LLM 连接测试选项 */
export interface LlmTestOptions {
  llmBaseUrl?: string
  llmApiKey?: string
}

/**
 * 测试 LLM Provider 连接与鉴权。
 * 调 GET ${baseUrl}/models，返回结构便于前端展示成功/失败原因，不抛出异常。
 */
export async function testLlmConnection(
  opts: LlmTestOptions,
): Promise<{ ok: boolean; message?: string }> {
  const baseUrl = (opts.llmBaseUrl ?? '').replace(/\/+$/, '')
  const apiKey = opts.llmApiKey ?? ''

  if (!baseUrl) {
    return { ok: false, message: '未配置 LLM Base URL' }
  }
  if (!apiKey) {
    return { ok: false, message: '未配置 LLM API Key' }
  }

  const url = `${baseUrl}/models`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10_000)
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
    })

    if (res.ok) {
      return { ok: true, message: '连接成功' }
    }

    const text = await res.text().catch(() => '')
    const summary = text.length > 300 ? `${text.slice(0, 300)}...` : text
    return {
      ok: false,
      message: `LLM 服务返回错误：HTTP ${res.status} ${res.statusText}${summary ? ` - ${summary}` : ''}`,
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, message: 'LLM 连接超时（10s）' }
    }
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, message: `LLM 连接失败：${msg}` }
  } finally {
    clearTimeout(timer)
  }
}
