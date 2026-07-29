// 即梦 Flow 后端 - Settings 路由
// GET /api/settings  读取当前 settings（合并默认值后返回）
// PUT  /api/settings  部分更新 settings，合并后写盘并返回最新值
// 参考 PRD 10.1、7.1、8.6、12.1。

import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import {
  DEFAULT_SETTINGS,
  SETTINGS_SECRET_MASK,
  type Settings,
} from '@jimeng-flow/shared'
import {
  SettingsSecretBindingError,
  getSettings,
  toSettingsResponse,
  updateSettings,
} from '../services/settings'
import {
  isAllowedDreaminaExecutablePath,
  testJimengConnection,
} from '../services/jimeng'
import { listModels, testLlmConnection } from '../services/llm'

/** 测试连接时可回退到已存密钥的字段白名单 */
const TEST_SECRET_FALLBACK_FIELDS = new Set([
  'apiKey',
  'llmApiKey',
  'kimiApiKey',
  'kimiCodingApiKey',
  'deepseekApiKey',
])

type TestConnectionBody = Partial<Settings> & { apiKeyField?: string }

/**
 * 解析测试连接用密钥：表单提供真实密钥时直接用；
 * 表单是掩码（已保存密钥不回显）或为空时，按 apiKeyField 回退到服务端已存密钥。
 */
async function resolveTestApiKey(body: TestConnectionBody): Promise<string> {
  const provided = typeof body.llmApiKey === 'string' ? body.llmApiKey.trim() : ''
  if (provided && provided !== SETTINGS_SECRET_MASK) return provided
  const stored = await getSettings()
  const field =
    typeof body.apiKeyField === 'string' &&
    TEST_SECRET_FALLBACK_FIELDS.has(body.apiKeyField)
      ? (body.apiKeyField as keyof Settings)
      : 'llmApiKey'
  const value = stored[field]
  return typeof value === 'string' ? value.trim() : ''
}

function isValidSettingsPatchValue(key: keyof Settings, value: unknown): boolean {
  const defaultValue = DEFAULT_SETTINGS[key]
  if (Array.isArray(defaultValue)) return Array.isArray(value)
  if (typeof defaultValue === 'number') {
    return typeof value === 'number' && Number.isFinite(value)
  }
  return typeof value === typeof defaultValue
}

const settingsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // GET /api/settings — return credential presence without exposing secret values.
  app.get('/api/settings', async () => {
    const settings = await getSettings()
    return toSettingsResponse(settings)
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
      'kimiBaseUrl',
      'kimiApiKey',
      'kimiCodingBaseUrl',
      'kimiCodingApiKey',
      'deepseekBaseUrl',
      'deepseekApiKey',
      'outputDir',
      'canvasTheme',
      'themeBackgroundMode',
      'homeHeroImagePath',
      'homeMokHeroImagePath',
      'homeMokHeroScale',
      'homeMokHeroOffsetX',
      'homeMokHeroOffsetY',
      'homeMokHeroMarginTop',
      'defaultModel',
      'imageModels',
      'defaultSize',
      'defaultVideoModel',
      'videoModels',
      'defaultVideoAspectRatio',
      'defaultVideoResolution',
      'defaultVideoQuality',
      'defaultVideoDurationSeconds',
      'defaultVideoCount',
      'defaultVideoGenerateAudio',
      'modelConfigs',
    ]
    const safePatch: Partial<Settings> = {}
    for (const key of Object.keys(patch) as (keyof Settings)[]) {
      if (allowedKeys.includes(key)) {
        // 类型粗校验：数值、布尔、字符串由 config 层在合并时再兜底
        const v = patch[key]
        if (v === undefined || v === null) continue
        if (!isValidSettingsPatchValue(key, v)) {
          return reply.code(400).send({
            statusCode: 400,
            error: 'Bad Request',
            message: `设置字段 ${key} 的类型无效`,
          })
        }
        if (key === 'dreaminaPath' && !isAllowedDreaminaExecutablePath(v)) {
          return reply.code(400).send({
            statusCode: 400,
            error: 'Bad Request',
            message: '即梦 CLI 只能使用由服务端 PATH 解析的 dreamina 命令',
          })
        }
        ;(safePatch[key] as unknown) = v
      }
    }

    try {
      const updated = await updateSettings(safePatch)
      return toSettingsResponse(updated)
    } catch (err) {
      if (err instanceof SettingsSecretBindingError) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: err.message,
        })
      }
      throw err
    }
  })

  // POST /api/settings/test-jimeng
  // 使用当前表单中的 dreaminaPath 检测即梦官方 CLI，不保存配置。
  app.post<{ Body: Partial<Settings> }>('/api/settings/test-jimeng', async (req, reply) => {
    const body = req.body ?? {}
    if (body.dreaminaPath !== undefined
      && !isAllowedDreaminaExecutablePath(body.dreaminaPath)) {
      return reply.code(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: '即梦 CLI 只能使用由服务端 PATH 解析的 dreamina 命令',
      })
    }
    const result = await testJimengConnection({
      jimengBaseUrl: body.jimengBaseUrl,
      authMode: body.authMode,
      apiKey: body.apiKey,
      dreaminaPath: body.dreaminaPath,
    })
    return result
  })

  // POST /api/settings/test-llm
  // 使用当前表单中的 llmBaseUrl + llmApiKey 测试连接，不保存配置；
  // 密钥为掩码/空时按 apiKeyField 回退到已存密钥。
  app.post<{ Body: TestConnectionBody }>('/api/settings/test-llm', async (req) => {
    const result = await testLlmConnection({
      llmBaseUrl: req.body.llmBaseUrl,
      llmApiKey: await resolveTestApiKey(req.body),
    })
    return result
  })

  // POST /api/settings/llm-models
  // 使用当前表单中的 llmBaseUrl + llmApiKey 拉取模型列表，不保存配置；
  // 密钥为掩码/空时同样回退到已存密钥。
  app.post<{ Body: TestConnectionBody }>('/api/settings/llm-models', async (req) => {
    const models = await listModels({
      baseUrl: req.body.llmBaseUrl,
      apiKey: await resolveTestApiKey(req.body),
      timeoutMs: 10_000,
    })
    return models
  })
}

export default settingsRoutes
