// 即梦 Flow 前端 - Settings API client
// 封装 GET/PUT /api/settings 的 fetch 调用。
// Vite proxy 已把 /api 转发到后端 8787，前端直接用相对路径即可。

import type { Settings, SettingsResponse } from '@jimeng-flow/shared'
import type { LlmModelInfo } from '@jimeng-flow/shared/textNode'

/** 测试连接结果 */
export interface TestConnectionResult {
  ok: boolean
  message?: string
}

async function getSettingsApiErrorMessage(
  response: Response,
  action: string,
): Promise<string> {
  try {
    const payload = (await response.json()) as { message?: unknown }
    if (typeof payload.message === 'string' && payload.message.trim()) {
      return payload.message.trim()
    }
  } catch {
    // 非 JSON 错误响应沿用状态码兜底。
  }
  return `${action}：${response.status} ${response.statusText}`
}

export interface CodexStatus {
  available: boolean
  cliFound: boolean
  authFound: boolean
  helperFound: boolean
  codexPath: string
  authFile?: string
  helperPath?: string
  setupCommands?: {
    installCodex: string
    installImageHelper?: string
    login: string
  }
  message: string
}

/** 获取当前 settings（合并默认值后的完整内容） */
export async function getSettings(): Promise<SettingsResponse> {
  const res = await fetch('/api/settings', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok) {
    throw new Error(`获取设置失败：${res.status} ${res.statusText}`)
  }
  return (await res.json()) as SettingsResponse
}

/**
 * 部分更新 settings（浅合并）。
 * @param settings 仅需要更新的字段
 */
export async function saveSettings(settings: Partial<Settings>): Promise<SettingsResponse> {
  const res = await fetch('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  })
  if (!res.ok) {
    throw new Error(await getSettingsApiErrorMessage(res, '保存设置失败'))
  }
  return (await res.json()) as SettingsResponse
}

/**
 * 测试 dreamina CLI 是否可用（不保存配置）。
 * @param settings 当前表单中的 dreaminaPath 字段
 */
export async function testJimengConnection(
  settings: Partial<Settings>,
): Promise<TestConnectionResult> {
  const res = await fetch('/api/settings/test-jimeng', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  })
  if (!res.ok) {
    throw new Error(`检测 dreamina CLI 失败：${res.status} ${res.statusText}`)
  }
  return (await res.json()) as TestConnectionResult
}

/** 检测本机 OpenAI Codex CLI 与登录态是否可用 */
export async function getCodexStatus(): Promise<CodexStatus> {
  const res = await fetch('/api/codex/status', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok) {
    throw new Error(`检测 OpenAI CLI 失败：${res.status} ${res.statusText}`)
  }
  return (await res.json()) as CodexStatus
}

export interface CodexLoginStartResult {
  ok: boolean
  message: string
}

/** 一键重新登录：清掉作废令牌并后台拉起浏览器 OAuth 登录 */
export async function startCodexLogin(): Promise<CodexLoginStartResult> {
  const res = await fetch('/api/codex/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok) {
    throw new Error(`启动 Codex 登录失败：${res.status} ${res.statusText}`)
  }
  return (await res.json()) as CodexLoginStartResult
}

/** 测试连接请求：表单字段 + 掩码时服务端回退已存密钥的字段名 */
export type TestConnectionRequest = Partial<Settings> & { apiKeyField?: string }

/**
 * 测试 LLM Provider 连接（不保存配置）。
 * @param settings 当前表单中的 llmBaseUrl、llmModel、llmApiKey 等字段；
 *   llmApiKey 为掩码时传 apiKeyField，服务端回退到已存密钥
 */
export async function testLlmConnection(
  settings: TestConnectionRequest,
): Promise<TestConnectionResult> {
  const res = await fetch('/api/settings/test-llm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  })
  if (!res.ok) {
    throw new Error(`测试 LLM 连接失败：${res.status} ${res.statusText}`)
  }
  return (await res.json()) as TestConnectionResult
}

/** 使用当前表单配置拉取中转站模型列表（不保存配置，掩码时服务端回退已存密钥） */
export async function listLlmModelsForSettings(
  settings: TestConnectionRequest,
): Promise<LlmModelInfo[]> {
  const res = await fetch('/api/settings/llm-models', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  })
  if (!res.ok) {
    throw new Error(`拉取模型列表失败：${res.status} ${res.statusText}`)
  }
  const data = (await res.json()) as LlmModelInfo[]
  return Array.isArray(data) ? data : []
}
