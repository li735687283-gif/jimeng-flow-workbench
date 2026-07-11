import type { FastifyInstance } from 'fastify'

export const LOCAL_SERVER_HOST = '127.0.0.1' as const

export const LOCAL_BROWSER_ORIGINS: ReadonlySet<string> = new Set([
  'http://127.0.0.1:5174',
  'http://localhost:5174',
])

export interface LocalRequestMetadata {
  origin?: string
  secFetchSite?: string
}

export function isAllowedLocalRequest({
  origin,
  secFetchSite,
}: LocalRequestMetadata): boolean {
  if (secFetchSite?.toLowerCase() === 'cross-site') {
    return false
  }

  return origin === undefined || LOCAL_BROWSER_ORIGINS.has(origin)
}

function firstHeaderValue(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export function installLocalAccessGuard(app: FastifyInstance): void {
  app.addHook('onRequest', async (request, reply) => {
    const allowed = isAllowedLocalRequest({
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
