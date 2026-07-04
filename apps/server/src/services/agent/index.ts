// 即梦 Flow 后端 - Agent prompt orchestration service
// 组装系统提示词，调用 LLM provider client，解析结构化 JSON 输出。
// 参考 PRD 8.7（Agent Prompt 优化流程）、9.4（Agent 数据流）、10.5（接口示例）。
// 复用 Task 5 的 generateAgentReply client（services/llm）。

import type {
  PromptOptimizeRequest,
  PromptOptimizeResponse,
  AgentProposedAction,
  AgentSuggestedParams,
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

/** Agent 系统提示词：让 LLM 扮演 Prompt 优化专家，返回结构化 JSON */
const SYSTEM_PROMPT = `你是一位专业的 AI 图像/视频生成 Prompt 优化专家，服务于一个节点式创作工作台（即梦 Flow）。
用户会给出一个粗略的创作想法，你需要把它整理成适合"即梦"图像生成模型的提示词。

你必须严格返回一个 JSON 对象（不要包含任何 markdown 代码块标记、不要任何解释性文字），结构如下：
{
  "reasoning": "简要说明你为什么这样优化（1-2 句话，给用户看）",
  "optimizedPrompt": "优化后的完整提示词，包含主体、场景、风格、镜头、光线、材质、构图等要素，使用英文或中文均可，要具体可执行",
  "negativePrompt": "需要避免的内容，用逗号分隔，例如：多手指, 脸部变形, 低清晰度",
  "suggestedParams": {
    "width": 1024,
    "height": 1024,
    "count": 2
  },
  "proposedActions": [
    {
      "id": "action_1",
      "type": "create_prompt_node",
      "label": "创建 Prompt 节点"
    }
  ]
}

要求：
1. optimizedPrompt 要具体、可执行、细节丰富，包含主体、场景、风格、镜头、光线、材质、构图等。
2. negativePrompt 列出常见需要避免的内容。
3. suggestedParams 给出合理的尺寸和数量建议（width/height 用 1024 或 1280，count 用 1-4）。
4. proposedActions 至少给一个建议动作，例如 create_prompt_node（创建 Prompt 节点）或 overwrite_prompt（覆盖当前 Prompt）。
5. 只返回 JSON，不要有任何其他文字。`

/**
 * 从 LLM 返回内容中提取 JSON 对象。
 * 处理常见情况：直接 JSON、被 markdown 代码块包裹、前后有杂音。
 */
function extractJson(content: string): unknown {
  const trimmed = content.trim()
  // 直接尝试解析
  try {
    return JSON.parse(trimmed)
  } catch {
    // 继续
  }
  // 尝试去掉 markdown 代码块标记
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim())
    } catch {
      // 继续
    }
  }
  // 尝试提取第一个 { ... } 块
  const firstBrace = trimmed.indexOf('{')
  const lastBrace = trimmed.lastIndexOf('}')
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const slice = trimmed.slice(firstBrace, lastBrace + 1)
    try {
      return JSON.parse(slice)
    } catch {
      // 继续
    }
  }
  throw new AgentError('PARSE_FAILED', `无法从 LLM 输出中解析 JSON：${trimmed.slice(0, 200)}`)
}

/** 安全读取字符串字段 */
function asString(v: unknown, fallback = '', field: string): string {
  if (typeof v === 'string') return v
  if (v === undefined || v === null) return fallback
  throw new AgentError('PARSE_FAILED', `字段 ${field} 应为字符串，实际类型：${typeof v}`)
}

/** 安全读取数组字段 */
function asStringArray(v: unknown, field: string): string[] {
  if (!Array.isArray(v)) return []
  return v.filter((x): x is string => typeof x === 'string')
}

/** 解析 suggestedParams */
function parseSuggestedParams(v: unknown): AgentSuggestedParams {
  if (!v || typeof v !== 'object') return {}
  const obj = v as Record<string, unknown>
  const result: AgentSuggestedParams = {}
  if (typeof obj.width === 'number') result.width = obj.width
  if (typeof obj.height === 'number') result.height = obj.height
  if (typeof obj.count === 'number') result.count = obj.count
  // 透传其他已知字段
  for (const key of Object.keys(obj)) {
    if (key === 'width' || key === 'height' || key === 'count') continue
    const val = obj[key]
    if (val !== undefined && val !== null) {
      result[key] = val
    }
  }
  return result
}

