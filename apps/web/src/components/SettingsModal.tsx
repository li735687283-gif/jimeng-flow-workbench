// 即梦 Flow 前端 - SettingsModal 设置弹窗组件
// 暗色主题，固定遮罩 + 居中卡片。
// 字段分组：Dreamina CLI、LLM Provider。
// 加载时拉取 GET /api/settings；保存时 PUT /api/settings，成功后更新 store 并关闭。
// 参考 PRD 7.1、8.6、11.3、12.1。

import { useEffect, useRef, useState } from 'react'
import { Plus, RefreshCw, Settings as SettingsIcon, Trash2, X } from 'lucide-react'
import type { Settings } from '@jimeng-flow/shared'
import type { LlmModelInfo } from '@jimeng-flow/shared/textNode'
import { DEFAULT_SETTINGS } from '@jimeng-flow/shared'
import { useSettingsStore } from '../state/settingsStore'
import { listLlmModelsForSettings, testJimengConnection, testLlmConnection } from '../api/settings'

export interface SettingsModalProps {
  open: boolean
  onClose: () => void
}

// 表单状态：以完整 Settings 形式保存，避免字段缺失
type FormState = Settings

const sectionStyle: React.CSSProperties = {
  borderBottom: '1px solid #2a2a2a',
  padding: '16px 0',
}
const sectionTitleStyle: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 600,
  color: '#a0a0a0',
  marginBottom: '12px',
  textTransform: 'uppercase',
  letterSpacing: '0.6px',
}
const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '12px',
}
const fieldStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
}
const labelStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#9a9a9a',
}
const inputStyle: React.CSSProperties = {
  background: '#0f0f0f',
  border: '1px solid #333',
  borderRadius: '6px',
  padding: '8px 10px',
  color: '#e8e8e8',
  fontSize: '13px',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
}

const subtleButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px',
  padding: '7px 10px',
  borderRadius: '6px',
  border: '1px solid #3a3a3a',
  background: '#242424',
  color: '#d7d7d7',
  cursor: 'pointer',
  fontSize: '12px',
  fontFamily: 'inherit',
  whiteSpace: 'nowrap',
}

const iconButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 34,
  height: 34,
  borderRadius: '6px',
  border: '1px solid #333',
  background: '#202020',
  color: '#b8b8b8',
  cursor: 'pointer',
}

const helperTextStyle: React.CSSProperties = {
  color: '#777',
  fontSize: 11,
}

function uniqueModelIds(models: string[]): string[] {
  return Array.from(
    new Set(
      models
        .map((model) => model.trim())
        .filter(Boolean),
    ),
  )
}

