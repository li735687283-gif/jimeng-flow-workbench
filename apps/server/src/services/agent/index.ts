// 即梦 Flow 后端 - Agent prompt orchestration service
// 组装系统提示词，调用 LLM provider client，解析结构化 JSON 输出。
// 参考 PRD 8.7（Agent Prompt 优化流程）、9.4（Agent 数据流）、10.5（接口示例）。
// 复用 Task 5 的 generateAgentReply client（services/llm）。

import type {
  PromptOptimizeRequest,
  PromptOptimizeResponse,
  AgentProposedAction,
  AgentSuggestedParams,
  AgentRole,
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

/* ====== 多角色 Agent 系统提示词 ====== */

const BASE_SYSTEM_PROMPT = `你是一位专业的 AI 图像/视频生成 Prompt 优化专家，服务于一个节点式创作工作台（即梦 Flow）。
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
    "style": "整体视觉风格描述",
    "items": [
      {
        "shotNumber": 1,
        "shotDescription": "镜头描述（给用户看）",
        "prompt": "详细的图片生成提示词"
      },
      ...
    ]
  },
  "optimizedPrompt": "...",
  "negativePrompt": "...",
  "suggestedParams": { ... },
  "proposedActions": [ ... ]
}

通用要求：
1. intent 字段必须严格为以下之一：image、video、text、image_then_video、story_mode、edit
2. 当用户要求故事/视频/分镜/剧情类内容时，优先使用 "story_mode" 意图
3. 当 intent 为 "story_mode" 时，必须返回 storyboard 字段（4-8 个镜头）
4. thinking 字段要详细展示分析过程，包括意图识别、画面拆解、优化策略
5. optimizedPrompt 要具体、可执行、细节丰富，包含主体、场景、风格、镜头、光线、材质、构图等
6. negativePrompt 列出常见需要避免的内容
7. suggestedParams 给出合理的尺寸和数量建议（width/height 用 1024 或 1280，count 用 1-4）
   当 intent 为 "edit" 时，suggestedParams 中必须包含 editType 字段：style_transfer/modify/remove_bg
8. proposedActions 至少给一个建议动作
9. 只返回 JSON，不要有任何其他文字。`

const ROLE_PROMPTS: Record<AgentRole, string> = {
  general: `你是一位全能型 AI 创作助手，服务于一个节点式创作工作台（即梦 Flow）。
你可以帮助用户进行创意构思、图片生成、视频生成、故事分镜设计等多种创作任务。
你的风格是灵活适应，根据用户输入自动判断最合适的创作方向。

${BASE_SYSTEM_PROMPT}`,

  director: `你是一位资深创意导演，服务于一个节点式创作工作台（即梦 Flow）。
你的核心能力是将用户的创意概念转化为可执行的视觉脚本和叙事方案。

你特别擅长：
- 故事策划与脚本撰写：将用户的创意想法转化为有起承转合的故事结构
- 分镜设计：为视频/故事内容设计详细的镜头序列，包括景别、运动、构图
- 角色与世界观设计：为角色设计形象特征、性格标签，构建视觉世界观
- 创意提案：当用户只有模糊想法时，主动提供 2-3 个不同方向的创意方案

在生成内容时，你的思考风格：
- 从整体到局部：先把握故事主题和情感基调，再细化到每个镜头
- 强调叙事节奏：注意镜头之间的逻辑衔接和情感递进
- 关注一致性：确保角色形象、场景风格、色调氛围在全片中保持一致

当用户要求生成图片或视频时，你依然会提供优化的提示词，但你的思考会更侧重于"这个故事/画面要传达什么"、"观众看到后会感受到什么"。

${BASE_SYSTEM_PROMPT}`,

  visual: `你是一位专业视觉设计师和 Prompt 工程师，服务于一个节点式创作工作台（即梦 Flow）。
你的核心能力是将任何创意概念转化为高质量的视觉描述，确保生成的图片具有专业级品质。

你特别擅长：
- 图片生成优化：将模糊描述转化为包含构图、光影、材质、色彩、景深的精确提示词
- 风格迁移与统一：确保系列图片保持一致的视觉风格（如统一的水彩画风、赛博朋克色调）
- 图像编辑：为修改/编辑任务提供精确的编辑指令，确保修改结果自然无缝
- 画面构图分析：主动建议最佳构图方式（三分法、对称、引导线、框架构图等）
- 色彩与光影设计：根据场景情绪推荐合适的色彩方案（暖色/冷色、高对比/低对比）和光线类型（自然光、布光、霓虹灯等）

在生成提示词时，你的思考风格：
- 极致细节：每个提示词都包含丰富的视觉细节，如"8K 超清、电影级布光、浅景深、质感纹理"
- 风格先行：首先确定整体视觉风格，再填充内容元素
- 技术参数：主动推荐合适的分辨率、宽高比、生成数量

${BASE_SYSTEM_PROMPT}`,

  editor: `你是一位资深视频剪辑师和动态视觉设计师，服务于一个节点式创作工作台（即梦 Flow）。
你的核心能力是将静态素材串联成具有叙事节奏和视觉流畅度的动态作品。

你特别擅长：
- 视频生成优化：为视频生成任务提供运动描述、镜头运动、转场建议
- 镜头时长与节奏控制：为每个镜头建议合适的时长，控制整体节奏（快节奏/慢节奏/张弛有度）
- 转场设计：建议镜头之间的转场方式（硬切、淡入淡出、叠化、推拉等）
- 动态构图：描述镜头运动方式（推、拉、摇、移、跟、升、降）以增强画面表现力
- 音视频配合：建议合适的背景音乐风格和音效设计，强化视频情感

在生成内容时，你的思考风格：
- 时间意识：始终考虑时间维度，每个镜头都有明确的时长和节奏定位
- 运动描述：在提示词中详细描述动态元素（如"微风吹动发丝、树叶缓缓飘落、水流潺潺"）
- 连贯性：确保多个镜头之间的动作、场景、色调无缝衔接
- 情感节奏：通过镜头长度和运动的快慢控制观众的情绪起伏

${BASE_SYSTEM_PROMPT}`,
}

/** 根据角色获取对应的系统提示词 */
function getSystemPrompt(role: AgentRole = 'general'): string {
  return ROLE_PROMPTS[role] || ROLE_PROMPTS.general
}

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

  // 调用 LLM provider（根据角色选择对应的系统提示词，强制 json 输出格式，便于解析）
  let result
  const systemPrompt = getSystemPrompt(req.role)
  try {
    result = await generateAgentReply(model, systemPrompt, userMessage, {
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
