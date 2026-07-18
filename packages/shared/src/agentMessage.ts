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
  color: string
}

/** 所有可用角色信息 */
export const AGENT_ROLES: AgentRoleInfo[] = [
  { id: 'general', name: '通用助手', description: '全能型 AI 助手，涵盖创意、视觉、剪辑等多种能力', color: '#d8d8d8' },
  { id: 'director', name: '创意导演', description: '擅长故事策划、分镜设计、脚本撰写和创意构思', color: '#c2c2c2' },
  { id: 'visual', name: '视觉设计师', description: '专注于图片生成、风格优化、构图设计和图像编辑', color: '#a8a8a8' },
  { id: 'editor', name: '剪辑师', description: '专注于视频生成、转场设计、节奏控制和后期编辑', color: '#8f8f8f' },
]

/** Agent 创作模板 */
export interface AgentTemplate {
  id: string
  name: string
  description: string
  prompt: string
  /** 推荐角色模式 */
  defaultRole?: AgentRole
}

/** 预设创作模板 */
export const AGENT_TEMPLATES: AgentTemplate[] = [
  {
    id: 'product_poster',
    name: '产品海报',
    description: '生成商业产品海报，突出卖点、材质与品牌气质',
    prompt: '请策划一张商业产品海报。优先使用当前画布中已引用的产品素材；若没有素材，则用可替换的通用产品完成概念。明确核心卖点、目标受众、主视觉构图、品牌色、文案层级、光影和材质表现，输出可直接用于图片生成的完整提示词，并推荐合适的画幅。',
    defaultRole: 'visual',
  },
  {
    id: 'storyboard',
    name: '故事分镜',
    description: '创作短片脚本，并拆成可生成的 4–6 个镜头',
    prompt: '请创作一个约30秒的短片方案，并拆分为4–6个连续镜头。为每个镜头写清景别、主体动作、环境、镜头运动、光影、时长和衔接关系，同时提供可直接生成画面的提示词。整体人物、场景和视觉风格必须连续一致，并以故事分镜形式输出。',
    defaultRole: 'director',
  },
  {
    id: 'character_design',
    name: '角色设计',
    description: '生成完整角色设定，统一外貌、服装与性格特征',
    prompt: '请设计一个具有辨识度的原创角色。定义角色身份、年龄感、体型、五官、发型、服装、配饰、主色、材质、性格标签和简短背景故事；同时规划正面主视图与关键细节，输出角色卡文案和可直接用于图片生成的完整提示词。',
    defaultRole: 'visual',
  },
  {
    id: 'social_cover',
    name: '社交封面',
    description: '生成适合小红书或 Instagram 的高识别度封面',
    prompt: '请设计一张适合小红书或Instagram发布的社交封面。突出一个清晰主题和强视觉焦点，兼顾缩略图识别度、标题安全区、色彩对比和移动端阅读；画面时尚但不过度堆叠。输出封面文案建议、构图说明和可直接用于图片生成的完整提示词。',
    defaultRole: 'visual',
  },
  {
    id: 'product_video',
    name: '产品视频概念',
    description: '生成 5–10 秒产品短片概念、镜头与转场方案',
    prompt: '请策划一个5–10秒的产品展示视频概念。优先使用当前画布中已引用的产品素材；若没有素材，则用可替换的通用产品完成概念。设计开场吸引点、产品运动、材质细节特写、镜头运动、光影变化、节奏和自然转场，输出可直接用于视频生成的完整提示词，并推荐画幅与时长。',
    defaultRole: 'editor',
  },
  {
    id: 'scene_concept',
    name: '产品场景概念',
    description: '将产品放入真实场景，设计环境、构图与氛围',
    prompt: '请为产品设计一张场景概念图。优先使用当前画布中已引用的产品素材；若没有素材，则用可替换的通用产品完成概念。让产品自然融入具有用途和故事感的环境，明确空间层次、主体比例、构图、机位、光线方向、色彩氛围、材质互动和品牌气质，输出可直接用于图片生成的完整提示词。',
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
  /** 生成后的图片节点 id，用于后续视频节点连线 */
  imageNodeId?: string
  /** 生成后的视频 assetId */
  videoAssetId?: string
  /** 生成后的视频节点 id，用于后续重复抽卡和定位 */
  videoNodeId?: string
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

/** 用户在发送前选择的 Agent 技能。技能按数组顺序执行。 */
export interface AgentSkillSelection {
  id: string
  label: string
  instruction: string
  /** 技能需要的主要输入，用于执行前校验和解释 */
  input?: 'text' | 'image' | 'video'
  /** 技能完成后预期产物 */
  output?: 'prompt' | 'image' | 'video' | 'storyboard'
  /** 展示给用户和 Agent 的简短执行步骤 */
  steps?: string[]
}

/** 发送给 Agent 的同一对话精简历史，只包含模型继续理解所需的可见内容。 */
export interface AgentConversationTurn {
  role: 'user' | 'assistant'
  content: string
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
  /** Agent 角色模式（可选，默认 'general'） */
  role?: AgentRole
  /** 当前对话最近的可见消息；新对话不携带此字段 */
  conversationHistory?: AgentConversationTurn[]
  /** 用户启用的技能链，按数组顺序执行 */
  skills?: AgentSkillSelection[]
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
