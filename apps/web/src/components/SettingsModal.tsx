// 即梦 Flow 前端 - SettingsModal 设置弹窗组件
// 暗色主题，固定遮罩 + 居中卡片。
// 字段分组：Dreamina CLI、LLM Provider。
// 加载时拉取 GET /api/settings；保存时 PUT /api/settings，成功后更新 store 并关闭。
// 参考 PRD 7.1、8.6、11.3、12.1。

import { useEffect, useRef, useState } from 'react'
import { Copy, Plus, RefreshCw, Settings as SettingsIcon, Trash2, X } from 'lucide-react'
import type { Settings } from '@jimeng-flow/shared'
import type { LlmModelInfo } from '@jimeng-flow/shared/textNode'
import {
  DEFAULT_SETTINGS,
  buildModelConfigsFromSettings,
} from '@jimeng-flow/shared'
import { IMAGE_MODELS, isJimengImageModel } from '@jimeng-flow/shared/generateNode'
import { VIDEO_MODELS, isJimengVideoModel } from '@jimeng-flow/shared/videoNode'
import { useSettingsStore } from '../state/settingsStore'
import {
  type CodexStatus,
  getCodexStatus,
  listLlmModelsForSettings,
  testJimengConnection,
  testLlmConnection,
} from '../api/settings'

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
  backgroundColor: 'var(--menu-control-bg, #282828)',
  border: '1px solid var(--menu-control-border, #373737)',
  borderRadius: '6px',
  padding: 'var(--menu-control-padding, 6px 8px)',
  color: '#e8e8e8',
  fontSize: 'var(--menu-control-font-size, 12px)',
  fontFamily: 'inherit',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
}

const dropdownControlStyle: React.CSSProperties = {
  ...inputStyle,
  '--menu-control-font-size': '12px',
  '--menu-control-padding': '6px 8px',
} as React.CSSProperties

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

const CODEX_IMAGE_MODEL_ID = 'codex:gpt-5.5'

const CODEX_CHAT_MODEL_OPTIONS: LlmModelInfo[] = [
  {
    id: 'codex:gpt-5.5',
    label: 'codex:gpt-5.5',
    description: 'Codex chat 模型走本机 ChatGPT 登录态',
  },
]

