// 即梦 Flow 工作台 - Video 节点数据模型与生成请求
// 参考 PRD 11.6（VideoNodeData）、10.3（生成请求示例）、8.4（视频生成任务）

import type {
  GenerationResponse,
  GenerationResult,
  GenerationStatus,
} from '@jimeng-flow/shared/generateNode'

/** 视频生成模式（参考 PRD 13.11 模式切换） */
export type VideoMode =
  | 'text_to_video'
  | 'image_to_video'
  | 'all_reference'
  | 'action_mimic'
  | 'first_last_frame'
  | 'image_reference'

/** 视频比例（参考 PRD 8.4） */
export type VideoAspectRatio =
  | 'Auto'
  | '16:9'
  | '9:16'
  | '4:3'
  | '3:4'
  | '1:1'
  | '21:9'

/** 视频分辨率/清晰度档位（参考 PRD 8.4） */
export type VideoResolution = '480P' | '720P' | '1080P' | '4K'

/** 视频清晰度 */
export type VideoQuality = 'standard' | 'high'

/** 视频输入引用角色，用于区分普通参考、首帧、尾帧 */
export type VideoReferenceRole = 'reference' | 'first_frame' | 'last_frame'

/** 视频生成引用。先支持图片引用，保留 url 以兼容本地路径或远端资源。 */
export interface VideoMediaReference {
  kind: 'image'
  role: VideoReferenceRole
  assetId?: string
  url?: string
  name?: string
  mimeType?: string
}

/** Video 节点数据模型（参考 PRD 11.6） */
export interface VideoNodeData {
  id: string
  type: 'video'
  title: string
  prompt: string
  /** 上游 Image 节点接入的资源 id 列表 */
  inputImageAssetIds: string[]
  /** 带角色的视频引用，兼容首帧/尾帧/多图参考 */
  references?: VideoMediaReference[]
  /** 生成结果资源 id 列表 */
  assetIds: string[]
  /** 视频节点生成历史，用于重复抽卡和恢复版本 */
  generationRuns?: VideoGenerationRun[]
  mode: VideoMode
  model: string
  aspectRatio: VideoAspectRatio
  resolution: VideoResolution
  quality: VideoQuality
  durationSeconds: number
  count: 1 | 2 | 4
  generateAudio: boolean
  status: 'idle' | 'running' | 'success' | 'error'
  error?: string
  createdAt: string
  updatedAt: string
}

/** 视频生成请求（提交后端，参考 PRD 10.3 视频生成请求示例） */
export interface VideoGenerationRequest {
  flowId: string
  nodeId: string
  mediaType: 'video'
  mode: VideoMode
  prompt: string
  inputImages: string[]
  /** 带角色的视频引用；存在时优先于 inputImages 参与后端生成 */
  references?: VideoMediaReference[]
  model: string
  aspectRatio: VideoAspectRatio
  resolution: VideoResolution
  quality: VideoQuality
  durationSeconds: number
  count: number
  generateAudio: boolean
}

/** 视频生成响应（复用 GenerationResponse，结果项同样使用 GenerationResult） */
export type VideoGenerationResponse = GenerationResponse

/** 视频生成单条结果（复用 GenerationResult：remoteUrl / url / assetId / seed） */
export type VideoGenerationResult = GenerationResult

/** 视频节点的一次生成版本记录 */
export interface VideoGenerationRun {
  /** 本地历史记录 id，默认与 generationId 一致 */
  id: string
  /** 后端生成任务 id */
  generationId: string
  /** 该次任务状态 */
  status: GenerationStatus
  /** 本次生成得到的视频 Asset id 列表 */
  assetIds: string[]
  /** 本次使用的 Prompt */
  prompt: string
  /** 本次使用的模型 id */
  model: string
  /** 本次视频生成模式 */
  mode: VideoMode
  /** 本次比例 */
  aspectRatio: VideoAspectRatio
  /** 本次分辨率 */
  resolution: VideoResolution
  /** 本次清晰度 */
  quality: VideoQuality
  /** 本次视频时长 */
  durationSeconds: number
  /** 本次生成数量 */
  count: number
  /** 本次是否生成音频 */
  generateAudio: boolean
  /** 本次引用的输入图片 Asset id */
  inputImageAssetIds: string[]
  /** 本次使用的带角色引用 */
  references?: VideoMediaReference[]
  /** 失败信息 */
  error?: string
  /** 创建时间 ISO */
  createdAt: string
  /** 完成时间 ISO */
  finishedAt?: string
}

