// 即梦 Flow 后端 - Settings service
// 封装业务逻辑：读取当前 settings、合并更新并持久化。
// 参考 PRD 10.1、8.6。

import {
  DEFAULT_SETTINGS,
  SETTINGS_SECRET_KEYS,
  SETTINGS_SECRET_MASK,
  normalizeCanvasTheme,
  normalizeThemeBackgroundMode,
  type Settings,
  type SettingsResponse,
} from '@jimeng-flow/shared'
import { readSettings, runSettingsFileOperation, writeSettings } from '../config'

const SECRET_ENDPOINT_BINDINGS = [
  ['jimengBaseUrl', 'apiKey'],
  ['llmBaseUrl', 'llmApiKey'],
  ['kimiBaseUrl', 'kimiApiKey'],
  ['kimiCodingBaseUrl', 'kimiCodingApiKey'],
  ['deepseekBaseUrl', 'deepseekApiKey'],
] as const satisfies ReadonlyArray<readonly [keyof Settings, keyof Settings]>

export class SettingsSecretBindingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SettingsSecretBindingError'
  }
}

function assertSecretEndpointBindings(
  current: Settings,
  patch: Partial<Settings>,
): void {
  for (const [baseUrlKey, secretKey] of SECRET_ENDPOINT_BINDINGS) {
    const nextBaseUrl = patch[baseUrlKey]
    if (typeof nextBaseUrl !== 'string'
      || nextBaseUrl.trim() === String(current[baseUrlKey]).trim()) {
      continue
    }

    const currentSecret = current[secretKey]
    if (typeof currentSecret === 'string'
      && currentSecret.trim()
      && patch[secretKey] === undefined) {
      throw new SettingsSecretBindingError(
        `修改 ${baseUrlKey} 时必须同时重新输入或清空对应 API Key`,
      )
    }
  }
}

/** Read the complete local settings for trusted server-side consumers. */
export async function getSettings(): Promise<Settings> {
  return readSettings()
}

export function toSettingsResponse(settings: Settings): SettingsResponse {
  const publicSettings = Object.fromEntries(
    (Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[])
      .map((key) => [key, settings[key]]),
  ) as unknown as Settings
  const hasApiKey = typeof settings.apiKey === 'string' && settings.apiKey.trim().length > 0
  const hasLlmApiKey = typeof settings.llmApiKey === 'string' && settings.llmApiKey.trim().length > 0
  const hasKimiApiKey = typeof settings.kimiApiKey === 'string' && settings.kimiApiKey.trim().length > 0
  const hasKimiCodingApiKey = typeof settings.kimiCodingApiKey === 'string'
    && settings.kimiCodingApiKey.trim().length > 0
  const hasDeepseekApiKey = typeof settings.deepseekApiKey === 'string'
    && settings.deepseekApiKey.trim().length > 0
  return {
    ...publicSettings,
    apiKey: hasApiKey ? SETTINGS_SECRET_MASK : '',
    llmApiKey: hasLlmApiKey ? SETTINGS_SECRET_MASK : '',
    kimiApiKey: hasKimiApiKey ? SETTINGS_SECRET_MASK : '',
    kimiCodingApiKey: hasKimiCodingApiKey ? SETTINGS_SECRET_MASK : '',
    deepseekApiKey: hasDeepseekApiKey ? SETTINGS_SECRET_MASK : '',
    hasApiKey,
    hasLlmApiKey,
    hasKimiApiKey,
    hasKimiCodingApiKey,
    hasDeepseekApiKey,
  }
}

/**
 * 部分更新 settings：
 * - 读取当前值
 * - 用 patch 浅合并一层（patch 中的字段覆盖当前值）
 * - 写回磁盘
 * - 返回最新 settings
 */
export function normalizeSettingsPatch(patch: Partial<Settings>): Partial<Settings> {
  const normalized = { ...patch }
  for (const key of SETTINGS_SECRET_KEYS) {
    if (normalized[key] === SETTINGS_SECRET_MASK) {
      delete normalized[key]
    }
  }
  if (patch.canvasTheme !== undefined) {
    normalized.canvasTheme = normalizeCanvasTheme(patch.canvasTheme)
  }
  if (patch.themeBackgroundMode !== undefined) {
    normalized.themeBackgroundMode = normalizeThemeBackgroundMode(patch.themeBackgroundMode)
  }
  return normalized
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  return runSettingsFileOperation(async () => {
    const current = await readSettings()
    const normalizedPatch = normalizeSettingsPatch(patch)
    assertSecretEndpointBindings(current, normalizedPatch)
    const next: Settings = { ...current, ...normalizedPatch }
    await writeSettings(next)
    return next
  })
}
