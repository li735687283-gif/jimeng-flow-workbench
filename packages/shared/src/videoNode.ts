// 即梦 Flow 工作台 - Video 节点数据模型与生成请求
// 参考 PRD 11.6（VideoNodeData）、10.3（生成请求示例）、8.4（视频生成任务）

/** 视频生成模式（参考 PRD 13.11 模式切换） */
export type VideoMode =
  | 'text_to_video'
  | 'image_to_video'
  | 'all_reference'
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

/** Video 节点数据模型（参考 PRD 11.6） */
export interface VideoNodeData {
  id: string
  type: 'video'
  title: string
  prompt: string
  /** 上游 Image 节点接入的资源 id 列表 */
  inputImageAssetIds: string[]
  /** 生成结果资源 id 列表 */
  assetIds: string[]
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
  model: string
  aspectRatio: VideoAspectRatio
  resolution: VideoResolution
  quality: VideoQuality
  durationSeconds: number
  count: number
  generateAudio: boolean
}

/** 可选视频模型列表（参考 PRD 13.11） */
export const VIDEO_MODELS = [
  { id: 'seedance-2.0', label: 'Seedance 2.0' },
  { id: 'seedance-2.0-fast', label: 'Seedance 2.0 Fast' },
  { id: 'seedance-2.0-mini', label: 'Seedance 2.0 Mini' },
  { id: 'kling', label: 'Kling' },
] as const

/** 视频模式选项（参考 PRD 13.11） */
export const VIDEO_MODES: { id: VideoMode; label: string }[] = [
  { id: 'text_to_video', label: '文生视频' },
  { id: 'image_to_video', label: '图生视频' },
  { id: 'all_reference', label: '全能参考' },
  { id: 'first_last_frame', label: '首尾帧' },
  { id: 'image_reference', label: '图片参考' },
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

/** 视频时长选项（秒，参考 PRD 8.4：至少 5s，可扩展 10/15） */
export const VIDEO_DURATIONS: number[] = [5, 10, 15]

/** 视频数量选项（参考 PRD 8.4） */
export const VIDEO_COUNTS: (1 | 2 | 4)[] = [1, 2, 4]

/** Video 节点字段默认值（参考 PRD 11.6 与 Settings 默认视频参数） */
const VIDEO_DEFAULTS = {
  prompt: '',
  inputImageAssetIds: [] as string[],
  assetIds: [] as string[],
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
    assetIds: data.assetIds ?? VIDEO_DEFAULTS.assetIds,
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
