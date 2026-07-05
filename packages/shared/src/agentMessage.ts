// 即梦 Flow 工作台 - Agent 共享类型
// 参考 PRD 8.7（Agent Prompt 优化流程）、10.5（Agent 接口请求/响应示例）、
//       11.4（AgentMessage 数据模型）、9.4（Agent 数据流）。

/** Agent 角色模式 */
export type AgentRole = 'general' | 'director' | 'visual' | 'editor'

/** Agent 角色显示信息 */
export interface AgentRoleInfo {
  id: AgentRole
  name: string
  description: string
  icon: string
  color: string
}

/** 所有可用角色信息 */
export const AGENT_ROLES: AgentRoleInfo[] = [
  { id: 'general', name: '通用助手', description: '全能型 AI 助手，涵盖创意、视觉、剪辑等多种能力', icon: '✨', color: '#6366f1' },
  { id: 'director', name: '创意导演', description: '擅长故事策划、分镜设计、脚本撰写和创意构思', icon: '🎬', color: '#f59e0b' },
  { id: 'visual', name: '视觉设计师', description: '专注于图片生成、风格优化、构图设计和图像编辑', icon: '🎨', color: '#ec4899' },
  { id: 'editor', name: '剪辑师', description: '专注于视频生成、转场设计、节奏控制和后期编辑', icon: '✂️', color: '#10b981' },
]

/** Agent 创作模板 */
export interface AgentTemplate {
  id: string
  name: string
  description: string
  icon: string
  prompt: string
  /** 推荐角色模式 */
  defaultRole?: AgentRole
}

/** 预设创作模板 */
export const AGENT_TEMPLATES: AgentTemplate[] = [
  {
    id: 'product_poster',
    name: '产品海报',
    description: '生成产品宣传海报，突出核心卖点，现代简约风格',
    icon: '📢',
    prompt: '帮我设计一个产品宣传海报，需要突出产品的核心卖点，使用现代简约风格，画面干净、有冲击力，适合商业推广',
    defaultRole: 'visual',
  },
  {
    id: 'storyboard',
    name: '故事分镜',
    description: '写短视频脚本并拆分4-6个镜头分镜',
    icon: '🎬',
    prompt: '帮我写一个30秒的短视频脚本，并拆分成4-6个镜头分镜，每个镜头包含详细的画面描述和提示词',
    defaultRole: 'director',
  },
  {
    id: 'character_design',
    name: '角色设计',
    description: '设计独特角色形象，含外貌、服装、性格标签',
    icon: '👤',
    prompt: '帮我设计一个独特的角色形象，包括外貌特征、服装搭配、性格标签和背景故事，生成角色卡',
    defaultRole: 'visual',
  },
  {
    id: 'social_cover',
    name: '社交封面',
    description: '生成社交媒体封面图，适合小红书/Instagram',
    icon: '📱',
    prompt: '帮我生成一张社交媒体封面图，适合放在小红书或Instagram，风格时尚、色彩鲜明、有吸引力',
    defaultRole: 'visual',
  },
  {
    id: 'product_video',
    name: '产品视频',
    description: '生成产品展示短视频，含动态镜头和转场',
    icon: '🎥',
    prompt: '帮我做一个产品展示短视频，包含动态镜头、产品细节特写和流畅的转场效果，时长5-10秒',
    defaultRole: 'editor',
  },
  {
    id: 'scene_concept',
    name: '场景概念',
    description: '生成场景概念图，含光影、构图和氛围设计',
    icon: '🏞️',
    prompt: '帮我生成一个场景概念图，包含精心设计的光影效果、构图布局和氛围营造，适合作为电影或游戏场景参考',
    defaultRole: 'visual',
  },
]

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
  /** Agent 详细思考过程（可折叠展示给用户） */
  thinking?: string
  /** Agent 判断的用户意图 */
  intent?: AgentIntent
  /** 建议参数（intent==='edit' 时包含 editType 等） */
  suggestedParams?: AgentSuggestedParams
  /** 分镜/故事板数据（intent==='story_mode' 时） */
  storyboard?: StoryboardData
  createdAt: string
}

/**
 * Agent 判断的用户意图类型。
 * 参考：前端根据 intent 展示不同的技能加载和生成确认卡片。
 */
export type AgentIntent = 'image' | 'video' | 'text' | 'image_then_video' | 'story_mode' | 'edit'

/**
 * 分镜/故事板单条镜头
 */
export interface StoryboardItem {
  id: string
  /** 镜头序号 */
  shotNumber: number
  /** 镜头描述（给用户看） */
  shotDescription: string
  /** 生成提示词 */
  prompt: string
  /** 生成后的图片 assetId */
  imageAssetId?: string
  /** 生成后的视频 assetId */
  videoAssetId?: string
}

/**
 * 分镜/故事板数据
 */
export interface StoryboardData {
  /** 故事标题 */
  title: string
  /** 整体风格描述 */
  style: string
  /** 镜头列表 */
  items: StoryboardItem[]
}

/**
 * Agent 建议的参数（参考 PRD 8.7、10.5）
 */

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

/** Agent 消息角色 */
export type AgentMessageRole = 'user' | 'assistant' | 'system'

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
  /** Agent 角色模式（可选，默认 'general'） */
  role?: AgentRole
}

/**
 * POST /api/agent/prompt-optimize 响应体。
 * 参考 PRD 8.7、10.5。
 */
export interface PromptOptimizeResponse {
  /** Agent 思考说明（自然语言，给用户看） */
  reasoning: string
  /** Agent 详细思考过程（可折叠展示给用户） */
  thinking?: string
  /** Agent 判断的用户意图：image / video / text / image_then_video / story_mode */
  intent?: AgentIntent
  /** 分镜/故事板数据（intent==='story_mode' 时） */
  storyboard?: StoryboardData
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
