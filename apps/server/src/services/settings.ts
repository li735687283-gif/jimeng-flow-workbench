// 即梦 Flow 后端 - Settings service
// 封装业务逻辑：读取当前 settings、合并更新并持久化。
// 参考 PRD 10.1、8.6。

import type { Settings } from '@jimeng-flow/shared'
import { readSettings, writeSettings } from '../config'

/**
 * 读取当前 settings。
 * - 返回脱敏版本（mask 字段表示密钥是否已设置），同时保留原值供本地工具使用。
 * - MVP：本地工具，直接返回完整内容（PRD 8.6 提到后续可加密）。
 */
export async function getSettings(): Promise<Settings> {
  return readSettings()
}

/**
 * 部分更新 settings：
 * - 读取当前值
 * - 用 patch 浅合并一层（patch 中的字段覆盖当前值）
 * - 写回磁盘
 * - 返回最新 settings
 */
export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const current = await readSettings()
  const next: Settings = { ...current, ...patch }
  await writeSettings(next)
  return next
}
