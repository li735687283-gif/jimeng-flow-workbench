// 即梦 Flow 后端 - Generations 路由
// POST   /api/generations          创建生成任务（图像/视频）
// GET    /api/generations/:id      查询生成任务状态
// POST   /api/generations/:id/retry  重试生成任务
// 参考 PRD 8.3（生成任务）、8.4（视频生成任务）、10.3（生成接口）、12.1/12.2（错误处理）。
//
// default export Fastify plugin；不在本文件注册到 app，由 index.ts 统一集成。

import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import type {
  GenerationRequest,
  GenerationResponse,
} from '@jimeng-flow/shared/generateNode'
import type { VideoGenerationRequest } from '@jimeng-flow/shared/videoNode'
import {
  createGeneration,
  getGeneration,
  retryGeneration,
} from '../services/generations'
import { JimengError, removeBackground, generateImage } from '../services/jimeng'

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
  // body: GenerationRequest | VideoGenerationRequest → GenerationResponse
  app.post<{ Body: GenerationRequest | VideoGenerationRequest }>(
    '/api/generations',
    { bodyLimit: 4 * 1024 * 1024 },
    async (req, reply) => {
      const body = req.body
      if (!body || typeof body !== 'object') {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: '请求体不能为空',
        })
      }
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

  // POST /api/generations/edit
  // body: { inputImage: string, editType: 'style_transfer'|'modify'|'remove_bg', prompt?: string, ... }
  app.post('/api/generations/edit', async (req, reply) => {
    const body = req.body as { inputImage: string; editType: string; prompt?: string; model?: string; width?: number; height?: number }
    if (!body.inputImage) {
      return reply.code(400).send({ statusCode: 400, error: 'Bad Request', message: 'inputImage 不能为空' })
    }
    try {
      if (body.editType === 'remove_bg') {
        const res = await removeBackground({ inputImage: body.inputImage })
        // 将结果保存为资产，返回 assetId
        const editResult = res[0]
        if (editResult?.localPath) {
          const { readFile } = await import('node:fs/promises')
          const { saveUploadFile } = await import('../services/assets')
          const buffer = await readFile(editResult.localPath)
          const asset = await saveUploadFile({
            fileBuffer: buffer,
            originalName: 'remove_bg_output.png',
            mimeType: 'image/png',
            prompt: body.prompt || 'remove background',
          })
          editResult.assetId = asset.id
        }
        return reply.code(201).send({ id: `edit_${Date.now()}`, status: 'success', results: res })
      }
      // style_transfer / modify 使用 image2image
      const genReq: GenerationRequest = {
        flowId: 'local',
        nodeId: `edit_${Date.now()}`,
        mediaType: 'image',
        prompt: body.prompt || 'modify image',
        inputImages: [body.inputImage],
        model: body.model || 'jimeng-3.0',
        width: body.width || 1024,
        height: body.height || 1024,
        count: 1,
        seed: null,
      }
      const res = await generateImage(genReq)
      return reply.code(201).send({ id: `edit_${Date.now()}`, status: 'success', results: res })
    } catch (err) {
      app.log.error({ err }, '[generations/edit] 调用失败')
      const payload = errorPayload(err)
      return reply.code(payload.statusCode).send(payload)
    }
  })
}

export default generationsRoutes
