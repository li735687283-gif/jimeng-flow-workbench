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
用户会给出一个粗略的创作想法，你需要判断用户的意图，然后整理成适合"即梦"图像或视频生成模型的提示词。

你必须严格返回一个 JSON 对象（不要包含任何 markdown 代码块标记、不要任何解释性文字），结构如下：
{
  "reasoning": "简要说明你为什么这样优化（1-2 句话，给用户看）",
  "thinking": "详细的思考过程：先分析用户意图（生成图片、生成视频、纯文本对话、故事分镜），然后分析画面元素、风格、镜头等，最后给出优化策略（3-5 句话，可折叠展示给用户）",
  "intent": "image 或 video 或 text 或 image_then_video 或 story_mode 或 edit",
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

当 intent 为 "story_mode" 时，还必须返回 storyboard 字段：
{
  "reasoning": "简要说明",
  "thinking": "详细思考过程",
  "intent": "story_mode",
  "storyboard": {
    "title": "故事标题",
    "style": "整体视觉风格描述（如：中国水墨画风格、赛博朋克风格、写实电影风格）",
    "items": [
      {
        "shotNumber": 1,
        "shotDescription": "镜头描述（给用户看，如：开场月光下的庭院）",
        "prompt": "详细的图片生成提示词（英文或中文，包含主体、场景、风格、光线、构图等）"
      },
      ...
    ]
  },
  "optimizedPrompt": "...",
  "negativePrompt": "...",
  "suggestedParams": { ... },
  "proposedActions": [ ... ]
}

要求：
1. intent 字段必须严格为以下之一：
   - "image"：用户明确要求生成图片（如"生成一张图"、"画一个..."）
   - "video"：用户明确要求生成单个视频（如"生成视频"、"做一段视频"）
   - "text"：用户只是纯文本对话，不需要生成内容
   - "image_then_video"：用户可能先生成图片，再基于图片生成视频（如"做一个视频海报"）
   - "story_mode"：用户要求做一个故事/视频/分镜/剧情类内容（如"帮我做一个30秒中秋月饼带货视频"、"写个故事然后生成视频"、"做一个韩信背水一战的短片"、"做分镜"）
   - "edit"：用户要求修改/编辑已有图片（如"修改图片"、"把这张图改成油画风格"、"去掉背景"、"抠图"）
2. 当用户要求"做一个视频"、"写个故事"、"做分镜"、"做个短片"等故事类需求时，优先使用 "story_mode" 意图。
3. 当 intent 为 "story_mode" 时，必须返回 storyboard 字段：
   - storyboard.items 应该包含 4-8 个镜头，每个镜头有独立的 shotDescription 和 prompt
   - storyboard.style 描述整体视觉风格，确保所有镜头的风格一致
   - 如果用户没有指定风格，根据主题自动推断合适的风格
4. thinking 字段要详细展示你的分析过程，包括意图识别、画面拆解、优化策略。
5. optimizedPrompt 要具体、可执行、细节丰富，包含主体、场景、风格、镜头、光线、材质、构图等。
6. negativePrompt 列出常见需要避免的内容。
7. suggestedParams 给出合理的尺寸和数量建议（width/height 用 1024 或 1280，count 用 1-4）。
   当 intent 为 "edit" 时，suggestedParams 中必须包含 editType 字段：
   - "style_transfer"：用户要求改变图片风格（如"转成油画风格"、"改成水墨画风格"）
   - "modify"：用户要求修改图片内容（如"把衣服换成红色"、"给图片加个帽子"）
   - "remove_bg"：用户要求去掉背景/抠图（如"去掉背景"、"抠图"、"透明背景"）
8. proposedActions 至少给一个建议动作，例如 create_prompt_node（创建 Prompt 节点）或 overwrite_prompt（覆盖当前 Prompt）。
9. 只返回 JSON，不要有任何其他文字。`

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

/** 安全读取 intent 字段 */
function parseIntent(v: unknown): PromptOptimizeResponse['intent'] {
  if (v === 'image' || v === 'video' || v === 'text' || v === 'image_then_video' || v === 'story_mode' || v === 'edit') return v
  return undefined
}

/** 安全解析 storyboard 字段 */
function parseStoryboard(v: unknown): PromptOptimizeResponse['storyboard'] {
  if (!v || typeof v !== 'object') return undefined
  const obj = v as Record<string, unknown>

  const title = typeof obj.title === 'string' ? obj.title : ''
  const style = typeof obj.style === 'string' ? obj.style : ''

  let items: Array<{
    id: string
    shotNumber: number
    shotDescription: string
    prompt: string
    imageAssetId?: string
    videoAssetId?: string
  }> = []
  if (Array.isArray(obj.items)) {
    items = obj.items
      .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
      .map((item, index) => ({
        id: typeof item.id === 'string' ? item.id : `shot_${index + 1}`,
        shotNumber: typeof item.shotNumber === 'number' ? item.shotNumber : index + 1,
        shotDescription: typeof item.shotDescription === 'string' ? item.shotDescription : '',
        prompt: typeof item.prompt === 'string' ? item.prompt : '',
        imageAssetId: typeof item.imageAssetId === 'string' ? item.imageAssetId : undefined,
        videoAssetId: typeof item.videoAssetId === 'string' ? item.videoAssetId : undefined,
      }))
  }

  if (!title && items.length === 0) return undefined

  return { title, style, items }
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
    thinking: asString(obj.thinking, '', 'thinking'),
    intent: parseIntent(obj.intent),
    storyboard: parseStoryboard(obj.storyboard),
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
