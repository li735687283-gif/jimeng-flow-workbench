// 即梦 Flow 前端 - Settings API client
// 封装 GET/PUT /api/settings 的 fetch 调用。
// Vite proxy 已把 /api 转发到后端 8787，前端直接用相对路径即可。

import type { Settings } from '@jimeng-flow/shared'
import type { LlmModelInfo } from '@jimeng-flow/shared/textNode'

/** 测试连接结果 */
export interface TestConnectionResult {
  ok: boolean
  message?: string
}

/** 获取当前 settings（合并默认值后的完整内容） */
export async function getSettings(): Promise<Settings> {
  const res = await fetch('/api/settings', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok) {
    throw new Error(`获取设置失败：${res.status} ${res.statusText}`)
  }
  return (await res.json()) as Settings
}

/**
 * 部分更新 settings（浅合并）。
 * @param settings 仅需要更新的字段
 */
export async function saveSettings(settings: Partial<Settings>): Promise<Settings> {
  const res = await fetch('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  })
  if (!res.ok) {
    throw new Error(`保存设置失败：${res.status} ${res.statusText}`)
  }
  return (await res.json()) as Settings
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

/**
 * 测试 LLM Provider 连接（不保存配置）。
 * @param settings 当前表单中的 llmBaseUrl、llmModel、llmApiKey 等字段
 */
export async function testLlmConnection(
  settings: Partial<Settings>,
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

/** 使用当前表单配置拉取中转站模型列表（不保存配置） */
export async function listLlmModelsForSettings(
  settings: Partial<Settings>,
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