const FALLBACK_CODEX_SETUP_COMMANDS: NonNullable<CodexStatus['setupCommands']> = {
  installCodex: 'powershell -NoProfile -ExecutionPolicy Bypass -Command "irm https://chatgpt.com/codex/install.ps1 | iex"',
  login: 'codex',
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

function normalizeImageModelId(modelId: string): string {
  const id = modelId.trim()
  const normalized = id.toLowerCase()
  return normalized === '$imagegen' || normalized === 'gpt-image-2'
    ? 'codex:gpt-5.5'
    : id
}

function cleanImageModelIds(models: string[]): string[] {
  return uniqueModelIds(models.map(normalizeImageModelId))
}

function cleanVideoModelIds(models: string[]): string[] {
  return uniqueModelIds(models)
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
  const [testingCodex, setTestingCodex] = useState(false)
  const [codexTestResult, setCodexTestResult] = useState<{
    ok: boolean
    message: string
  } | null>(null)
  const [codexSetupCommands, setCodexSetupCommands] = useState(
    FALLBACK_CODEX_SETUP_COMMANDS,
  )
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
    setCodexTestResult(null)
    setCodexSetupCommands(FALLBACK_CODEX_SETUP_COMMANDS)
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
      const cleanedModels = uniqueModelIds(form.llmModels ?? [])
      const cleanedImageModels = cleanImageModelIds(form.imageModels ?? [])
      const cleanedVideoModels = cleanVideoModelIds(form.videoModels ?? [])
      const nextForm = {
        ...form,
        llmModel: form.llmModel.trim() || cleanedModels[0] || '',
        llmModels: cleanedModels,
        defaultModel: '',
        imageModels: cleanedImageModels,
        defaultVideoModel: '',
        videoModels: cleanedVideoModels,
      }
      nextForm.modelConfigs = buildModelConfigsFromSettings(nextForm)
      await saveSettings(nextForm)
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

  const handleTestCodex = async () => {
    setTestingCodex(true)
    setCodexTestResult(null)
    try {
      const result = await getCodexStatus()
      if (result.setupCommands) {
        setCodexSetupCommands(result.setupCommands)
      }
      setCodexTestResult({
        ok: result.available,
        message: `${result.message}；图片生成使用 Codex CLI 通道`,
      })
    } catch (err: unknown) {
      setCodexTestResult({
        ok: false,
        message: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setTestingCodex(false)
    }
  }

  const handleCopyCommand = (command: string) => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return
    void navigator.clipboard.writeText(command).catch(() => undefined)
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

  const updateLlmModelRow = (index: number, modelId: string) => {
    const next = [...(form.llmModels ?? [])]
    next[index] = modelId
    update('llmModels', uniqueModelIds(next))
  }

  const removeLlmModelRow = (index: number) => {
    const next = (form.llmModels ?? []).filter((_, itemIndex) => itemIndex !== index)
    update('llmModels', uniqueModelIds(next))
  }

  const updateImageModelRow = (index: number, modelId: string) => {
    const next = [...(form.imageModels ?? [])]
    next[index] = modelId
    const cleaned = cleanImageModelIds(next)
    update('imageModels', cleaned)
  }

  const removeImageModelRow = (index: number) => {
    const next = (form.imageModels ?? []).filter((_, itemIndex) => itemIndex !== index)
    const cleaned = cleanImageModelIds(next)
    update('imageModels', cleaned)
  }

  const updateVideoModelRow = (index: number, modelId: string) => {
    const next = [...(form.videoModels ?? [])]
    next[index] = modelId
    const cleaned = cleanVideoModelIds(next)
    update('videoModels', cleaned)
  }

  const removeVideoModelRow = (index: number) => {
    const next = (form.videoModels ?? []).filter((_, itemIndex) => itemIndex !== index)
    const cleaned = cleanVideoModelIds(next)
    update('videoModels', cleaned)
  }

  const addJimengImageModel = () => {
    const used = new Set(form.imageModels ?? [])
    const next = IMAGE_MODELS.find((m) => !used.has(m.id))?.id ?? ''
    update('imageModels', [...(form.imageModels ?? []), next])
  }

  const addCodexImageModel = () => {
    const used = new Set(form.imageModels ?? [])
    const next = !used.has(CODEX_IMAGE_MODEL_ID) ? CODEX_IMAGE_MODEL_ID : ''
    update('imageModels', [...(form.imageModels ?? []), next])
  }

  const addJimengVideoModel = () => {
    const used = new Set(form.videoModels ?? [])
    const next = VIDEO_MODELS.find((m) => !used.has(m.id))?.id ?? ''
    update('videoModels', [...(form.videoModels ?? []), next])
  }

  const addCodexChatModel = () => {
    const used = new Set(form.llmModels ?? [])
    const next = CODEX_CHAT_MODEL_OPTIONS.find((m) => !used.has(m.id))?.id ?? ''
    update('llmModels', [...(form.llmModels ?? []), next])
  }

  const addRelayModel = () => {
    const used = new Set(form.llmModels ?? [])
    const next = availableLlmModels.find((m) => !used.has(m.id))?.id ?? ''
    update('llmModels', [...(form.llmModels ?? []), next])
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
            ? 'rgba(255, 255, 255, 0.12)'
            : 'rgba(255, 255, 255, 0.08)',
          border: result.ok
            ? '1px solid rgba(255, 255, 255, 0.34)'
            : '1px solid rgba(255, 255, 255, 0.2)',
          color: result.ok ? '#eeeeee' : '#cfcfcf',
        }}
      >
        {result.ok ? '连接成功：' : '连接失败：'}
        {result.message}
      </div>
    )
  }

  const selectedLlmModels = form.llmModels ?? []
  const selectedImageModels = form.imageModels ?? []
  const selectedVideoModels = form.videoModels ?? []

  const jimengImageModelIndices = selectedImageModels
    .map((id, idx) => ({ id, idx }))
    .filter(({ id }) => isJimengImageModel(id))
    .map(({ idx }) => idx)
  const jimengImageModels = jimengImageModelIndices.map((idx) => selectedImageModels[idx])

  const codexImageModelIndices = selectedImageModels
    .map((id, idx) => ({ id, idx }))
    .filter(({ id }) => id.toLowerCase().startsWith('codex:'))
    .map(({ idx }) => idx)
  const codexImageModels = codexImageModelIndices.map((idx) => selectedImageModels[idx])

  const jimengVideoModelIndices = selectedVideoModels
    .map((id, idx) => ({ id, idx }))
    .filter(({ id }) => isJimengVideoModel(id))
    .map(({ idx }) => idx)
  const jimengVideoModels = jimengVideoModelIndices.map((idx) => selectedVideoModels[idx])

  const codexChatModelIndices = selectedLlmModels
    .map((id, idx) => ({ id, idx }))
    .filter(({ id }) => id.toLowerCase().startsWith('codex:'))
    .map(({ idx }) => idx)
  const codexChatModels = codexChatModelIndices.map((idx) => selectedLlmModels[idx])

  const relayModelIndices = selectedLlmModels
    .map((id, idx) => ({ id, idx }))
    .filter(
      ({ id }) =>
        !id.toLowerCase().startsWith('codex:') &&
        !isJimengImageModel(id) &&
        !isJimengVideoModel(id),
    )
    .map(({ idx }) => idx)
  const relayModels = relayModelIndices.map((idx) => selectedLlmModels[idx])

  const jimengImageOptions = IMAGE_MODELS.map((m) => ({ id: m.id, label: m.label }))
  const codexImageOptions = [{ id: CODEX_IMAGE_MODEL_ID, label: CODEX_IMAGE_MODEL_ID }]
  const jimengVideoOptions = VIDEO_MODELS.map((m) => ({ id: m.id, label: m.label }))
  const codexChatOptions = CODEX_CHAT_MODEL_OPTIONS
  const relayModelOptions = availableLlmModels

  const renderModelList = (
    title: string,
    emptyHint: string,
    models: string[],
    indices: number[],
    options: LlmModelInfo[],
    datalistId: string,
    placeholder: string,
    addLabel: string,
    onAdd: () => void,
    onUpdate: (displayIndex: number, value: string) => void,
    onRemove: (displayIndex: number) => void,
  ) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ ...labelStyle, color: '#c0c0c0' }}>{title}</div>
      {models.length === 0 && (
        <div
          style={{
            padding: '10px',
            border: '1px dashed #383838',
            borderRadius: '8px',
            color: '#777',
            fontSize: 12,
          }}
        >
          {emptyHint}
        </div>
      )}

      <datalist id={datalistId}>
        {options.map((model) => (
          <option key={model.id} value={model.id}>
            {model.label || model.id}
          </option>
        ))}
      </datalist>

      {models.map((modelId, displayIndex) => {
        const originalIndex = indices[displayIndex]
        return (
          <div
            key={`${modelId}-${originalIndex}`}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 34px',
              gap: '8px',
              alignItems: 'center',
            }}
          >
            <input
              className="settings-dropdown-control"
              style={dropdownControlStyle}
              list={datalistId}
              value={modelId}
              onChange={(e) => onUpdate(displayIndex, e.target.value)}
              placeholder={placeholder}
            />
            <button
              type="button"
              style={iconButtonStyle}
              onClick={() => onRemove(displayIndex)}
              aria-label={`移除${title}`}
              title={`移除${title}`}
            >
              <Trash2 size={14} />
            </button>
          </div>
        )
      })}

      <button
        type="button"
        style={{
          ...subtleButtonStyle,
          width: '100%',
          justifyContent: 'center',
          borderStyle: 'dashed',
        }}
        onClick={onAdd}
      >
        <Plus size={14} />
        {addLabel}
      </button>
    </div>
  )

  const codexSetupRows = [
    { label: '安装 Codex CLI', command: codexSetupCommands.installCodex },
    { label: '打开登录', command: codexSetupCommands.login },
  ].filter((row) => !!row.command)

  return (
    <div
      className="settings-modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.58)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px',
        backdropFilter: 'blur(7px)',
        zIndex: 1000,
      }}
      onClick={handleCancel}
      onDragOver={(e) => {
        e.preventDefault()
        e.stopPropagation()
        e.dataTransfer.dropEffect = 'none'
      }}
      onDrop={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
    >
      <div
        className="settings-modal-content"
        style={{
          background: '#1a1a1a',
          color: '#e8e8e8',
          borderRadius: '12px',
          width: 'min(960px, calc(100vw - 96px))',
          height: 'min(720px, calc(100vh - 96px))',
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
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '6px',
                color: '#cfcfcf',
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
            <div style={{ ...fieldStyle, gap: '16px', marginTop: '8px' }}>
              {renderModelList(
                '图片模型',
                '暂未添加即梦图片模型。点击下方加号添加。',
                jimengImageModels,
                jimengImageModelIndices,
                jimengImageOptions,
                'set-jimeng-image-model-options',
                '选择或输入图片模型 ID',
                '添加一个图片模型',
                addJimengImageModel,
                (displayIndex, value) => updateImageModelRow(jimengImageModelIndices[displayIndex], value),
                (displayIndex) => removeImageModelRow(jimengImageModelIndices[displayIndex]),
              )}
              {renderModelList(
                '视频模型',
                '暂未添加即梦视频模型。点击下方加号添加。',
                jimengVideoModels,
                jimengVideoModelIndices,
                jimengVideoOptions,
                'set-jimeng-video-model-options',
                '选择或输入视频模型 ID',
                '添加一个视频模型',
                addJimengVideoModel,
                (displayIndex, value) => updateVideoModelRow(jimengVideoModelIndices[displayIndex], value),
                (displayIndex) => removeVideoModelRow(jimengVideoModelIndices[displayIndex]),
              )}
            </div>
          </section>

          {/* OpenAI CLI */}
          <section style={sectionStyle}>
            <div
              style={{
                ...sectionTitleStyle,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span>OpenAI CLI</span>
              <button
                type="button"
                onClick={handleTestCodex}
                disabled={testingCodex}
                style={{
                  padding: '4px 10px',
                  borderRadius: '4px',
                  border: '1px solid #444',
                  background: testingCodex ? '#333' : '#252525',
                  color: testingCodex ? '#888' : '#cfcfcf',
                  cursor: testingCodex ? 'not-allowed' : 'pointer',
                  fontSize: '12px',
                }}
              >
                {testingCodex ? '检测中...' : '检测 Codex'}
              </button>
            </div>
            {renderTestResult(codexTestResult)}
            <div style={helperTextStyle}>
              已登录本机 Codex 后，可在下方添加 codex:gpt-5.5 等 OpenAI CLI 模型。
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                marginTop: '10px',
              }}
            >
              {codexSetupRows.map((row) => (
                <div
                  key={row.label}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '112px 1fr 34px',
                    gap: '8px',
                    alignItems: 'center',
                  }}
                >
                  <span style={{ ...labelStyle, color: '#b8b8b8' }}>
                    {row.label}
                  </span>
                  <code
                    style={{
                      ...inputStyle,
                      display: 'block',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontFamily: 'Consolas, "SFMono-Regular", monospace',
                    }}
                    title={row.command}
                  >
                    {row.command}
                  </code>
                  <button
                    type="button"
                    style={iconButtonStyle}
                    onClick={() => handleCopyCommand(row.command)}
                    aria-label={`复制${row.label}命令`}
                    title={`复制${row.label}命令`}
                  >
                    <Copy size={14} />
                  </button>
                </div>
              ))}
            </div>
            <div style={{ ...fieldStyle, gap: '16px', marginTop: '8px' }}>
              {renderModelList(
                '图片模型',
                '暂未添加 OpenAI CLI 图片模型。点击下方加号添加。',
                codexImageModels,
                codexImageModelIndices,
                codexImageOptions,
                'set-codex-image-model-options',
                '选择或输入图片模型 ID',
                '添加一个图片模型',
                addCodexImageModel,
                (displayIndex, value) => updateImageModelRow(codexImageModelIndices[displayIndex], value),
                (displayIndex) => removeImageModelRow(codexImageModelIndices[displayIndex]),
              )}
              {renderModelList(
                '大语言模型',
                '暂未添加 OpenAI CLI 大语言模型。点击下方加号添加。',
                codexChatModels,
                codexChatModelIndices,
                codexChatOptions,
                'set-codex-chat-model-options',
                '选择或输入模型 ID',
                '添加一个模型',
                addCodexChatModel,
                (displayIndex, value) => updateLlmModelRow(codexChatModelIndices[displayIndex], value),
                (displayIndex) => removeLlmModelRow(codexChatModelIndices[displayIndex]),
              )}
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
                    <div style={{ ...labelStyle, marginBottom: 3 }}>模型</div>
                    <div style={helperTextStyle}>
                      先从中转站拉取模型池，再用加号添加模型；保存后 Agent 和文本节点只优先显示这些模型。
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
                  <div style={{ ...helperTextStyle, color: llmModelsMessage.includes('失败') ? '#cfcfcf' : '#8d8d8d' }}>
                    {llmModelsMessage}
                  </div>
                )}

                {renderModelList(
                  '模型',
                  '暂未添加中转站模型。点击下方加号添加。',
                  relayModels,
                  relayModelIndices,
                  relayModelOptions,
                  'set-relay-model-options',
                  '选择或输入模型 ID',
                  '添加一个模型',
                  addRelayModel,
                  (displayIndex, value) => updateLlmModelRow(relayModelIndices[displayIndex], value),
                  (displayIndex) => removeLlmModelRow(relayModelIndices[displayIndex]),
                )}
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
            <div style={{ marginRight: 'auto', color: '#cfcfcf', fontSize: '12px', alignSelf: 'center' }}>
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