function normalizeModelOptions(
  availableModels: LlmModelInfo[],
  selectedModels: string[],
  defaultModel: string,
): LlmModelInfo[] {
  const map = new Map<string, LlmModelInfo>()
  for (const model of availableModels) {
    const id = (model.id || model.label || '').trim()
    if (!id) continue
    map.set(id, { ...model, id, label: model.label || id })
  }
  for (const id of uniqueModelIds([...selectedModels, defaultModel])) {
    if (!map.has(id)) {
      map.set(id, { id, label: id })
    }
  }
  return Array.from(map.values())
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { settings, loadSettings, saveSettings } = useSettingsStore()
  const [form, setForm] = useState<FormState>(DEFAULT_SETTINGS)
  const [submitting, setSubmitting] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  // 测试连接状态
  const [testingJimeng, setTestingJimeng] = useState(false)
  const [jimengTestResult, setJimengTestResult] = useState<{
    ok: boolean
    message: string
  } | null>(null)
  const [testingLlm, setTestingLlm] = useState(false)
  const [llmTestResult, setLlmTestResult] = useState<{
    ok: boolean
    message: string
  } | null>(null)
  const [availableLlmModels, setAvailableLlmModels] = useState<LlmModelInfo[]>([])
  const [loadingLlmModels, setLoadingLlmModels] = useState(false)
  const [llmModelsMessage, setLlmModelsMessage] = useState<string | null>(null)
  const autoFetchedModelsRef = useRef(false)

  // 打开时拉取一次最新 settings
  useEffect(() => {
    if (!open) return
    setLoadError(null)
    setSaveError(null)
    setJimengTestResult(null)
    setLlmTestResult(null)
    setLlmModelsMessage(null)
    autoFetchedModelsRef.current = false
    loadSettings().catch((err: unknown) => {
      setLoadError(err instanceof Error ? err.message : String(err))
    })
  }, [open, loadSettings])

  // settings 加载完成后同步到本地 form
  useEffect(() => {
    if (settings) {
      setForm(settings)
    }
  }, [settings])

  useEffect(() => {
    if (!open || !settings || autoFetchedModelsRef.current) return
    if (!settings.llmBaseUrl.trim() || !settings.llmApiKey.trim()) return
    autoFetchedModelsRef.current = true
    void refreshLlmModels(settings, { silent: true })
  }, [open, settings])

  if (!open) return null

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    setSubmitting(true)
    setSaveError(null)
    try {
      const cleanedModels = uniqueModelIds([
        ...(form.llmModels ?? []),
        form.llmModel,
      ])
      const nextForm = {
        ...form,
        llmModel: form.llmModel.trim() || cleanedModels[0] || DEFAULT_SETTINGS.llmModel,
        llmModels: cleanedModels.length > 0 ? cleanedModels : [DEFAULT_SETTINGS.llmModel],
      }
      await saveSettings(nextForm)
      onClose()
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = () => {
    setSaveError(null)
    onClose()
  }

  const handleTestJimeng = async () => {
    setTestingJimeng(true)
    setJimengTestResult(null)
    try {
      const result = await testJimengConnection(form)
      setJimengTestResult({
        ok: result.ok,
        message: result.message ?? (result.ok ? '连接成功' : '连接失败'),
      })
    } catch (err: unknown) {
      setJimengTestResult({
        ok: false,
        message: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setTestingJimeng(false)
    }
  }

  const handleTestLlm = async () => {
    setTestingLlm(true)
    setLlmTestResult(null)
    try {
      const result = await testLlmConnection(form)
      setLlmTestResult({
        ok: result.ok,
        message: result.message ?? (result.ok ? '连接成功' : '连接失败'),
      })
    } catch (err: unknown) {
      setLlmTestResult({
        ok: false,
        message: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setTestingLlm(false)
    }
  }

  async function refreshLlmModels(
    target: Partial<Settings> = form,
    opts?: { silent?: boolean },
  ) {
    setLoadingLlmModels(true)
    if (!opts?.silent) setLlmModelsMessage(null)
    try {
      const models = await listLlmModelsForSettings(target)
      setAvailableLlmModels(models)
      if (!opts?.silent) {
        setLlmModelsMessage(`已拉取 ${models.length} 个模型，可从下方添加常用项`)
      }
    } catch (err: unknown) {
      setLlmModelsMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setLoadingLlmModels(false)
    }
  }

  const addLlmModelRow = () => {
    const used = new Set(form.llmModels ?? [])
    const next = availableLlmModels.find((model) => !used.has(model.id))?.id ?? ''
    update('llmModels', [...(form.llmModels ?? []), next])
  }

  const updateLlmModelRow = (index: number, modelId: string) => {
    const next = [...(form.llmModels ?? [])]
    next[index] = modelId
    update('llmModels', uniqueModelIds(next))
    if (!form.llmModel.trim()) update('llmModel', modelId)
  }

  const removeLlmModelRow = (index: number) => {
    const next = (form.llmModels ?? []).filter((_, itemIndex) => itemIndex !== index)
    const cleaned = uniqueModelIds(next)
    update('llmModels', cleaned)
    if (form.llmModel && !cleaned.includes(form.llmModel)) {
      update('llmModel', cleaned[0] ?? '')
    }
  }

  const renderTestResult = (result: { ok: boolean; message: string } | null) => {
    if (!result) return null
    return (
      <div
        style={{
          marginBottom: '12px',
          padding: '8px 10px',
          borderRadius: '6px',
          fontSize: '12px',
          background: result.ok
            ? 'rgba(40, 160, 80, 0.12)'
            : 'rgba(220, 50, 50, 0.12)',
          border: result.ok
            ? '1px solid rgba(40, 160, 80, 0.5)'
            : '1px solid rgba(220, 50, 50, 0.5)',
          color: result.ok ? '#7ee0a0' : '#ff9a9a',
        }}
      >
        {result.ok ? '连接成功：' : '连接失败：'}
        {result.message}
      </div>
    )
  }

  const llmModelOptions = normalizeModelOptions(
    availableLlmModels,
    form.llmModels ?? [],
    form.llmModel,
  )
  const selectedLlmModels = form.llmModels ?? []
  const defaultModelOptions = uniqueModelIds([
    ...selectedLlmModels,
    form.llmModel,
  ])

  return (
    <div
      className="settings-modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={handleCancel}
    >
      <div
        className="settings-modal-content"
        style={{
          background: '#1a1a1a',
          color: '#e8e8e8',
          borderRadius: '10px',
          width: '760px',
          maxWidth: 'calc(100vw - 32px)',
          maxHeight: 'min(680px, calc(100vh - 64px))',
          overflow: 'auto',
          boxShadow: '0 10px 40px rgba(0,0,0,0.6)',
          border: '1px solid #2a2a2a',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 18px',
            borderBottom: '1px solid #2a2a2a',
            position: 'sticky',
            top: 0,
            background: '#1a1a1a',
            zIndex: 1,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <SettingsIcon size={16} color="#a0a0a0" />
            <span style={{ fontSize: '15px', fontWeight: 600 }}>设置</span>
          </div>
          <button
            type="button"
            onClick={handleCancel}
            aria-label="关闭"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#9a9a9a',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '0 18px' }}>
          {loadError && (
            <div
              style={{
                marginTop: '12px',
                padding: '8px 10px',
                background: 'rgba(220, 50, 50, 0.12)',
                border: '1px solid rgba(220, 50, 50, 0.5)',
                borderRadius: '6px',
                color: '#ff9a9a',
                fontSize: '12px',
              }}
            >
              加载设置失败：{loadError}
            </div>
          )}

          {/* Dreamina CLI */}
          <section style={sectionStyle}>
            <div
              style={{
                ...sectionTitleStyle,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span>即梦官方 CLI</span>
              <button
                type="button"
                onClick={handleTestJimeng}
                disabled={testingJimeng}
                style={{
                  padding: '4px 10px',
                  borderRadius: '4px',
                  border: '1px solid #444',
                  background: testingJimeng ? '#333' : '#252525',
                  color: testingJimeng ? '#888' : '#cfcfcf',
                  cursor: testingJimeng ? 'not-allowed' : 'pointer',
                  fontSize: '12px',
                }}
              >
                {testingJimeng ? '检测中...' : '检测 CLI'}
              </button>
            </div>
            {renderTestResult(jimengTestResult)}
            <div style={fieldStyle}>
              <label style={labelStyle} htmlFor="set-dreamina-path">
                dreamina 命令路径
              </label>
              <input
                id="set-dreamina-path"
                style={inputStyle}
                value={form.dreaminaPath}
                onChange={(e) => update('dreaminaPath', e.target.value)}
                placeholder="dreamina 或 C:\\Users\\...\\dreamina.exe"
              />
              <span style={{ color: '#777', fontSize: 11 }}>
                生成将使用本机即梦登录态，不需要火山引擎 API Key。首次使用请先在终端运行 dreamina login。
              </span>
            </div>
          </section>

          {/* LLM Provider */}
          <section style={sectionStyle}>
            <div
              style={{
                ...sectionTitleStyle,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span>LLM Provider（OpenAI-compatible）</span>
              <button
                type="button"
                onClick={handleTestLlm}
                disabled={testingLlm}
                style={{
                  padding: '4px 10px',
                  borderRadius: '4px',
                  border: '1px solid #444',
                  background: testingLlm ? '#333' : '#252525',
                  color: testingLlm ? '#888' : '#cfcfcf',
                  cursor: testingLlm ? 'not-allowed' : 'pointer',
                  fontSize: '12px',
                }}
              >
                {testingLlm ? '测试中...' : '测试连接'}
              </button>
            </div>
            {renderTestResult(llmTestResult)}
            <div style={gridStyle}>
              <div style={fieldStyle}>
                <label style={labelStyle} htmlFor="set-llm-base">
                  Base URL
                </label>
                <input
                  id="set-llm-base"
                  style={inputStyle}
                  value={form.llmBaseUrl}
                  onChange={(e) => update('llmBaseUrl', e.target.value)}
                  placeholder="https://api.openai.com/v1"
                />
              </div>
              <div style={{ ...fieldStyle, gridColumn: '1 / span 2' }}>
                <label style={labelStyle} htmlFor="set-llm-key">
                  API Key
                </label>
                <input
                  id="set-llm-key"
                  style={inputStyle}
                  type="password"
                  value={form.llmApiKey}
                  onChange={(e) => update('llmApiKey', e.target.value)}
                  placeholder="sk-..."
                />
              </div>
              <div style={{ ...fieldStyle, gridColumn: '1 / span 2', gap: '10px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                  }}
                >
                  <div>
                    <div style={{ ...labelStyle, marginBottom: 3 }}>常用模型</div>
                    <div style={helperTextStyle}>
                      先从中转站拉取模型池，再用加号添加你常用的模型；保存后 Agent 和文本节点只优先显示这些模型。
                    </div>
                  </div>
                  <button
                    type="button"
                    style={{
                      ...subtleButtonStyle,
                      opacity: loadingLlmModels ? 0.65 : 1,
                      cursor: loadingLlmModels ? 'not-allowed' : 'pointer',
                    }}
                    disabled={loadingLlmModels}
                    onClick={() => void refreshLlmModels()}
                  >
                    <RefreshCw size={13} className={loadingLlmModels ? 'animate-spin' : undefined} />
                    {loadingLlmModels ? '拉取中' : '刷新模型'}
                  </button>
                </div>

                {llmModelsMessage && (
                  <div style={{ ...helperTextStyle, color: llmModelsMessage.includes('失败') ? '#ff9a9a' : '#8d8d8d' }}>
                    {llmModelsMessage}
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {selectedLlmModels.length === 0 && (
                    <div
                      style={{
                        padding: '10px',
                        border: '1px dashed #383838',
                        borderRadius: '8px',
                        color: '#777',
                        fontSize: 12,
                      }}
                    >
                      暂未添加常用模型。点击下方加号添加一栏。
                    </div>
                  )}

                  {selectedLlmModels.map((modelId, index) => (
                    <div
                      key={`${modelId}-${index}`}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 34px',
                        gap: '8px',
                        alignItems: 'center',
                      }}
                    >
                      <select
                        style={inputStyle}
                        value={modelId}
                        onChange={(e) => updateLlmModelRow(index, e.target.value)}
                      >
                        <option value="" disabled>
                          选择一个模型
                        </option>
                        {llmModelOptions.map((model) => (
                          <option key={model.id} value={model.id}>
                            {model.label || model.id}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        style={iconButtonStyle}
                        onClick={() => removeLlmModelRow(index)}
                        aria-label="移除常用模型"
                        title="移除常用模型"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    style={{
                      ...subtleButtonStyle,
                      width: '100%',
                      justifyContent: 'center',
                      borderStyle: 'dashed',
                    }}
                    onClick={addLlmModelRow}
                  >
                    <Plus size={14} />
                    添加一个常用模型
                  </button>
                </div>

                <div style={fieldStyle}>
                  <label style={labelStyle} htmlFor="set-llm-model">
                    默认模型
                  </label>
                  <select
                    id="set-llm-model"
                    style={inputStyle}
                    value={form.llmModel}
                    onChange={(e) => update('llmModel', e.target.value)}
                  >
                    {defaultModelOptions.length === 0 && (
                      <option value="">请先添加常用模型</option>
                    )}
                    {defaultModelOptions.map((modelId) => (
                      <option key={modelId} value={modelId}>
                        {modelId}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </section>

        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px',
            padding: '14px 18px',
            borderTop: '1px solid #2a2a2a',
            position: 'sticky',
            bottom: 0,
            background: '#1a1a1a',
          }}
        >
          {saveError && (
            <div style={{ marginRight: 'auto', color: '#ff9a9a', fontSize: '12px', alignSelf: 'center' }}>
              保存失败：{saveError}
            </div>
          )}
          <button
            type="button"
            onClick={handleCancel}
            disabled={submitting}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: '1px solid #333',
              background: 'transparent',
              color: '#cfcfcf',
              cursor: submitting ? 'not-allowed' : 'pointer',
              fontSize: '13px',
            }}
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={submitting}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: '1px solid #4a4a4a',
              background: submitting ? '#3a3a3a' : '#2d2d2d',
              color: '#fff',
              cursor: submitting ? 'not-allowed' : 'pointer',
              fontSize: '13px',
            }}
          >
            {submitting ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default SettingsModal
