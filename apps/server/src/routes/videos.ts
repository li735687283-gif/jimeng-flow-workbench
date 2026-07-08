// 首页精选作品管理 API（支持图片和视频）。
// 文件上传由 /api/assets/upload 负责，本路由保存作品卡片业务字段。

import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import type { CreateWorkRequest, UpdateWorkRequest, WorkMediaType } from '@jimeng-flow/shared/video'
import {
  createWork,
  listFeaturedWorks,
  listGalleryWorks,
  listWorks,
  updateWork,
} from '../services/videos'

function parseBoolean(value: unknown): boolean | undefined {
  if (value === 'true' || value === true) return true
  if (value === 'false' || value === false) return false
  return undefined
}

function parseNumber(value: unknown): number | undefined {
  if (typeof value !== 'string' || value.trim() === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function parseMediaType(value: unknown): WorkMediaType | undefined {
  if (value === 'video' || value === 'image') return value
  return undefined
}

function errorPayload(err: unknown) {
  const message = err instanceof Error ? err.message : String(err)
  const code = (err as Error & { code?: string }).code
  if (code === 'WORK_NOT_FOUND' || code === 'VIDEO_NOT_FOUND') {
    return { statusCode: 404, error: 'Not Found', message }
  }
  if (code === 'WORK_BAD_ASSET' || code === 'VIDEO_BAD_ASSET') {
    return { statusCode: 400, error: 'Bad Request', message }
  }
  return { statusCode: 500, error: 'Internal Server Error', message }
}

const worksRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get<{
    Querystring: {
      page?: string
      pageSize?: string
      q?: string
      mediaType?: string
      isFeatured?: string
      isPinned?: string
    }
  }>('/api/videos', async (req) => {
    return await listWorks({
      page: parseNumber(req.query.page),
      pageSize: parseNumber(req.query.pageSize),
      q: req.query.q,
      mediaType: parseMediaType(req.query.mediaType),
      isFeatured: parseBoolean(req.query.isFeatured),
      isPinned: parseBoolean(req.query.isPinned),
    })
  })

  app.get('/api/videos/featured', async () => {
    return await listFeaturedWorks()
  })

  app.get('/api/videos/gallery', async () => {
    return await listGalleryWorks()
  })

  app.post<{ Body: CreateWorkRequest }>('/api/videos', async (req, reply) => {
    try {
      const work = await createWork(req.body)
      return reply.code(201).send(work)
    } catch (err) {
      const payload = errorPayload(err)
      return reply.code(payload.statusCode).send(payload)
    }
  })

  app.put<{
    Params: { videoId: string }
    Body: UpdateWorkRequest
  }>('/api/videos/:videoId', async (req, reply) => {
    try {
      return await updateWork(req.params.videoId, req.body)
    } catch (err) {
      const payload = errorPayload(err)
      return reply.code(payload.statusCode).send(payload)
    }
  })
}

export default worksRoutes