/** 可选视频模型列表（参考 PRD 13.11） */
export const VIDEO_MODELS = [
  { id: 'seedance-2.0', label: 'Seedance 2.0' },
  { id: 'seedance-2.0-fast', label: 'Seedance 2.0 Fast' },
  { id: 'seedance-2.0-vip', label: 'Seedance 2.0 VIP' },
  { id: 'seedance-2.0-fast-vip', label: 'Seedance 2.0 Fast VIP' },
  { id: 'seedance-2.0-mini', label: 'Seedance 2.0 Mini' },
] as const

export function isJimengVideoModel(modelId: string): boolean {
  const normalized = modelId.trim().toLowerCase()
  return (
    normalized === 'jimeng' ||
    normalized === 'seedance2' ||
    normalized === 'seedance20' ||
    normalized.startsWith('seedance-') ||
    normalized.startsWith('seedance2')
  )
}

/** 视频模式选项（参考 PRD 13.11） */
export const VIDEO_MODES: { id: VideoMode; label: string }[] = [
  { id: 'text_to_video', label: '文生视频' },
  { id: 'image_to_video', label: '图生视频' },
  { id: 'all_reference', label: '全能参考' },
  { id: 'action_mimic', label: '动作模仿' },
  { id: 'first_last_frame', label: '首尾帧' },
  { id: 'image_reference', label: '多图参考' },
]

/** 视频比例选项 */
export const VIDEO_ASPECT_RATIOS: VideoAspectRatio[] = [
  'Auto',
  '16:9',
  '9:16',
  '4:3',
  '3:4',
  '1:1',
  '21:9',
]

/** 视频分辨率选项 */
export const VIDEO_RESOLUTIONS: VideoResolution[] = [
  '480P',
  '720P',
  '1080P',
  '4K',
]

/** 视频时长选项（秒） */
export const VIDEO_DURATIONS: number[] = [
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  11,
  12,
  13,
  14,
  15,
]

/** 视频数量选项（参考 PRD 8.4） */
export const VIDEO_COUNTS: (1 | 2 | 4)[] = [1, 2, 4]

/** Video 节点字段默认值（参考 PRD 11.6 与 Settings 默认视频参数） */
const VIDEO_DEFAULTS = {
  prompt: '',
  inputImageAssetIds: [] as string[],
  references: [] as VideoMediaReference[],
  assetIds: [] as string[],
  generationRuns: [] as VideoGenerationRun[],
  mode: 'text_to_video' as VideoMode,
  model: 'seedance-2.0',
  aspectRatio: '16:9' as VideoAspectRatio,
  resolution: '720P' as VideoResolution,
  quality: 'standard' as VideoQuality,
  durationSeconds: 5,
  count: 1 as 1 | 2 | 4,
  generateAudio: true,
  status: 'idle' as 'idle' | 'running' | 'success' | 'error',
}

const MAX_VIDEO_GENERATION_RUNS = 20
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

function isVideoMediaReference(value: unknown): value is VideoMediaReference {
  if (!value || typeof value !== 'object') return false
  const ref = value as Partial<VideoMediaReference>
  return (
    ref.kind === 'image' &&
    (ref.role === 'reference' ||
      ref.role === 'first_frame' ||
      ref.role === 'last_frame') &&
    (typeof ref.assetId === 'string' || typeof ref.url === 'string')
  )
}

export function normalizeVideoReferences(value: unknown): VideoMediaReference[] {
  if (!Array.isArray(value)) return []
  return value.filter(isVideoMediaReference)
}

function imageReferenceFromInput(
  input: string,
  role: VideoReferenceRole,
): VideoMediaReference {
  return input.startsWith('asset_')
    ? { kind: 'image', role, assetId: input }
    : { kind: 'image', role, url: input }
}

