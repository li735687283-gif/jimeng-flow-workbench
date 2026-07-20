// 即梦 Flow 后端 - Agent 对话服务
// 对话式协议：模型自由回复自然语言,需要操作画布时输出工具调用,
// 由前端按执行模式(手动确认/全自动)执行并把结果带回对话。

import type {
  AgentChatRequest,
  AgentChatResponse,
  AgentChatTurn,
  AgentToolCall,
  AgentToolName,
} from '@jimeng-flow/shared/agentMessage'
import { generateAgentReply } from '../llm'
import { getSettings } from '../settings'

/** Agent 错误（带 code，便于路由层映射 HTTP 状态码） */
export class AgentError extends Error {
  code: 'INVALID_INPUT' | 'LLM_CONFIG_MISSING' | 'LLM_CALL_FAILED' | 'PARSE_FAILED'
  constructor(
    code: AgentError['code'],
    message: string,
  ) {
    super(message)
    this.code = code
    this.name = 'AgentError'
  }
}

const AGENT_TOOL_NAMES: ReadonlySet<string> = new Set<AgentToolName>([
  'generate_image',
  'generate_video',
  'edit_image',
  'read_canvas',
])

const SYSTEM_PROMPT = `你是 MO.K 画布的 AI 助手。MO.K 是一个节点式 AI 创作工作台:画布上有图片节点、视频节点和文本节点,节点之间可以连线(图片节点可以作为其他节点的参考输入)。

你可以自由地和用户聊天(创意讨论、问题解答、闲聊都可以),不要强行把话题扯到生成内容上。当用户明确想在画布上生成或修改内容时,你可以请求执行以下工具:

1. generate_image — 生成图片。args:
   - prompt(必填):详细的视觉提示词,包含主体、场景、风格、光线、构图等,简体中文
   - aspectRatio(可选):1:1、16:9、9:16、4:3、3:4、3:2、2:3、21:9。根据内容选择合适的比例:横版场景/海报/风景默认 16:9,竖版人像/手机壁纸用 9:16,只有确实需要方形时才用 1:1;不填时默认 16:9
   - resolution(可选):1K、2K、4K
   - count(可选):1-4,默认 1
   - model(可选):从可用的图片模型 id 中选一个,不填用默认
   - referenceNodeIds(可选):作为参考的图片节点 id 数组
2. generate_video — 生成视频。args:
   - prompt(必填):包含画面与动态描述的提示词,简体中文。用户用大白话描述想要的动态时,你要替他改写成专业的视频提示词
   - mode(可选):text_to_video(无参考图)、image_to_video(有参考图时优先)、first_last_frame
   - aspectRatio(可选):16:9、9:16、1:1、4:3、3:4、21:9
   - resolution(可选):480P、720P、1080P
   - durationSeconds(可选):4-15,默认 5
   - model(可选):从可用的视频模型 id 中选一个,不填用默认
   - referenceNodeIds(可选):参考节点 id 数组。用户想把某张图片做成动态视频时,把该图片节点 id 放进来(mode 用 image_to_video);用户想修改/重做某个已生成的视频时,把那个视频节点 id 放进来,新视频会在原节点上重新生成,而不是新建节点
3. edit_image — 修改已有图片。args:
   - referenceNodeIds(必填):要修改的图片节点 id 数组(取第一个)
   - prompt(必填):修改要求;editType 为 remove_bg 时可省略
   - editType(可选):modify(局部修改)、style_transfer(风格迁移)、remove_bg(去背景)
   - model(可选):从可用的图片模型 id 中选一个,不填用默认
4. read_canvas — 读取画布节点列表。当你需要了解画布内容、但对话上下文中信息不足时先调用它,不要凭空猜测节点 id。

输出协议:你必须只返回一个 JSON 对象(不要 markdown 代码块、不要任何其他文字):
{
  "message": "给用户看的回复",
  "actions": [
    { "id": "action_1", "tool": "generate_image", "label": "给用户看的动作描述", "args": {} }
  ]
}

规则:
1. 纯聊天时 actions 返回空数组 []。
2. 只有当你确信用户想在画布上执行操作时才输出工具调用;意图不清时在 message 里追问,不要输出 actions。
3. 一轮可以输出多个工具调用(例如同时生成两张不同风格的图)。
4. 引用节点时使用上下文中给出的节点 id,不要编造。
5. 工具的执行结果会以「工具结果」的形式出现在后续对话里;根据结果向用户汇报,不要在结果返回前声称操作已完成。
6. message 必须使用简体中文,语气自然友好,简洁不说教。
7. 图片模型和视频模型是两套独立列表,绝不能混用:generate_image/edit_image 只能用图片模型 id,generate_video 只能用视频模型 id。
8. 用户选中或 @ 了图片节点并说"做成视频/动起来"时,用 generate_video + referenceNodeIds 引用该图片节点;把他的大白话翻译成包含主体、动作、镜头运动的提示词。
9. 用户对已生成的视频不满意、描述要改的地方时,再次调用 generate_video,referenceNodeIds 里同时带上那个视频节点的 id 和它所用的图片节点 id(这样仍是图生视频,画面不跑偏),prompt 按用户的新要求改写,视频会在原节点上重新生成。`

