// 即梦 Flow 后端 - JimengCli_api client
// 封装即梦图像生成 HTTP 调用。
// 参考 PRD 8.6（设置与密钥）、9.3（数据流）、10.3（生成请求示例）、12.1（配置错误）。
//
// - 独立 service，前端不直接依赖具体接口字段。
// - 使用 Node 18+ 内置 fetch。
// - M0 验证阶段：未配置 jimengBaseUrl 或调用失败时抛出带 code 的 Error。

import type {
  GenerationRequest,
  GenerationResult,
} from '@jimeng-flow/shared/generateNode'
import { getSettings } from '../settings'
import type { Settings, AuthMode } from '@jimeng-flow/shared'

/** jimeng client 错误码（前端可据此区分配置错误与调用错误） */
export type JimengErrorCode =
  | 'JIMENG_NOT_CONFIGURED'
  | 'JIMENG_AUTH_MISSING'
  | 'JIMENG_HTTP_ERROR'
  | 'JIMENG_BAD_RESPONSE'
  | 'JIMENG_TIMEOUT'
  | 'JIMENG_UNKNOWN'

export class JimengError extends Error {
  code: JimengErrorCode
  statusCode: number
  constructor(
    code: JimengErrorCode,
    message: string,
    statusCode = 502,
  ) {
    super(message)
    this.name = 'JimengError'
    this.code = code
    this.statusCode = statusCode
  }
}

/** jimeng 调用参数：基于 GenerationRequest，附超时设置 */
export interface JimengGenerateParams extends GenerationRequest {
  timeoutMs?: number
}

/** 上游 JimengCli_api 返回的单张图结构（合理推断，PRD 未严格定义） */
interface JimengRemoteImage {
  url?: string
  uri?: string
  image_url?: string
  /** 远端返回的 seed（可选） */
  seed?: number
}

/** 上游 JimengCli_api 响应结构（合理推断） */
interface JimengApiResponse {
  code?: number
  message?: string
  msg?: string
  data?:
    | {
        images?: JimengRemoteImage[]
        image_urls?: string[]
        items?: JimengRemoteImage[]
      }
    | JimengRemoteImage[]
    | null
  /** 部分实现直接把图片数组放顶层 */
  images?: JimengRemoteImage[]
  image_urls?: string[]
}

/** 构造请求头（按 authMode 决定鉴权字段） */
function buildHeaders(settings: Settings): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
  const apiKey = settings.apiKey ?? ''
  const authMode: AuthMode = settings.authMode ?? 'apiKey'
  if (!apiKey) return headers
  switch (authMode) {
    case 'cookie':
      headers['Cookie'] = apiKey
      break
    case 'token':
      headers['Authorization'] = `Bearer ${apiKey}`
      break
    case 'apiKey':
    default:
      headers['Authorization'] = `Bearer ${apiKey}`
      // 同时支持 X-API-Key 形式（部分实现用此头）
      headers['X-API-Key'] = apiKey
      break
  }
  return headers
}

/**
 * 构造发往 JimengCli_api 的请求体。
 * PRD 10.3 只规定前端 → 本地后端的 GenerationRequest 结构；
 * 本地后端 → JimengCli_api 的请求体为合理推断：
 *   - 透传 prompt、model、width、height、count、seed
 *   - inputImages 透传参考图路径/Asset id（由 JimengCli_api 决定如何解析）
 *   - mediaType 固定为 image
 */
function buildJimengRequestBody(
  params: JimengGenerateParams,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    prompt: params.prompt,
    model: params.model,
    width: params.width,
    height: params.height,
    count: params.count,
    mediaType: 'image',
  }
  if (typeof params.seed === 'number' && Number.isFinite(params.seed)) {
    body.seed = params.seed
  } else {
    body.seed = null
  }
  if (params.inputImages && params.inputImages.length > 0) {
    body.inputImages = params.inputImages
  }
  return body
}

/**
 * 从 JimengCli_api 响应中抽取图片列表。
 * 兼容多种常见返回结构（data.items / data.images / data.image_urls / 顶层数组）。
 */
function extractImages(res: JimengApiResponse): JimengRemoteImage[] {
  const data = res.data
  if (Array.isArray(data)) return data
  if (data && typeof data === 'object') {
    if (Array.isArray(data.images)) return data.images
    if (Array.isArray(data.items)) return data.items
    if (Array.isArray(data.image_urls)) {
      return data.image_urls.map((url) => ({ url }))
    }
  }
  if (Array.isArray(res.images)) return res.images
  if (Array.isArray(res.image_urls)) {
    return res.image_urls.map((url) => ({ url }))
  }
  return []
}

/**
 * 调用 JimengCli_api 生成图片。
 * 返回每张图的结果（含远端 URL；后续由 generations service 下载并保存为 Asset）。
 *
 * @throws JimengError（带 code）当未配置或调用失败时
 */
export async function generateImage(
  params: JimengGenerateParams,
): Promise<GenerationResult[]> {
  const settings = await getSettings()
  const baseUrl = (settings.jimengBaseUrl ?? '').replace(/\/+$/, '')
  if (!baseUrl) {
    throw new JimengError(
      'JIMENG_NOT_CONFIGURED',
      '未配置 JimengCli_api 服务地址，请先在设置中配置 jimengBaseUrl',
      400,
    )
  }
  if (!settings.apiKey) {
    throw new JimengError(
      'JIMENG_AUTH_MISSING',
      '未配置 JimengCli_api 鉴权信息，请先在设置中配置 apiKey',
      400,
    )
  }

  const url = `${baseUrl}/v1/images/generations`
  const headers = buildHeaders(settings)
  const body = buildJimengRequestBody(params)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), params.timeoutMs ?? 120_000)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      const summary = text.length > 500 ? `${text.slice(0, 500)}...` : text
      throw new JimengError(
        'JIMENG_HTTP_ERROR',
        `JimengCli_api 调用失败：HTTP ${res.status} ${res.statusText}${summary ? ` - ${summary}` : ''}`,
        res.status >= 400 && res.status < 500 ? res.status : 502,
      )
    }

    const json = (await res.json()) as JimengApiResponse
    // 上游返回业务级错误码
    if (
      typeof json.code === 'number' &&
      json.code !== 0 &&
      json.code !== 200
    ) {
      const msg = json.message || json.msg || `code=${json.code}`
      throw new JimengError(
        'JIMENG_BAD_RESPONSE',
        `JimengCli_api 返回业务错误：${msg}`,
        502,
      )
    }

    const images = extractImages(json)
    if (images.length === 0) {
      throw new JimengError(
        'JIMENG_BAD_RESPONSE',
        'JimengCli_api 返回内容为空，未取到图片',
        502,
      )
    }

    const results: GenerationResult[] = images.map((img) => ({
      remoteUrl: img.url || img.uri || img.image_url,
      seed: typeof img.seed === 'number' ? img.seed : undefined,
    }))

    return results
  } catch (err) {
    if (err instanceof JimengError) throw err
    if (err instanceof Error && err.name === 'AbortError') {
      throw new JimengError(
        'JIMENG_TIMEOUT',
        'JimengCli_api 调用超时（默认 120s）',
        504,
      )
    }
    const msg = err instanceof Error ? err.message : String(err)
    throw new JimengError(
      'JIMENG_UNKNOWN',
      `JimengCli_api 调用异常：${msg}`,
      502,
    )
  } finally {
    clearTimeout(timer)
  }
}