/** 解析 proposedActions */
function parseProposedActions(v: unknown): AgentProposedAction[] {
  if (!Array.isArray(v)) return []
  return v
    .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
    .map((x, i) => ({
      id: typeof x.id === 'string' ? x.id : `action_${i + 1}`,
      type: typeof x.type === 'string' ? x.type : 'unknown',
      label: typeof x.label === 'string' ? x.label : '未知动作',
      payload:
        x.payload && typeof x.payload === 'object'
          ? (x.payload as Record<string, unknown>)
          : undefined,
    }))
}

/**
 * 优化 Prompt：组装上下文 → 调用 LLM → 解析结构化 JSON。
 * 参考 PRD 8.7、9.4、10.5。
 * M0 阶段上下文组装简化：前端传入 userIdea 字符串即可。
 * @param req PromptOptimizeRequest
 */
export async function optimizePrompt(
  req: PromptOptimizeRequest,
): Promise<PromptOptimizeResponse> {
  // 入参校验
  if (!req || typeof req.userIdea !== 'string' || req.userIdea.trim().length === 0) {
    throw new AgentError('INVALID_INPUT', 'userIdea 不能为空')
  }

  // 读取模型配置（req.model 优先，否则用 settings.llmModel）
  const settings = await getSettings()
  const model = req.model?.trim() || settings.llmModel?.trim()
  if (!model) {
    throw new AgentError('LLM_CONFIG_MISSING', '未配置 LLM 模型，请在设置中配置 llmModel')
  }

  // 组装用户消息（M0 简化：直接把 userIdea 作为用户消息）
  // contextNodeIds / selectedNodeId 透传到响应，M0 不真正读取节点 data
  const usedContextNodeIds = Array.isArray(req.contextNodeIds)
    ? req.contextNodeIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : []

  const userMessage = buildUserMessage(req.userIdea, usedContextNodeIds, req.selectedNodeId)

  // 调用 LLM provider（强制 json 输出格式，便于解析）
  let result
  try {
    result = await generateAgentReply(model, SYSTEM_PROMPT, userMessage, {
      outputFormat: 'json',
      timeoutMs: 90_000,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new AgentError('LLM_CALL_FAILED', `LLM 调用失败：${msg}`)
  }

  // 解析结构化 JSON
  const parsed = extractJson(result.content)
  if (!parsed || typeof parsed !== 'object') {
    throw new AgentError('PARSE_FAILED', 'LLM 返回内容不是 JSON 对象')
  }
  const obj = parsed as Record<string, unknown>

  const response: PromptOptimizeResponse = {
    reasoning: asString(obj.reasoning, '', 'reasoning'),
    optimizedPrompt: asString(obj.optimizedPrompt, '', 'optimizedPrompt'),
    negativePrompt: asString(obj.negativePrompt, '', 'negativePrompt'),
    suggestedParams: parseSuggestedParams(obj.suggestedParams),
    proposedActions: parseProposedActions(obj.proposedActions),
    usedContextNodeIds,
    rawLlmResponse: result.content,
  }

  if (!response.optimizedPrompt) {
    throw new AgentError('PARSE_FAILED', 'LLM 返回的 optimizedPrompt 为空')
  }

  return response
}

/**
 * 组装用户消息。
 * M0 简化：只透传 userIdea，附加节点上下文信息（仅 id，不读 data）。
 */
function buildUserMessage(
  userIdea: string,
  contextNodeIds: string[],
  selectedNodeId?: string,
): string {
  const lines: string[] = [userIdea]
  if (selectedNodeId) {
    lines.push(`（当前选中节点：${selectedNodeId}）`)
  }
  if (contextNodeIds.length > 0) {
    lines.push(`（已提供作为上下文的节点 id：${contextNodeIds.join(', ')}）`)
  }
  return lines.join('\n')
}
