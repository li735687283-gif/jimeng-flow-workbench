import type { AgentSkillSelection } from '@jimeng-flow/shared/agentMessage'

export type AgentSkillCategory = '基础' | '图像' | '导演' | '视频'

export interface AgentSkillDefinition extends AgentSkillSelection {
  description: string
  category: AgentSkillCategory
  input: 'text' | 'image' | 'video'
  output: 'prompt' | 'image' | 'video' | 'storyboard'
  steps: string[]
}

export const MAX_ACTIVE_AGENT_SKILLS = 3

export const AGENT_SKILL_CATEGORIES: AgentSkillCategory[] = [
  '基础',
  '图像',
  '导演',
  '视频',
]

export const AGENT_SKILLS: AgentSkillDefinition[] = [
  {
    id: 'prompt-polish',
    label: '提示词增强',
    description: '把零散想法整理成稳定、可执行的生成提示词。',
    instruction: '先澄清创作目标，再补齐主体、场景、风格、构图、光线和材质细节。',
    category: '基础',
    input: 'text',
    output: 'prompt',
    steps: ['澄清创作目标', '补齐生成细节'],
  },
  {
    id: 'image-retouch',
    label: '图片修改',
    description: '围绕引用图片做局部修改、重绘或背景处理。',
    instruction: '必须使用引用图片作为输入，保留未要求修改的主体和结构，只执行用户指定的改动。',
    category: '图像',
    input: 'image',
    output: 'image',
    steps: ['读取引用图片', '生成修改分支'],
  },
  {
    id: 'style-lock',
    label: '风格锁定',
    description: '提取参考图的色彩、材质和光线，保持系列一致。',
    instruction: '分析引用图片的色彩、材质、光线和构图规律，并将这些规律作为强风格约束应用到后续输出。',
    category: '图像',
    input: 'image',
    output: 'image',
    steps: ['提取风格特征', '应用一致性约束'],
  },
  {
    id: 'shot-design',
    label: '镜头设计',
    description: '补充景别、机位、运镜、光线和叙事节奏。',
    instruction: '从景别、机位、镜头运动、构图、光线和节奏角度设计可执行的镜头方案。',
    category: '导演',
    input: 'text',
    output: 'prompt',
    steps: ['设计镜头语言', '补充节奏与光线'],
  },
  {
    id: 'storyboard',
    label: '分镜拆解',
    description: '把脚本拆成连续镜头，并生成可继续创作的分镜节点。',
    instruction: '将需求识别为 story_mode，拆成 4-6 个叙事连续的镜头，每个镜头提供画面描述和生成提示词。',
    category: '导演',
    input: 'text',
    output: 'storyboard',
    steps: ['拆解叙事节拍', '创建分镜节点'],
  },
  {
    id: 'image-to-video',
    label: '图片转视频',
    description: '根据参考图规划运动、镜头和首帧一致性。',
    instruction: '必须使用引用图片作为视频视觉起点，优先保持主体一致，并补充合理的镜头运动和动态描述。',
    category: '视频',
    input: 'image',
    output: 'video',
    steps: ['读取首帧内容', '设计动态与运镜'],
  },
]

export const AGENT_SKILL_INPUT_LABELS: Record<AgentSkillDefinition['input'], string> = {
  text: '文字需求',
  image: '引用图片',
  video: '引用视频',
}

export const AGENT_SKILL_OUTPUT_LABELS: Record<AgentSkillDefinition['output'], string> = {
  prompt: '生成提示词',
  image: '图片节点',
  video: '视频节点',
  storyboard: '分镜节点',
}

export function getAgentSkillById(id: string): AgentSkillDefinition | undefined {
  return AGENT_SKILLS.find((skill) => skill.id === id)
}

export function getRecommendedAgentSkillIds(
  draft: string,
  contextNodeTypes: readonly string[],
): string[] {
  const normalized = draft.toLowerCase()
  const hasImage = contextNodeTypes.includes('image')
  const recommendations: string[] = []
  const add = (id: string) => {
    if (!recommendations.includes(id)) recommendations.push(id)
  }

  if (/(分镜|脚本|故事|storyboard|shot list)/i.test(normalized)) add('storyboard')
  if (/(镜头|运镜|机位|短片|广告片|video|cinematic)/i.test(normalized)) add('shot-design')
  if (hasImage && /(视频|动起来|动画|运镜|image to video)/i.test(normalized)) add('image-to-video')
  if (hasImage && /(修改|改图|重绘|换背景|去除|修图|edit)/i.test(normalized)) add('image-retouch')
  if (hasImage && /(风格|一致|系列|参考|style)/i.test(normalized)) add('style-lock')

  if (hasImage && recommendations.length === 0) {
    add('image-retouch')
    add('style-lock')
  }
  if (draft.trim()) add('prompt-polish')
  if (recommendations.length === 0) {
    add('prompt-polish')
    add('shot-design')
  }

  return recommendations.slice(0, 3)
}

export function getAgentSkillInputIssue(
  skill: AgentSkillDefinition,
  contextNodeTypes: readonly string[],
): string | null {
  if (skill.input === 'image' && !contextNodeTypes.includes('image')) {
    return `${skill.label}需要先引用一个图片节点`
  }
  if (skill.input === 'video' && !contextNodeTypes.includes('video')) {
    return `${skill.label}需要先引用一个视频节点`
  }
  return null
}

export function toAgentSkillSelections(
  skills: readonly AgentSkillDefinition[],
): AgentSkillSelection[] {
  return skills.map(({ id, label, instruction, input, output, steps }) => ({
    id,
    label,
    instruction,
    input,
    output,
    steps,
  }))
}
