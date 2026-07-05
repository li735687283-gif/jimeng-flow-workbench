// 即梦 Flow 后端 - Settings 路由
// GET /api/settings  读取当前 settings（合并默认值后返回）
// PUT  /api/settings  部分更新 settings，合并后写盘并返回最新值
// 参考 PRD 10.1、7.1、8.6、12.1。

import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import type { Settings } from '@jimeng-flow/shared'
import { getSettings, updateSettings } from '../services/settings'
import { testJimengConnection } from '../services/jimeng'
import { listModels, testLlmConnection } from '../services/llm'

const settingsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // GET /api/settings
  // 返回当前 settings（含完整字段，本地工具，PRD 8.6 注明 MVP 可先存本地配置文件）。
  app.get('/api/settings', async () => {
    const settings = await getSettings()
    return settings
  })

  // PUT /api/settings
  // body: Partial<Settings>，浅合并一层后写盘。
  app.put<{ Body: Partial<Settings> }>('/api/settings', async (req, reply) => {
    const patch = req.body ?? {}
    if (typeof patch !== 'object' || Array.isArray(patch)) {
      return reply.code(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: '请求体必须为对象',
      })
    }

    // 字段白名单过滤：仅允许 Settings 已有的键，避免污染
    const allowedKeys: (keyof Settings)[] = [
      'jimengBaseUrl',
      'authMode',
      'apiKey',
      'dreaminaPath',
      'llmBaseUrl',
      'llmModel',
      'llmModels',
      'llmApiKey',
      'outputDir',
      'defaultModel',
      'defaultSize',
      'defaultVideoModel',
      'defaultVideoAspectRatio',
      'defaultVideoResolution',
      'defaultVideoQuality',
      'defaultVideoDurationSeconds',
      'defaultVideoCount',
      'defaultVideoGenerateAudio',
    ]
    const safePatch: Partial<Settings> = {}
    for (const key of Object.keys(patch) as (keyof Settings)[]) {
      if (allowedKeys.includes(key)) {
        // 类型粗校验：数值、布尔、字符串由 config 层在合并时再兜底
        const v = patch[key]
        if (v === undefined || v === null) continue
        ;(safePatch[key] as unknown) = v
      }
    }

    const updated = await updateSettings(safePatch)
    return updated
  })

  // POST /api/settings/test-jimeng
  // 使用当前表单中的 dreaminaPath 检测即梦官方 CLI，不保存配置。
  app.post<{ Body: Partial<Settings> }>('/api/settings/test-jimeng', async (req) => {
    const result = await testJimengConnection({
      jimengBaseUrl: req.body.jimengBaseUrl,
      authMode: req.body.authMode,
      apiKey: req.body.apiKey,
      dreaminaPath: req.body.dreaminaPath,
    })
    return result
  })

  // POST /api/settings/test-llm
  // 使用当前表单中的 llmBaseUrl + llmApiKey 测试连接，不保存配置。
  app.post<{ Body: Partial<Settings> }>('/api/settings/test-llm', async (req) => {
    const result = await testLlmConnection({
      llmBaseUrl: req.body.llmBaseUrl,
      llmApiKey: req.body.llmApiKey,
    })
    return result
  })

  // POST /api/settings/llm-models
  // 使用当前表单中的 llmBaseUrl + llmApiKey 拉取模型列表，不保存配置。
  app.post<{ Body: Partial<Settings> }>('/api/settings/llm-models', async (req) => {
    const models = await listModels({
      baseUrl: req.body.llmBaseUrl,
      apiKey: req.body.llmApiKey,
      timeoutMs: 10_000,
    })
    return models
  })
}

export default settingsRoutes
