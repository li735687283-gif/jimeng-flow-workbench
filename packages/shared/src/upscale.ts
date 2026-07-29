// 高清放大（upscale）共享契约：Web 请求体与 Server 路由/引擎分发共用。

/** 高清放大引擎：dreamina（即梦云端 image_upscale）或 realesrgan（本地 Real-ESRGAN 4x 保真放大） */
export type UpscaleEngine = 'dreamina' | 'realesrgan'

export const UPSCALE_ENGINES: readonly UpscaleEngine[] = ['dreamina', 'realesrgan']

export const DEFAULT_UPSCALE_ENGINE: UpscaleEngine = 'dreamina'

/** 高清目标倍率：长边分别约 2048 / 4096 / 8192 */
export type UpscaleResolutionType = '2k' | '4k' | '8k'

/** POST /api/assets/:assetId/upscale 请求体 */
export interface UpscaleImageRequest {
  resolutionType?: UpscaleResolutionType
  /** 缺省为 dreamina，保持旧客户端兼容 */
  engine?: UpscaleEngine
}

/** 校验请求里的 engine 字段：合法返回引擎值，非法返回 null（由路由映射 400） */
export function normalizeUpscaleEngine(value: unknown): UpscaleEngine | null {
  return UPSCALE_ENGINES.includes(value as UpscaleEngine)
    ? (value as UpscaleEngine)
    : null
}
