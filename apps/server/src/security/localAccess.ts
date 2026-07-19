import type { FastifyInstance } from 'fastify'

export const LOCAL_SERVER_HOST = '127.0.0.1' as const

export const LOCAL_BROWSER_ORIGINS: ReadonlySet<string> = new Set([
  'http://127.0.0.1:5174',
  'http://localhost:5174',
])

const LOOPBACK_HOSTNAMES: ReadonlySet<string> = new Set([
  '127.0.0.1',
  'localhost',
  '[::1]',
])

export interface LocalRequestMetadata {
  host?: string
  origin?: string
  secFetchSite?: string
}

export function isAllowedLocalRequest({
  host,
  origin,
  secFetchSite,
}: LocalRequestMetadata): boolean {
  if (secFetchSite?.toLowerCase() === 'cross-site') {
    return false
  }

  if (origin === undefined || LOCAL_BROWSER_ORIGINS.has(origin)) {
    return true
  }

  // 打包后前端由本服务自身托管，模块脚本带 crossorigin 会携带同源
  // Origin（如 http://127.0.0.1:8787）。仅当 Origin 与 Host 一致且主机
  // 名确为回环地址时放行，避免 DNS rebinding 伪造 Host 绕过校验。
  if (host) {
    try {
      const originUrl = new URL(origin)
      return (
        originUrl.host === host && LOOPBACK_HOSTNAMES.has(originUrl.hostname)
      )
    } catch {
      return false
    }
  }

  return false
}

function firstHeaderValue(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export function installLocalAccessGuard(app: FastifyInstance): void {
  app.addHook('onRequest', async (request, reply) => {
    const allowed = isAllowedLocalRequest({
      host: firstHeaderValue(request.headers.host),
      origin: request.headers.origin,
      secFetchSite: firstHeaderValue(request.headers['sec-fetch-site']),
    })

    if (allowed) {
      return
    }

    return reply.code(403).send({
      statusCode: 403,
      error: 'Forbidden',
      message: '仅允许本机浏览器访问',
    })
  })
}
