// 即梦 Flow 工作台 - Jimeng Image Generate 节点数据模型与生成请求
// 参考 PRD 6.2（节点定义）、8.3（生成任务状态）、8.6（设置与密钥）、
//       10.3（生成接口请求/响应示例）、11.2（Asset 数据模型）、13.12（节点状态）。
//
// 本文件为前后端共享类型与常量。前端通过 subpath 导入：
//   import { GenerateNodeData, IMAGE_MODELS } from '@jimeng-flow/shared/generateNode'

/** 生成任务状态机（参考 PRD 8.3、13.12） */
export type GenerationStatus =
  | 'idle'
  | 'queued'
  | 'running'
  | 'success'
  | 'error'

/**
 * Generate 节点数据模型。
 * 参考 PRD 6.2、11.7（按 10.3 推断）、8.3。
 */
export interface GenerateNodeData {
  /** 节点 id（与 React Flow node.id 一致） */
  id: string
  type: 'generate'
  /** 节点标题（显示在卡片外侧上方） */
  title: string
  /** 当前任务状态 */
  status: GenerationStatus
  /** 错误信息（status==='error' 时） */
  error?: string

  /** Prompt 文本，来自上游文本节点或自填 */
  prompt: string
  /** 上游 Prompt 节点 id（可选，用于追溯） */
  promptSourceNodeId?: string

  /** 模型 id，例如 'jimeng-3.0'、'jimeng-2.0' */
  model: string
  /** 输出图宽度 */
  width: number
  /** 输出图高度 */
  height: number
  /** 生成张数 */
  count: number
  /** 随机种子（可选，空时由后端/上游随机） */
  seed?: number | null

  /** 图生图参考图 Asset id 数组（可选，文生图时为空） */
  inputImageAssetIds: string[]

  /** 生成成功的 Asset id 数组 */
  outputAssetIds: string[]

  /** 图片节点生成历史，用于恢复版本和复用参数 */
  generationRuns?: ImageGenerationRun[]

  /** 最近一次生成任务 id（由后端 generations service 分配） */
  generationId?: string

  /** 创建时间 ISO 字符串 */
  createdAt: string
  /** 最近更新时间 ISO 字符串 */
  updatedAt: string
}

/**
 * POST /api/generations 请求体。
 * 参考 PRD 10.3 生成请求示例。
 */
export interface GenerationRequest {
  /** 工作流 id */
  flowId?: string
  /** 调用方节点 id（Generate 节点） */
  nodeId: string
  /** 媒体类型，图片生成固定为 'image' */
  mediaType: 'image'
  /** Prompt 文本 */
  prompt: string
  /** 图生图参考图路径或 Asset id 列表 */
  inputImages?: string[]
  /** 模型 id */
  model: string
  /** 输出宽度 */
  width: number
  /** 输出高度 */
  height: number
  /** 生成张数 */
  count: number
  /** 随机种子（可选，null 表示随机） */
  seed?: number | null
}

/** 单张生成图结果 */
export interface GenerationResult {
  /** 该张图的临时 URL 或最终 Asset id（取决于 dreamina 返回结构） */
  url?: string
  /** 图片远端 URL（如果 dreamina 返回的是远端 URL） */
  remoteUrl?: string
  /** 本地保存后的 Asset id（保存成功后才有） */
  assetId?: string
  /** CLI 下载到本机的临时文件路径（后端保存 Asset 前使用） */
  localPath?: string
  /** 第三方 API 返回的 base64 图片数据 */
  base64Data?: string
  /** base64 图片的 MIME 类型，默认 image/png */
  mimeType?: string
  /** 该张图对应的 seed（若上游返回） */
  seed?: number
}

/**
 * GET /api/generations/:id 与 POST /api/generations/:id/retry 响应体。
 * 参考 PRD 10.3。
 */
export interface GenerationResponse {
  /** 生成任务 id */
  id: string
  /** 关联的节点 id */
  nodeId: string
  /** 任务状态 */
  status: GenerationStatus
  /** 错误信息（status==='error' 时） */
  error?: string
  /** 生成结果列表（成功后才有） */
  results?: GenerationResult[]
  /** 创建时间 ISO */
  createdAt: string
  /** 完成时间 ISO */
  finishedAt?: string
}

/** 图片节点的一次生成版本记录 */
export interface ImageGenerationRun {
  /** 本地历史记录 id，默认与 generationId 一致 */
  id: string
  /** 后端生成任务 id */
  generationId: string
  /** 该次任务状态 */
  status: GenerationStatus
  /** 本次生成得到的 Asset id 列表 */
  assetIds: string[]
  /** 本次使用的 Prompt */
  prompt: string
  /** 本次使用的模型 id */
  model: string
  /** 本次输出宽度 */
  width: number
  /** 本次输出高度 */
  height: number
  /** 本次生成张数 */
  count: number
  /** 本次随机种子 */
  seed?: number | null
  /** 本次引用的输入图片 Asset id */
  inputImageAssetIds: string[]
  /** 前端画质选项 */
  quality?: string
  /** 前端比例选项 */
  ratio?: string
  /** 前端清晰度选项 */
  resolution?: string
  /** 失败信息 */
  error?: string
  /** 创建时间 ISO */
  createdAt: string
  /** 完成时间 ISO */
  finishedAt?: string
}

