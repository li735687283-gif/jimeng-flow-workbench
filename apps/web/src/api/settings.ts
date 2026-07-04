// 即梦 Flow 前端 - Settings API client
// 封装 GET/PUT /api/settings 的 fetch 调用。
// Vite proxy 已把 /api 转发到后端 8787，前端直接用相对路径即可。

import type { Settings } from '@jimeng-flow/shared'

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
