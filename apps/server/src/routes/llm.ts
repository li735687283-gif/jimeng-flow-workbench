// 即梦 Flow 后端 - LLM 路由
// POST /api/llm/chat          通用 LLM 对话
// POST /api/text-nodes/:id/run 关联文本节点的 LLM 调用（响应带 nodeId）
// GET  /api/llm/models        列出可用 LLM 模型
// 参考 PRD 7.6、8.9、10.6、12.2。
// 注意：本文件不注册到 index.ts，由主代理负责集成。

import { readFile } from 'node:fs/promises'
import { extname } from 'node:path'
import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import type {
  LlmChatRequest,
  LlmChatResponse,
  LlmTranscribeRequest,
  TextNodeRunRequest,
} from '@jimeng-flow/shared/textNode'
import { DEFAULT_IMAGE_REVERSE_PROMPT } from '@jimeng-flow/shared/textNode'
import {
  generateText,
  listModels,
  transcribeAudio,
} from '../services/llm'
import { getAsset, getAssetFilePath } from '../services/assets'

function imageMimeFromPath(path: string): string {
  const ext = extname(path).toLowerCase()
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.webp') return 'image/webp'
  if (ext === '.gif') return 'image/gif'
  if (ext === '.bmp') return 'image/bmp'
  return 'image/png'
}

/** 将 assetId 列表解析为 data URL，供视觉模型识图 */
async function resolveAssetImageDataUrls(
  inputImages: unknown,
): Promise<string[]> {
  if (!Array.isArray(inputImages)) return []
  const urls: string[] = []
  for (const item of inputImages) {
    if (typeof item !== 'string') continue
    const assetId = item.trim()
    if (!assetId) continue
    const asset = await getAsset(assetId)
    if (!asset) {
      throw new Error(`找不到图片资产：${assetId}`)
    }
    if (asset.type !== 'image') {
      throw new Error(`资产不是图片，无法识图：${assetId}`)
    }
    const filePath = getAssetFilePath(asset)
    const buffer = await readFile(filePath)
    urls.push(
      `data:${imageMimeFromPath(filePath)};base64,${buffer.toString('base64')}`,
    )
  }
  return urls
}

const llmRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // POST /api/llm/chat
  // body: LlmChatRequest → 返回 LlmChatResponse（不带 nodeId）
  app.post<{ Body: LlmChatRequest }>('/api/llm/chat', async (req, reply) => {
    const body = req.body ?? ({} as LlmChatRequest)
    const model = typeof body.model === 'string' ? body.model.trim() : ''
    const message = typeof body.message === 'string' ? body.message : ''
    const outputFormat = body.outputFormat ?? 'auto'

    if (!model) {
      return reply.code(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'model 不能为空',
      })
    }
    if (!message) {
      return reply.code(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'message 不能为空',
      })
    }

    try {
      const result = await generateText(model, message, { outputFormat })
      const response: LlmChatResponse = {
        model,
        content: result.content,
        contentType: result.contentType,
        promptCandidate: result.promptCandidate,
        usage: result.usage,
      }
      return response
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      app.log.error({ err }, '[llm/chat] 调用失败')
      return reply.code(502).send({
        statusCode: 502,
        error: 'Bad Gateway',
        message: errorMsg,
      })
    }
  })

  // POST /api/text-nodes/:id/run
  // body: TextNodeRunRequest → 返回 LlmChatResponse（带 nodeId）
  // 参考 PRD 10.6 请求/响应示例。
  // 识图会把图片转 data URL 再转发 LLM，放大 body 限制避免大图失败
  app.post<{
    Params: { id: string }
    Body: TextNodeRunRequest
  }>('/api/text-nodes/:id/run', { bodyLimit: 32 * 1024 * 1024 }, async (req, reply) => {
    const nodeId = req.params.id
    const body = req.body ?? ({} as TextNodeRunRequest)
    const model = typeof body.model === 'string' ? body.model.trim() : ''
    let message = typeof body.message === 'string' ? body.message.trim() : ''
    const outputFormat = body.outputFormat ?? 'auto'

    if (!model) {
      return reply.code(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'model 不能为空',
      })
    }

    let imageDataUrls: string[] = []
    try {
      imageDataUrls = await resolveAssetImageDataUrls(body.inputImages)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      return reply.code(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: errorMsg,
      })
    }

    // 有上游图时允许空 message，自动走图片反推默认指令
    if (!message) {
      if (imageDataUrls.length === 0) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'message 不能为空',
        })
      }
      message = DEFAULT_IMAGE_REVERSE_PROMPT
    }

    try {
      const result = await generateText(model, message, { outputFormat }, imageDataUrls)
      const response: LlmChatResponse = {
        nodeId,
        model,
        content: result.content,
        contentType: result.contentType,
        promptCandidate: result.promptCandidate,
        usage: result.usage,
      }
      return response
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      app.log.error({ err, nodeId }, '[text-nodes/run] 调用失败')
      return reply.code(502).send({
        statusCode: 502,
        error: 'Bad Gateway',
        message: errorMsg,
      })
    }
  })

  // GET /api/llm/models
  // 返回 LlmModelInfo[]，失败时由 service 返回默认列表。
  app.get('/api/llm/models', async () => {
    try {
      const models = await listModels()
      return models
    } catch (err) {
      app.log.error({ err }, '[llm/models] 获取模型列表异常')
      return []
    }
  })

  // POST /api/llm/transcriptions
  // body: base64 audio JSON → 返回识别文字。
  app.post<{ Body: LlmTranscribeRequest }>(
    '/api/llm/transcriptions',
    { bodyLimit: 12 * 1024 * 1024 },
    async (req, reply) => {
      const body = req.body ?? ({} as LlmTranscribeRequest)
      const audioBase64 =
        typeof body.audioBase64 === 'string' ? body.audioBase64 : ''
      const mimeType = typeof body.mimeType === 'string' ? body.mimeType : ''
      const filename = typeof body.filename === 'string' ? body.filename : undefined
      const model = typeof body.model === 'string' ? body.model : undefined

      if (!audioBase64) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'audioBase64 不能为空',
        })
      }

      try {
        return await transcribeAudio({
          audioBase64,
          mimeType: mimeType || 'audio/webm',
          filename,
          model,
        })
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        app.log.error({ err }, '[llm/transcriptions] 调用失败')
        return reply.code(502).send({
          statusCode: 502,
          error: 'Bad Gateway',
          message: errorMsg,
        })
      }
    },
  )
}

export default llmRoutes
