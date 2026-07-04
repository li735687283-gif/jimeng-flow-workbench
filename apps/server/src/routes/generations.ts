// 即梦 Flow 后端 - Generations 路由
// POST   /api/generations          创建生成任务（图像）
// GET    /api/generations/:id      查询生成任务状态
// POST   /api/generations/:id/retry  重试生成任务
// 参考 PRD 8.3（生成任务）、10.3（生成接口）、12.1/12.2（错误处理）。
//
// default export Fastify plugin；不在本文件注册到 app，由 index.ts 统一集成。

import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import type {
  GenerationRequest,
  GenerationResponse,
} from '@jimeng-flow/shared/generateNode'
import {
  createGeneration,
  getGeneration,
  retryGeneration,
} from '../services/generations'
import { JimengError } from '../services/jimeng'

/** 构造统一错误响应 */
function errorPayload(err: unknown) {
  if (err instanceof JimengError) {
    return {
      statusCode: err.statusCode,
      error: err.statusCode >= 500 ? 'Bad Gateway' : 'Bad Request',
      message: err.message,
      code: err.code,
    }
  }
  const msg = err instanceof Error ? err.message : String(err)
  return {
    statusCode: 500,
    error: 'Internal Server Error',
    message: msg,
  }
}

const generationsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // POST /api/generations
  // body: GenerationRequest → GenerationResponse
  app.post<{ Body: GenerationRequest }>(
    '/api/generations',
    { bodyLimit: 4 * 1024 * 1024 },
    async (req, reply) => {
      const body = req.body ?? ({} as GenerationRequest)
      try {
        const res = await createGeneration(body)
        return reply.code(201).send(res as GenerationResponse)
      } catch (err) {
        app.log.error({ err }, '[generations/create] 调用失败')
        const payload = errorPayload(err)
        return reply.code(payload.statusCode).send(payload)
      }
    },
  )

  // GET /api/generations/:id
  app.get<{ Params: { id: string } }>(
    '/api/generations/:id',
    async (req, reply) => {
      const res = await getGeneration(req.params.id)
      if (!res) {
        return reply.code(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: '生成任务不存在',
        })
      }
      return res as GenerationResponse
    },
  )

  // POST /api/generations/:id/retry
  app.post<{ Params: { id: string } }>(
    '/api/generations/:id/retry',
    async (req, reply) => {
      try {
        const res = await retryGeneration(req.params.id)
        return reply.code(201).send(res as GenerationResponse)
      } catch (err) {
        app.log.error({ err }, '[generations/retry] 调用失败')
        const payload = errorPayload(err)
        return reply.code(payload.statusCode).send(payload)
      }
    },
  )
}

export default generationsRoutes