const MAX_IMAGE_GENERATION_RUNS = 20
const GENERATION_STATUSES = new Set<GenerationStatus>([
  'idle',
  'queued',
  'running',
  'success',
  'error',
])

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isImageGenerationRun(value: unknown): value is ImageGenerationRun {
  if (!value || typeof value !== 'object') return false
  const run = value as Partial<ImageGenerationRun>
  return (
    typeof run.id === 'string' &&
    typeof run.generationId === 'string' &&
    typeof run.status === 'string' &&
    GENERATION_STATUSES.has(run.status as GenerationStatus) &&
    isStringArray(run.assetIds) &&
    typeof run.prompt === 'string' &&
    typeof run.model === 'string' &&
    typeof run.width === 'number' &&
    typeof run.height === 'number' &&
    typeof run.count === 'number' &&
    isStringArray(run.inputImageAssetIds) &&
    typeof run.createdAt === 'string'
  )
}

export function normalizeImageGenerationRuns(
  value: unknown,
): ImageGenerationRun[] {
  if (!Array.isArray(value)) return []
  return value.filter(isImageGenerationRun).slice(-MAX_IMAGE_GENERATION_RUNS)
}

export function appendImageGenerationRun(
  value: unknown,
  run: ImageGenerationRun,
): ImageGenerationRun[] {
  const runs = normalizeImageGenerationRuns(value).filter(
    (item) => item.generationId !== run.generationId,
  )
  runs.push(run)
  return runs.slice(-MAX_IMAGE_GENERATION_RUNS)
}

/** 可选图片模型列表（对齐 dreamina CLI model_version） */
export const IMAGE_MODELS = [
  { id: 'jimeng-5.0', label: '即梦 5.0', description: 'CLI model_version=5.0' },
  { id: 'jimeng-4.7', label: '即梦 4.7', description: 'CLI model_version=4.7' },
  { id: 'jimeng-3.0', label: '即梦 3.0', description: 'CLI model_version=3.0' },
  { id: 'jimeng', label: '即梦（默认）', description: '使用 CLI 默认模型' },
] as const

export function isJimengImageModel(modelId: string): boolean {
  return IMAGE_MODELS.some((model) => model.id === modelId)
}

/** 可选图片尺寸（参考 reference-quality-ratio-menu.png、PRD 11.3 defaultSize） */
export const IMAGE_SIZES: { id: string; label: string; width: number; height: number }[] = [
  { id: '1024x1024', label: '1:1 · 1024²', width: 1024, height: 1024 },
  { id: '1024x1792', label: '9:16 · 1024×1792', width: 1024, height: 1792 },
  { id: '1792x1024', label: '16:9 · 1792×1024', width: 1792, height: 1024 },
  { id: '1024x1536', label: '2:3 · 1024×1536', width: 1024, height: 1536 },
  { id: '1536x1024', label: '3:2 · 1536×1024', width: 1536, height: 1024 },
  { id: '2048x2048', label: '1:1 · 2048²', width: 2048, height: 2048 },
]

/** 可选生成张数（参考 reference-count-menu.png） */
export const IMAGE_COUNTS: number[] = [1, 2, 4]

/** Generate 节点字段默认值（参考 PRD 11.3 默认图片参数） */
const GENERATE_DEFAULTS = {
  prompt: '',
  model: 'jimeng-3.0',
  width: 1024,
  height: 1024,
  count: 1,
  seed: null as number | null,
  inputImageAssetIds: [] as string[],
  outputAssetIds: [] as string[],
  status: 'idle' as GenerationStatus,
}

/**
 * 将任意 partial 节点数据合并为完整的 GenerateNodeData。
 * registry 创建的节点初始只有 { title, status }，这里补齐生成相关字段的默认值。
 * 参考 videoNode.ts 的 mergeVideoDefaults 模式。
 */
export function mergeGenerateDefaults(
  data: Partial<GenerateNodeData>,
): GenerateNodeData {
  return {
    id: data.id ?? '',
    type: 'generate',
    title: data.title ?? '',
    status: data.status ?? GENERATE_DEFAULTS.status,
    error: data.error,
    prompt: data.prompt ?? GENERATE_DEFAULTS.prompt,
    promptSourceNodeId: data.promptSourceNodeId,
    model: data.model ?? GENERATE_DEFAULTS.model,
    width: data.width ?? GENERATE_DEFAULTS.width,
    height: data.height ?? GENERATE_DEFAULTS.height,
    count: data.count ?? GENERATE_DEFAULTS.count,
    seed: data.seed ?? GENERATE_DEFAULTS.seed,
    inputImageAssetIds:
      data.inputImageAssetIds ?? GENERATE_DEFAULTS.inputImageAssetIds,
    outputAssetIds: data.outputAssetIds ?? GENERATE_DEFAULTS.outputAssetIds,
    generationRuns: normalizeImageGenerationRuns(data.generationRuns),
    generationId: data.generationId,
    createdAt: data.createdAt ?? '',
    updatedAt: data.updatedAt ?? '',
  }
}