export function buildVideoReferencesFromInputImages(
  mode: VideoMode,
  inputImages: string[] | undefined,
): VideoMediaReference[] {
  const inputs = (inputImages ?? []).filter(Boolean)
  if (mode === 'first_last_frame') {
    return inputs.slice(0, 2).map((input, index) =>
      imageReferenceFromInput(input, index === 0 ? 'first_frame' : 'last_frame'),
    )
  }
  const role: VideoReferenceRole =
    mode === 'image_to_video' ? 'first_frame' : 'reference'
  return inputs.map((input) => imageReferenceFromInput(input, role))
}

export function getVideoReferenceInputs(
  references: VideoMediaReference[] | undefined,
): string[] {
  return normalizeVideoReferences(references)
    .map((ref) => ref.assetId ?? ref.url)
    .filter((input): input is string => !!input)
}

function isVideoGenerationRun(value: unknown): value is VideoGenerationRun {
  if (!value || typeof value !== 'object') return false
  const run = value as Partial<VideoGenerationRun>
  return (
    typeof run.id === 'string' &&
    typeof run.generationId === 'string' &&
    typeof run.status === 'string' &&
    GENERATION_STATUSES.has(run.status as GenerationStatus) &&
    isStringArray(run.assetIds) &&
    typeof run.prompt === 'string' &&
    typeof run.model === 'string' &&
    typeof run.mode === 'string' &&
    typeof run.aspectRatio === 'string' &&
    typeof run.resolution === 'string' &&
    typeof run.quality === 'string' &&
    typeof run.durationSeconds === 'number' &&
    typeof run.count === 'number' &&
    typeof run.generateAudio === 'boolean' &&
    isStringArray(run.inputImageAssetIds) &&
    typeof run.createdAt === 'string'
  )
}

export function normalizeVideoGenerationRuns(
  value: unknown,
): VideoGenerationRun[] {
  if (!Array.isArray(value)) return []
  return value.filter(isVideoGenerationRun).slice(-MAX_VIDEO_GENERATION_RUNS)
}

export function appendVideoGenerationRun(
  value: unknown,
  run: VideoGenerationRun,
): VideoGenerationRun[] {
  const runs = normalizeVideoGenerationRuns(value).filter(
    (item) => item.generationId !== run.generationId,
  )
  runs.push(run)
  return runs.slice(-MAX_VIDEO_GENERATION_RUNS)
}

/**
 * 将任意 partial 节点数据合并为完整的 VideoNodeData。
 * registry 创建的节点初始只有 { title, status }，这里补齐视频相关字段的默认值。
 */
export function mergeVideoDefaults(
  data: Partial<VideoNodeData>,
): VideoNodeData {
  return {
    id: data.id ?? '',
    type: 'video',
    title: data.title ?? '',
    prompt: data.prompt ?? VIDEO_DEFAULTS.prompt,
    inputImageAssetIds:
      data.inputImageAssetIds ?? VIDEO_DEFAULTS.inputImageAssetIds,
    references: normalizeVideoReferences(data.references),
    assetIds: data.assetIds ?? VIDEO_DEFAULTS.assetIds,
    generationRuns: normalizeVideoGenerationRuns(data.generationRuns),
    mode: data.mode ?? VIDEO_DEFAULTS.mode,
    model: data.model ?? VIDEO_DEFAULTS.model,
    aspectRatio: data.aspectRatio ?? VIDEO_DEFAULTS.aspectRatio,
    resolution: data.resolution ?? VIDEO_DEFAULTS.resolution,
    quality: data.quality ?? VIDEO_DEFAULTS.quality,
    durationSeconds:
      data.durationSeconds ?? VIDEO_DEFAULTS.durationSeconds,
    count: data.count ?? VIDEO_DEFAULTS.count,
    generateAudio: data.generateAudio ?? VIDEO_DEFAULTS.generateAudio,
    status: data.status ?? VIDEO_DEFAULTS.status,
    error: data.error,
    createdAt: data.createdAt ?? '',
    updatedAt: data.updatedAt ?? '',
  }
}
