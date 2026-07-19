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
import { copyFile, mkdir, readFile, stat } from 'node:fs/promises'
import { basename, extname, resolve } from 'node:path'
import type { GenerationResult } from '@jimeng-flow/shared/generateNode'
import { getWorkspaceDir } from '../config'
import {
  saveUploadFile,
  getAsset,
  listAssets,
  listLibraryAssets,
  saveAssetToLibrary,
  getAssetFilePath,
} from '../services/assets'
import {
  createAssetContentHash,
  findDuplicateImportedImage,
} from '../services/assetDedup'
import { JimengError, upscaleImage } from '../services/jimeng'

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

function isImageUpload(fileName: string, mimeType: string): boolean {
  return (
    mimeType.toLowerCase().startsWith('image/') ||
    MIME_BY_EXT[extname(fileName).toLowerCase()]?.startsWith('image/') === true
  )
}

async function findDuplicateUpload(fileBuffer: Buffer, fileName: string, mimeType: string) {
  if (!isImageUpload(fileName, mimeType)) return null
  const contentHash = createAssetContentHash(fileBuffer)
  const duplicate = findDuplicateImportedImage(await listAssets(), contentHash)
  return { duplicate, contentHash }
}

function errorPayload(err: unknown) {
  if (err instanceof JimengError) {
    return {
      statusCode: err.statusCode,
      error: err.statusCode >= 500 ? 'Bad Gateway' : 'Bad Request',
      message: err.message,
      code: err.code,
    }
  }
  const message = err instanceof Error ? err.message : String(err)
  return { statusCode: 500, error: 'Internal Server Error', message }
}

async function readRemoteImage(
  url: string,
): Promise<{ buffer: Buffer; mimeType: string; ext: string }> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`下载高清结果失败：HTTP ${res.status} ${res.statusText}`)
  }
  const mimeType = res.headers.get('content-type')?.split(';')[0]?.trim() || 'image/png'
  const ext =
    mimeType === 'image/jpeg'
      ? '.jpg'
      : mimeType === 'image/webp'
        ? '.webp'
        : mimeType === 'image/gif'
          ? '.gif'
          : '.png'
  return {
    buffer: Buffer.from(await res.arrayBuffer()),
    mimeType,
    ext,
  }
}

async function saveUpscaleResult(
  result: GenerationResult,
  sourceAssetId: string,
  resolutionType: string,
  flowId?: string,
) {
  if (result.localPath) {
    const ext = extname(result.localPath) || '.png'
    const buffer = await readFile(result.localPath)
    return saveUploadFile({
      fileBuffer: buffer,
      originalName: `upscale-${sourceAssetId}${ext}`,
      mimeType: mimeForFile(result.localPath, 'image/png'),
      inputAssetIds: [sourceAssetId],
      provider: 'dreamina',
      params: {
        flowId: flowId ?? null,
        operation: 'image_upscale',
        resolutionType,
        localPath: result.localPath,
      },
    })
  }

  const remoteUrl = result.remoteUrl || result.url
  if (!remoteUrl) {
    throw new Error('高清结果缺少文件地址')
  }
  const { buffer, mimeType, ext } = await readRemoteImage(remoteUrl)
  return saveUploadFile({
    fileBuffer: buffer,
    originalName: `upscale-${sourceAssetId}${ext}`,
    mimeType,
    inputAssetIds: [sourceAssetId],
    provider: 'dreamina',
    params: {
      flowId: flowId ?? null,
      operation: 'image_upscale',
      resolutionType,
      remoteUrl,
    },
  })
}

const assetsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // POST /api/assets/upload/file — multipart 流式上传（适合大文件如视频）
  app.post('/api/assets/upload/file', async (req, reply) => {
    const data = await req.file()
    if (!data) {
      return reply.code(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: '缺少上传文件',
      })
    }

    const chunks: Buffer[] = []
    for await (const chunk of data.file) {
      chunks.push(chunk)
    }
    const fileBuffer = Buffer.concat(chunks)

    if (fileBuffer.length === 0) {
      return reply.code(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: '文件内容为空',
      })
    }

    const fileName = data.filename || 'upload.bin'
    const effectiveMime =
      data.mimetype ||
      (MIME_BY_EXT[extname(fileName).toLowerCase()] ?? 'application/octet-stream')

    const duplicateUpload = await findDuplicateUpload(fileBuffer, fileName, effectiveMime)
    if (duplicateUpload?.duplicate) {
      return reply.code(200).send(duplicateUpload.duplicate)
    }

    const asset = await saveUploadFile({
      fileBuffer,
      originalName: fileName,
      mimeType: effectiveMime,
      params: duplicateUpload
        ? { origin: 'upload', contentHash: duplicateUpload.contentHash }
        : undefined,
    })
    return reply.code(201).send(asset)
  })

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

      const duplicateUpload = body.provider
        ? null
        : await findDuplicateUpload(fileBuffer, fileName, effectiveMime)
      if (duplicateUpload?.duplicate) {
        return reply.code(200).send(duplicateUpload.duplicate)
      }

      const asset = await saveUploadFile({
        fileBuffer,
        originalName: fileName,
        mimeType: effectiveMime,
        prompt: body.prompt,
        sourceNodeId: body.sourceNodeId,
        inputAssetIds: body.inputAssetIds,
        provider: body.provider,
        params: duplicateUpload
          ? {
              ...body.params,
              origin: 'upload',
              contentHash: duplicateUpload.contentHash,
            }
          : body.params,
      })
      return reply.code(201).send(asset)
    },
  )

  // GET /api/assets/library — 只列出通过右键保存到资产库的资产
  app.get('/api/assets/library', async () => {
    return await listLibraryAssets()
  })

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

  // POST /api/assets/:assetId/library — 将现有输出资产登记到资产库
  app.post<{ Params: { assetId: string } }>(
    '/api/assets/:assetId/library',
    async (req, reply) => {
      const asset = await saveAssetToLibrary(req.params.assetId)
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

  // GET /api/assets/:assetId/download
  app.get<{ Params: { assetId: string } }>(
    '/api/assets/:assetId/download',
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
      reply.header('Content-Type', mime)
      reply.header(
        'Content-Disposition',
        `attachment; filename="${asset.id}${extname(absPath) || '.png'}"`,
      )
      return reply.send(createReadStream(absPath))
    },
  )

  // POST /api/assets/:assetId/export
  app.post<{ Params: { assetId: string } }>(
    '/api/assets/:assetId/export',
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
      const exportDir = resolve(getWorkspaceDir(), 'outputs/downloads')
      await mkdir(exportDir, { recursive: true })
      const targetPath = resolve(exportDir, basename(absPath))
      await copyFile(absPath, targetPath)
      return { path: targetPath }
    },
  )

  // POST /api/assets/:assetId/upscale
  app.post<{
    Params: { assetId: string }
    Body: { resolutionType?: '2k' | '4k' | '8k' }
  }>('/api/assets/:assetId/upscale', async (req, reply) => {
    const sourceAsset = await getAsset(req.params.assetId)
    if (!sourceAsset) {
      return reply.code(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: '资产不存在',
      })
    }
    if (sourceAsset.type !== 'image') {
      return reply.code(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: '只有图片资产可以高清',
      })
    }

    const resolutionType = req.body?.resolutionType ?? '2k'
    try {
      const results = await upscaleImage({
        inputImage: req.params.assetId,
        resolutionType,
      })
      const first = results[0]
      if (!first) {
        return reply.code(502).send({
          statusCode: 502,
          error: 'Bad Gateway',
          message: 'dreamina 未返回高清结果',
        })
      }
      const sourceFlowId =
        typeof sourceAsset.params?.flowId === 'string' ? sourceAsset.params.flowId : undefined
      const asset = await saveUpscaleResult(
        first,
        req.params.assetId,
        resolutionType,
        sourceFlowId,
      )
      return reply.code(201).send(asset)
    } catch (err) {
      app.log.error({ err }, '[assets/upscale] 调用失败')
      const payload = errorPayload(err)
      return reply.code(payload.statusCode).send(payload)
    }
  })

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
      let fileStats
      try {
        fileStats = await stat(absPath)
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
      const fileSize = fileStats.size

      const rangeHeader = req.headers.range
      if (rangeHeader && asset.type === 'video') {
        const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader)
        if (match) {
          let start = match[1] ? Number.parseInt(match[1], 10) : 0
          let end = match[2] ? Number.parseInt(match[2], 10) : fileSize - 1
          if (Number.isNaN(start)) start = 0
          if (Number.isNaN(end)) end = fileSize - 1
          if (start >= fileSize) {
            reply.header('Content-Range', `bytes */${fileSize}`)
            return reply.code(416).send({
              statusCode: 416,
              error: 'Range Not Satisfiable',
              message: '请求范围超出文件大小',
            })
          }
          end = Math.min(end, fileSize - 1)
          const contentLength = end - start + 1
          const stream = createReadStream(absPath, { start, end })
          reply.code(206)
          reply.header('Content-Type', mime)
          reply.header('Content-Length', String(contentLength))
          reply.header('Content-Range', `bytes ${start}-${end}/${fileSize}`)
          reply.header('Accept-Ranges', 'bytes')
          reply.header('Cache-Control', 'no-cache')
          return reply.send(stream)
        }
      }

      const stream = createReadStream(absPath)
      reply.header('Content-Type', mime)
      reply.header('Content-Length', String(fileSize))
      reply.header('Accept-Ranges', 'bytes')
      reply.header('Cache-Control', 'no-cache')
      return reply.send(stream)
    },
  )
}

export default assetsRoutes
