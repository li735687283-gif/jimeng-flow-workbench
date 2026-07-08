// 首页精选视频管理 API。
// 文件上传由 /api/assets/upload 负责，本路由保存视频卡片业务字段。

import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import type { CreateVideoRequest, UpdateVideoRequest } from '@jimeng-flow/shared/video'
import {
  createVideo,
  listFeaturedVideos,
  listVideos,
  updateVideo,
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

function errorPayload(err: unknown) {
  const message = err instanceof Error ? err.message : String(err)
  const code = (err as Error & { code?: string }).code
  if (code === 'VIDEO_NOT_FOUND') {
    return { statusCode: 404, error: 'Not Found', message }
  }
  if (code === 'VIDEO_BAD_ASSET') {
    return { statusCode: 400, error: 'Bad Request', message }
  }
  return { statusCode: 500, error: 'Internal Server Error', message }
}

const videosRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get<{
    Querystring: {
      page?: string
      pageSize?: string
      q?: string
      isFeatured?: string
      isPinned?: string
    }
  }>('/api/videos', async (req) => {
    return await listVideos({
      page: parseNumber(req.query.page),
      pageSize: parseNumber(req.query.pageSize),
      q: req.query.q,
      isFeatured: parseBoolean(req.query.isFeatured),
      isPinned: parseBoolean(req.query.isPinned),
    })
  })

  app.get('/api/videos/featured', async () => {
    return await listFeaturedVideos()
  })

  app.post<{ Body: CreateVideoRequest }>('/api/videos', async (req, reply) => {
    try {
      const video = await createVideo(req.body)
      return reply.code(201).send(video)
    } catch (err) {
      const payload = errorPayload(err)
      return reply.code(payload.statusCode).send(payload)
    }
  })

  app.put<{
    Params: { videoId: string }
    Body: UpdateVideoRequest
  }>('/api/videos/:videoId', async (req, reply) => {
    try {
      return await updateVideo(req.params.videoId, req.body)
    } catch (err) {
      const payload = errorPayload(err)
      return reply.code(payload.statusCode).send(payload)
    }
  })
}

export default videosRoutes