function isLikelyStringEnd(candidate: string, quoteIndex: number): boolean {
  let nextIndex = quoteIndex + 1
  while (/\s/.test(candidate[nextIndex] ?? '')) nextIndex += 1
  const next = candidate[nextIndex]
  if (!next || next === ':' || next === '}' || next === ']') return true
  if (next !== ',') return false

  let followingIndex = nextIndex + 1
  while (/\s/.test(candidate[followingIndex] ?? '')) followingIndex += 1
  const following = candidate[followingIndex]
  return !following || /["{}[\]0-9tfn-]/.test(following)
}

function normalizeJsonCandidate(candidate: string): string {
  const source = candidate.replace(/[“”]/g, '"')
  let output = ''
  let inString = false
  let escaped = false

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]
    if (inString) {
      if (escaped) {
        output += char
        escaped = false
      } else if (char === '\\') {
        output += char
        escaped = true
      } else if (char === '"') {
        if (isLikelyStringEnd(source, index)) {
          output += char
          inString = false
        } else {
          output += '\\"'
        }
      } else if (char === '\n') {
        output += '\\n'
      } else if (char === '\r') {
        output += '\\r'
      } else if (char === '\t') {
        output += '\\t'
      } else {
        output += char
      }
      continue
    }

    if (char === '"') {
      inString = true
      output += char
      continue
    }

    if (char === ',') {
      let nextIndex = index + 1
      while (/\s/.test(source[nextIndex] ?? '')) nextIndex += 1
      if (source[nextIndex] === '}' || source[nextIndex] === ']') continue
    }
    output += char
  }

  return output
}

function parseDirectJson(candidate: string): unknown | undefined {
  const value = candidate.trim().replace(/^﻿/, '')
  for (const attempt of [value, normalizeJsonCandidate(value)]) {
    try {
      return JSON.parse(attempt)
    } catch {
      // 继续尝试规范化后的候选
    }
  }
  return undefined
}

const AGENT_PAYLOAD_KEYS = new Set(['message', 'actions'])
const WRAPPER_KEYS = ['content', 'text', 'result', 'data', 'output', 'response']

function hasAgentPayloadShape(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  return Object.keys(value).some((key) => AGENT_PAYLOAD_KEYS.has(key))
}

