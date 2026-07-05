// 即梦 Flow 后端 - Assets 路由
// 参考 PRD 10.4、8.5、11.2。
//
// POST   /api/assets/upload         base64 JSON 上传：{ fileName, mimeType, dataBase64, ... }
// GET    /api/assets                列出全部资产 metadata（按 createdAt 倒序）
// GET    /api/assets/:assetId       读取单个资产 metadata
// GET    /api/assets/:assetId/file  返回资产文件流
//
// 上传采用 base64 JSON 方案，避免引入 @fastify/multipart 依赖。
// default export Fastify plugin；不在本文件注册到 app，由 index.ts 统一集成。

import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { extname } from 'node:path'
import { saveUploadFile, getAsset, listAssets, getAssetFilePath } from '../services/assets'

interface UploadBody {
  fileName: string
  mimeType: string
  dataBase64: string
  prompt?: string
  sourceNodeId?: string
  inputAssetIds?: string[]
  provider?: string
  params?: Record<string, unknown>
}

/** 扩展名 → MIME 兜底映射 */
const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.avi': 'video/x-msvideo',
  '.mkv': 'video/x-matroska',
  '.m4v': 'video/x-m4v',
}

function mimeForFile(absPath: string, fallback: string): string {
  return MIME_BY_EXT[extname(absPath).toLowerCase()] ?? fallback
}

const assetsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // POST /api/assets/upload
  // body: UploadBody。单路由放宽 body 上限以容纳 base64（50MB）。
  app.post<{ Body: UploadBody }>(
    '/api/assets/upload',
    { bodyLimit: 50 * 1024 * 1024 },
    async (req, reply) => {
      const body = req.body
      if (!body || typeof body !== 'object') {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: '请求体必须为对象',
        })
      }
      const { fileName, mimeType, dataBase64 } = body
      if (typeof fileName !== 'string' || !fileName) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'fileName 缺失',
        })
      }
      if (typeof dataBase64 !== 'string' || !dataBase64) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'dataBase64 缺失',
        })
      }

      let fileBuffer: Buffer
      try {
        // Node.js Buffer.from 对无效 base64 静默跳过，需主动校验
        const cleaned = dataBase64.replace(/\s/g, '')
        fileBuffer = Buffer.from(cleaned, 'base64')
        // 验证 base64 解码后再编码是否一致
        const normalizedInput = cleaned.replace(/=+$/, '')
        const normalizedOutput = fileBuffer.toString('base64').replace(/=+$/, '')
        if (fileBuffer.length > 0 && normalizedOutput !== normalizedInput) {
          throw new Error('非法 base64 字符')
        }
      } catch {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'dataBase64 不是合法 base64',
        })
      }
      if (fileBuffer.length === 0) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: '文件内容为空',
        })
      }

      const effectiveMime =
        typeof mimeType === 'string' && mimeType
          ? mimeType
          : MIME_BY_EXT[extname(fileName).toLowerCase()] ?? 'application/octet-stream'

      const asset = await saveUploadFile({
        fileBuffer,
        originalName: fileName,
        mimeType: effectiveMime,
        prompt: body.prompt,
        sourceNodeId: body.sourceNodeId,
        inputAssetIds: body.inputAssetIds,
        provider: body.provider,
        params: body.params,
      })
      return reply.code(201).send(asset)
    },
  )

  // GET /api/assets
  app.get('/api/assets', async () => {
    return await listAssets()
  })

  // GET /api/assets/:assetId
  app.get<{ Params: { assetId: string } }>(
    '/api/assets/:assetId',
    async (req, reply) => {
      const asset = await getAsset(req.params.assetId)
      if (!asset) {
        return reply.code(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: '资产不存在',
        })
      }
      return asset
    },
  )

  // GET /api/assets/:assetId/file
  app.get<{ Params: { assetId: string } }>(
    '/api/assets/:assetId/file',
    async (req, reply) => {
      const asset = await getAsset(req.params.assetId)
      if (!asset) {
        return reply.code(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: '资产不存在',
        })
      }
      const absPath = getAssetFilePath(asset)
      try {
        await stat(absPath)
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code
        if (code === 'ENOENT') {
          return reply.code(404).send({
            statusCode: 404,
            error: 'Not Found',
            message: '资产文件不存在',
          })
        }
        throw err
      }
      const fallbackMime = asset.type === 'video' ? 'video/mp4' : 'image/png'
      const mime = mimeForFile(absPath, fallbackMime)
      const stream = createReadStream(absPath)
      reply.header('Content-Type', mime)
      reply.header('Cache-Control', 'no-cache')
      return reply.send(stream)
    },
  )
}

export default assetsRoutes