function unwrapJsonPayload(value: unknown, depth = 0): unknown {
  if (depth >= 6) return value
  if (typeof value === 'string') {
    const parsed = parseDirectJson(value)
    return parsed === undefined ? value : unwrapJsonPayload(parsed, depth + 1)
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const unwrapped = unwrapJsonPayload(item, depth + 1)
      if (hasAgentPayloadShape(unwrapped)) return unwrapped
    }
    return value
  }
  if (!value || typeof value !== 'object') return value
  if (hasAgentPayloadShape(value)) return value

  const obj = value as Record<string, unknown>
  for (const key of WRAPPER_KEYS) {
    if (!(key in obj)) continue
    const unwrapped = unwrapJsonPayload(obj[key], depth + 1)
    if (hasAgentPayloadShape(unwrapped)) return unwrapped
  }
  return value
}

function parseJsonCandidate(candidate: string): unknown | undefined {
  const parsed = parseDirectJson(candidate)
  return parsed === undefined ? undefined : unwrapJsonPayload(parsed)
}

function findBalancedJsonObjects(content: string): string[] {
  const candidates: string[] = []
  for (let start = 0; start < content.length; start += 1) {
    if (content[start] !== '{') continue
    let depth = 0
    let inString = false
    let escaped = false
    for (let index = start; index < content.length; index += 1) {
      const char = content[index]
      if (inString) {
        if (escaped) escaped = false
        else if (char === '\\') escaped = true
        else if (char === '"') inString = false
        continue
      }
      if (char === '"') inString = true
      else if (char === '{') depth += 1
      else if (char === '}') {
        depth -= 1
        if (depth === 0) {
          candidates.push(content.slice(start, index + 1))
          start = index
          break
        }
      }
    }
  }
  return candidates
}

/**
 * 从 LLM 返回内容中提取 JSON 对象。
 * 处理常见情况：直接 JSON、markdown 代码块、前后杂音、字符串内裸换行和尾逗号。
 */
export function extractJson(content: string): unknown {
  const trimmed = content.trim()
  const candidates = [trimmed]
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlockMatch?.[1]) candidates.push(codeBlockMatch[1])
  candidates.push(...findBalancedJsonObjects(trimmed))

  for (const candidate of candidates) {
    const parsed = parseJsonCandidate(candidate)
    if (parsed !== undefined) return parsed
  }

  throw new AgentError('PARSE_FAILED', '模型返回格式异常，请重试或切换模型。')
}

/** 解析并校验工具调用数组，丢弃非法项 */
export function parseAgentToolCalls(value: unknown): AgentToolCall[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .filter((item) => typeof item.tool === 'string' && AGENT_TOOL_NAMES.has(item.tool))
    .map((item, index) => ({
      id: typeof item.id === 'string' && item.id ? item.id : `action_${index + 1}`,
      tool: item.tool as AgentToolName,
      label:
        typeof item.label === 'string' && item.label
          ? item.label
          : String(item.tool),
      args:
        item.args && typeof item.args === 'object' && !Array.isArray(item.args)
          ? (item.args as Record<string, unknown>)
          : {},
    }))
}

/** 把解析后的 JSON 整理为标准响应 */
export function parseAgentChatResponse(
  parsed: unknown,
  rawLlmResponse = '',
): AgentChatResponse {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new AgentError('PARSE_FAILED', 'LLM 返回内容不是 JSON 对象')
  }
  const obj = parsed as Record<string, unknown>
  const message = typeof obj.message === 'string' ? obj.message.trim() : ''
  if (!message) {
    throw new AgentError('PARSE_FAILED', 'LLM 返回的 message 为空')
  }
  return {
    message,
    actions: parseAgentToolCalls(obj.actions),
    rawLlmResponse,
  }
}

/**
 * 解析模型回复；模型完全没按协议输出 JSON（纯文本闲聊）时，
 * 降级为普通聊天回复而不是报错——自由对话在任何模型下都不能硬失败。
 * 只有当内容明显是"尝试输出 JSON 但写坏了"时才抛 PARSE_FAILED。
 */
export function parseAgentChatResponseOrFallback(raw: string): AgentChatResponse {
  try {
    return parseAgentChatResponse(extractJson(raw), raw)
  } catch (err) {
    if (err instanceof AgentError && err.code === 'PARSE_FAILED') {
      const fallback = raw.trim()
      if (fallback && !fallback.startsWith('{') && !fallback.startsWith('```')) {
        return {
          message: fallback.slice(0, 4000),
          actions: [],
          rawLlmResponse: raw,
        }
      }
    }
    throw err
  }
}

/** 把对话历史(含工具结果)渲染成给模型的文本 */
export function buildConversationText(history: AgentChatTurn[]): string {
  return history
    .slice(-20)
    .map((turn) => {
      const lines: string[] = []
      if (turn.role === 'user') {
        lines.push(`用户：${turn.content}`)
        for (const result of turn.toolResults ?? []) {
          lines.push(
            `工具结果（${result.tool}）：${result.ok ? '成功' : '失败'} — ${result.summary}`,
          )
        }
      } else {
        lines.push(`助手：${turn.content}`)
        for (const action of turn.actions ?? []) {
          lines.push(`助手请求执行工具：${action.tool}（${action.label}）`)
        }
      }
      return lines.join('\n')
    })
    .join('\n')
}

export function buildCanvasContext(req: AgentChatRequest): string {
  if (!Array.isArray(req.canvas) || req.canvas.length === 0) {
    return '当前画布为空（没有任何节点）。'
  }
  const lines = req.canvas.slice(0, 40).map((node) => {
    const parts = [`- 节点 ${node.id}（${node.type}）「${node.title}」`]
    if (node.prompt) parts.push(`提示词：${node.prompt.slice(0, 200)}`)
    if (node.status) parts.push(`状态：${node.status}`)
    return parts.join('，')
  })
  return `当前画布节点：\n${lines.join('\n')}`
}

/**
 * Agent 对话：组装上下文 → 调用 LLM → 解析 { message, actions }。
 */
// Codex CLI 冷启动 + 长上下文经常超过 90s（默认 fetch 60s 更不够），
// Agent 调用统一放宽到 5 分钟；也可通过环境变量覆盖。
const AGENT_LLM_TIMEOUT_MS = (() => {
  const raw = Number(process.env.MOK_AGENT_LLM_TIMEOUT_MS ?? '')
  return Number.isFinite(raw) && raw > 0 ? raw : 300_000
})()

export async function chatWithAgent(
  req: AgentChatRequest,
): Promise<AgentChatResponse> {
  if (!req || !Array.isArray(req.history) || req.history.length === 0) {
    throw new AgentError('INVALID_INPUT', 'history 不能为空')
  }
  const lastTurn = req.history.at(-1)
  if (!lastTurn || lastTurn.role !== 'user' || typeof lastTurn.content !== 'string') {
    throw new AgentError('INVALID_INPUT', 'history 最后一条必须是用户消息')
  }

  const settings = await getSettings()
  const model = req.model?.trim() || settings.llmModel?.trim()
  if (!model) {
    throw new AgentError('LLM_CONFIG_MISSING', '未配置 LLM 模型，请在设置中配置 llmModel')
  }

  const imageModels = settings.imageModels?.length > 0
    ? settings.imageModels.join(', ')
    : 'jimeng'
  const videoModels = settings.videoModels?.length > 0
    ? settings.videoModels.join(', ')
    : 'seedance-2.0'
  const capabilityContext = `当前工作台可用图片模型 id：${imageModels}；可用视频模型 id：${videoModels}。`
  const systemPrompt = `${SYSTEM_PROMPT}\n\n${capabilityContext}\n\n${buildCanvasContext(req)}`
  const userMessage = buildConversationText(req.history)

  let result
  try {
    result = await generateAgentReply(model, systemPrompt, userMessage, {
      outputFormat: 'json',
      timeoutMs: AGENT_LLM_TIMEOUT_MS,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new AgentError('LLM_CALL_FAILED', `LLM 调用失败：${msg}`)
  }

  return parseAgentChatResponseOrFallback(result.content)
}
