// 即梦 Flow 前端 - SettingsModal 设置弹窗组件
// 全局主题，固定遮罩 + 居中卡片。
// 字段分组：Dreamina CLI、LLM Provider。
// 加载时拉取 GET /api/settings；保存时 PUT /api/settings，成功后更新 store，并在弹窗内显示保存状态。
// 参考 PRD 7.1、8.6、11.3、12.1。

import { useEffect, useRef, useState } from 'react'
import {
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  Plus,
  RefreshCw,
  Settings as SettingsIcon,
  Trash2,
  X,
} from 'lucide-react'
import type { CanvasTheme, Settings } from '@jimeng-flow/shared'
import type { LlmModelInfo } from '@jimeng-flow/shared/textNode'
import {
  DEFAULT_SETTINGS,
  buildModelConfigsFromSettings,
  normalizeCanvasTheme,
} from '@jimeng-flow/shared'
import { IMAGE_MODELS, isJimengImageModel } from '@jimeng-flow/shared/generateNode'
import { VIDEO_MODELS, isJimengVideoModel } from '@jimeng-flow/shared/videoNode'
import { useSettingsStore } from '../state/settingsStore'
import { ThemePicker } from './ThemePicker'
import {
  applyCanvasTheme,
  beginCanvasThemePreview,
  endCanvasThemePreview,
} from '../utils/canvasTheme'
import {
  createSettingsDraft,
  getSettingsModalGuards,
} from '../utils/settingsModalState'
import {
  type CodexStatus,
  getCodexStatus,
  listLlmModelsForSettings,
  startCodexLogin,
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
  borderBottom: '1px solid var(--theme-border, #2a2a2a)',
  padding: '16px 0',
}
const sectionTitleStyle: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 600,
  color: 'var(--theme-muted, #a0a0a0)',
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
  color: 'var(--theme-muted, #9a9a9a)',
}
const inputStyle: React.CSSProperties = {
  backgroundColor: 'var(--menu-control-bg, #282828)',
  border: '1px solid var(--menu-control-border, #373737)',
  borderRadius: '6px',
  padding: 'var(--menu-control-padding, 6px 8px)',
  color: 'var(--theme-heading, #e8e8e8)',
  fontSize: 'var(--menu-control-font-size, 12px)',
  fontFamily: 'inherit',
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
  border: '1px solid var(--theme-border-strong, #3a3a3a)',
  background: 'var(--theme-card, #242424)',
  color: 'var(--theme-heading, #d7d7d7)',
  cursor: 'pointer',
  fontSize: '12px',
  fontFamily: 'inherit',
  whiteSpace: 'nowrap',
}

const helperTextStyle: React.CSSProperties = {
  color: 'var(--theme-muted, #777)',
  fontSize: 11,
}

const CODEX_IMAGE_MODEL_ID = 'codex:gpt-5.5'

const CODEX_CHAT_MODEL_OPTIONS: LlmModelInfo[] = [
  {
    id: 'codex:gpt-5.6-sol',
    label: 'GPT-5.6 Sol',
    description: '旗舰 Codex CLI 模型，适合复杂创作、研究和高难度 Agent 任务',
  },
  {
    id: 'codex:gpt-5.6-terra',
    label: 'GPT-5.6 Terra',
    description: '均衡 Codex CLI 模型，适合日常 Agent 工作',
  },
  {
    id: 'codex:gpt-5.6-luna',
    label: 'GPT-5.6 Luna',
    description: '快速经济的 Codex CLI 模型，适合明确和重复性任务',
  },
  {
    id: 'codex:gpt-5.5',
    label: 'GPT-5.5',
    description: '上一代 Codex CLI 旗舰模型，保留兼容',
  },
]

const API_PROVIDER_DEFINITIONS = {
  kimi: {
    title: 'Kimi API',
    description: 'Kimi 开放平台，按量付费，适合产品集成与通用对话。',
    baseUrlKey: 'kimiBaseUrl',
    apiKeyKey: 'kimiApiKey',
    apiKeyUrl: 'https://platform.kimi.com/console/api-keys',
    baseUrlPlaceholder: 'https://api.moonshot.cn/v1',
    models: [
      { id: 'kimi-k3', label: 'Kimi K3' },
      { id: 'kimi-k2.7-code', label: 'Kimi K2.7 Code' },
      { id: 'kimi-k2.7-code-highspeed', label: 'Kimi K2.7 Code Highspeed' },
      { id: 'kimi-k2.6', label: 'Kimi K2.6' },
    ],
  },
  'kimi-coding': {
    title: 'Kimi Coding Plan',
    description: 'Kimi 会员 Coding 权益，使用独立的 Coding Plan API Key。',
    baseUrlKey: 'kimiCodingBaseUrl',
    apiKeyKey: 'kimiCodingApiKey',
    apiKeyUrl: 'https://www.kimi.com/code/console',
    baseUrlPlaceholder: 'https://api.kimi.com/coding/v1',
    models: [
      { id: 'k3', label: 'K3' },
      { id: 'kimi-for-coding', label: 'Kimi for Coding' },
      { id: 'kimi-for-coding-highspeed', label: 'Kimi for Coding Highspeed' },
    ],
  },
  deepseek: {
    title: 'DeepSeek API',
    description: 'DeepSeek 开放平台，使用独立 API Key 和 OpenAI-compatible 接口。',
    baseUrlKey: 'deepseekBaseUrl',
    apiKeyKey: 'deepseekApiKey',
    apiKeyUrl: 'https://platform.deepseek.com/api_keys',
    baseUrlPlaceholder: 'https://api.deepseek.com',
    models: [
      { id: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash' },
      { id: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro' },
    ],
  },
} as const satisfies Record<
  string,
  {
    title: string
    description: string
    baseUrlKey: keyof Settings
    apiKeyKey: keyof Settings
    apiKeyUrl: string
    baseUrlPlaceholder: string
    models: readonly LlmModelInfo[]
  }
>

type ApiProviderId = keyof typeof API_PROVIDER_DEFINITIONS

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

export function appendUniqueModelId(models: string[], modelId: string): string[] {
  return uniqueModelIds([...models, modelId])
}

type ModelPickerCategoryId = 'chat' | 'image' | 'video'

interface ModelPickerCategory {
  id: ModelPickerCategoryId
  label: string
}

const RELAY_MODEL_PICKER_CATEGORIES: ModelPickerCategory[] = [
  { id: 'chat', label: '大语言模型' },
  { id: 'image', label: '图片模型' },
  { id: 'video', label: '视频模型' },
]

const RELAY_VIDEO_MODEL_KEYWORDS = [
  'video',
  'veo',
  'sora',
  'kling',
  'seedance',
  'runway',
  'pika',
  'luma',
  'hailuo',
  'pixverse',
  'vidu',
  'skyreels',
  'wan2',
  'wan-',
  'hunyuanvideo',
  'mimo',
]

const RELAY_IMAGE_MODEL_KEYWORDS = [
  'image',
  'imagen',
  'banana',
  'gpt-image',
  'dall-e',
  'dalle',
  'flux',
  'sdxl',
  'stable-diffusion',
  'seedream',
  'midjourney',
  'recraft',
  'ideogram',
  'imagine',
]

export function getRelayModelCategory(
  model: Pick<LlmModelInfo, 'id' | 'label' | 'description'>,
): ModelPickerCategoryId {
  const text = [model.id, model.label, model.description]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  if (RELAY_VIDEO_MODEL_KEYWORDS.some((keyword) => text.includes(keyword))) {
    return 'video'
  }
  if (RELAY_IMAGE_MODEL_KEYWORDS.some((keyword) => text.includes(keyword))) {
    return 'image'
  }
  return 'chat'
}

interface SettingsModelPickerPanelProps {
  models: LlmModelInfo[]
  selectedModelIds: string[]
  currentModelId?: string
  categories?: ModelPickerCategory[]
  onSelect: (modelId: string) => void
}

export function SettingsModelPickerPanel({
  models,
  selectedModelIds,
  currentModelId,
  categories,
  onSelect,
}: SettingsModelPickerPanelProps) {
  const [activeCategoryId, setActiveCategoryId] = useState<ModelPickerCategoryId>(
    categories?.[0]?.id ?? 'chat',
  )
  const selectedModels = new Set(selectedModelIds)
  const categorizedModels = categories?.map((category) => ({
    category,
    models: models.filter((model) => getRelayModelCategory(model) === category.id),
  }))
  const activeCategory =
    categorizedModels?.find((entry) => entry.category.id === activeCategoryId) ??
    categorizedModels?.[0]
  const visibleModels = activeCategory?.models ?? models
  const listLabel = activeCategory
    ? activeCategory.category.label + '，共 ' + visibleModels.length + ' 个模型'
    : '模型列表，共 ' + models.length + ' 个模型'

  return (
    <div className={'settings-model-picker' + (categories ? ' has-categories' : '')}>
      <div className="settings-model-picker-summary">
        <span>选择一个模型</span>
        <span data-model-count={models.length}>共 {models.length} 个模型</span>
      </div>

      {categorizedModels && (
        <>
          <div className="settings-model-picker-tabs" role="tablist" aria-label="模型分类">
            {categorizedModels.map((entry) => {
              const active = entry.category.id === activeCategory?.category.id
              return (
                <button
                  type="button"
                  className={'settings-model-picker-tab' + (active ? ' is-active' : '')}
                  key={entry.category.id}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveCategoryId(entry.category.id)}
                  data-model-category={entry.category.id}
                >
                  <span>{entry.category.label}</span>
                  <span
                    className="settings-model-picker-tab-count"
                    data-model-category-count={entry.models.length}
                  >
                    {entry.models.length}
                  </span>
                </button>
              )
            })}
          </div>
          <div className="settings-model-picker-note">未识别模型归入大语言模型</div>
        </>
      )}

      <div className="settings-model-picker-list" role="listbox" aria-label={listLabel}>
        {visibleModels.length === 0 ? (
          <div className="settings-model-picker-empty">
            {models.length === 0
              ? '还没有模型，请先点击“拉取模型”。'
              : '这个分类暂时没有模型。'}
          </div>
        ) : (
          visibleModels.map((model, index) => {
            const isCurrent = model.id === currentModelId
            const isSelected = selectedModels.has(model.id) && !isCurrent
            const label = model.label || model.id

            return (
              <button
                type="button"
                className={
                  'settings-model-picker-option' + (isCurrent ? ' is-current' : '')
                }
                key={model.id + '-' + index}
                role="option"
                aria-selected={isCurrent || isSelected}
                disabled={isSelected}
                onClick={() => onSelect(model.id)}
                data-model-option-id={model.id}
              >
                <span className="settings-model-picker-option-copy">
                  <span className="settings-model-picker-option-label">{label}</span>
                  {label !== model.id && (
                    <span className="settings-model-picker-option-id">{model.id}</span>
                  )}
                </span>
                <span className="settings-model-picker-option-state">
                  {isCurrent ? '当前已选' : isSelected ? '已添加' : null}
                </span>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}

interface RelayModelPickerPanelProps {
  models: LlmModelInfo[]
  selectedModelIds: string[]
  currentModelId?: string
  onSelect: (modelId: string) => void
}

export function RelayModelPickerPanel(props: RelayModelPickerPanelProps) {
  return (
    <SettingsModelPickerPanel
      {...props}
      categories={RELAY_MODEL_PICKER_CATEGORIES}
    />
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
  const [form, setForm] = useState<FormState>(() => createSettingsDraft(DEFAULT_SETTINGS))
  const [submitting, setSubmitting] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
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
  const [codexReloginStarting, setCodexReloginStarting] = useState(false)
  const [codexSetupCommands, setCodexSetupCommands] = useState(
    FALLBACK_CODEX_SETUP_COMMANDS,
  )
  const [testingLlm, setTestingLlm] = useState(false)
  const [llmTestResult, setLlmTestResult] = useState<{
    ok: boolean
    message: string
  } | null>(null)
  const [testingApiProvider, setTestingApiProvider] = useState<ApiProviderId | null>(null)
  const [apiProviderTestResults, setApiProviderTestResults] = useState<
    Partial<Record<ApiProviderId, { ok: boolean; message: string }>>
  >({})
  const [availableLlmModels, setAvailableLlmModels] = useState<LlmModelInfo[]>([])
  const [loadingLlmModels, setLoadingLlmModels] = useState(false)
  const [llmModelsMessage, setLlmModelsMessage] = useState<string | null>(null)
  const [openModelPicker, setOpenModelPicker] = useState<{
    id: string
    target: 'add' | number
  } | null>(null)
  const autoFetchedModelsRef = useRef(false)
  const confirmedThemeRef = useRef<CanvasTheme>('dark')
  const previewThemeRef = useRef<CanvasTheme>('dark')
  const themePreviewChangedRef = useRef(false)

  // 打开时拉取一次最新 settings
  useEffect(() => {
    if (!open) return
    const persistedTheme = normalizeCanvasTheme(
      useSettingsStore.getState().settings?.canvasTheme,
    )
    confirmedThemeRef.current = persistedTheme
    previewThemeRef.current = persistedTheme
    themePreviewChangedRef.current = false
    endCanvasThemePreview()
    applyCanvasTheme(persistedTheme)
    setForm(createSettingsDraft(useSettingsStore.getState().settings))
    setLoadError(null)
    setSaveError(null)
    setJimengTestResult(null)
    setCodexTestResult(null)
    setCodexSetupCommands(FALLBACK_CODEX_SETUP_COMMANDS)
    setLlmTestResult(null)
    setTestingApiProvider(null)
    setApiProviderTestResults({})
    setLlmModelsMessage(null)
    setSaveStatus('idle')
    setOpenModelPicker(null)
    autoFetchedModelsRef.current = false
    loadSettings().catch((err: unknown) => {
      setLoadError(err instanceof Error ? err.message : String(err))
    })
  }, [open, loadSettings])

  // settings 加载完成后同步到本地 form
  useEffect(() => {
    if (!settings) return
    const persistedTheme = normalizeCanvasTheme(settings.canvasTheme)
    setForm((previous) => {
      const next = createSettingsDraft(settings)
      if (open && themePreviewChangedRef.current) {
        next.canvasTheme = previous.canvasTheme
      }
      return next
    })
    if (open && themePreviewChangedRef.current) {
      beginCanvasThemePreview()
      applyCanvasTheme(previewThemeRef.current)
    } else if (open) {
      confirmedThemeRef.current = persistedTheme
      endCanvasThemePreview()
      applyCanvasTheme(persistedTheme)
    }
  }, [open, settings])

  useEffect(() => {
    if (!open || !settings || autoFetchedModelsRef.current) return
    if (!settings.llmBaseUrl.trim() || !settings.llmApiKey.trim()) return
    autoFetchedModelsRef.current = true
    void refreshLlmModels(settings, { silent: true })
  }, [open, settings])

  if (!open) return null

  const guards = getSettingsModalGuards(submitting)

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setSaveStatus('idle')
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const updateStringSetting = (key: keyof Settings, value: string) => {
    setSaveStatus('idle')
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleThemePreview = (theme: CanvasTheme) => {
    previewThemeRef.current = theme
    themePreviewChangedRef.current = true
    setSaveStatus('idle')
    setForm((previous) => ({ ...previous, canvasTheme: theme }))
    beginCanvasThemePreview()
    applyCanvasTheme(theme)
  }

  const handleSave = async () => {
    if (guards.saveBlocked) return
    setSubmitting(true)
    setSaveStatus('saving')
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
      const confirmedTheme = normalizeCanvasTheme(nextForm.canvasTheme)
      confirmedThemeRef.current = confirmedTheme
      previewThemeRef.current = confirmedTheme
      themePreviewChangedRef.current = false
      endCanvasThemePreview()
      applyCanvasTheme(confirmedTheme)
      setSaveStatus('saved')
      onClose()
    } catch (err: unknown) {
      setSaveStatus('error')
      setSaveError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = () => {
    if (guards.closeBlocked) return
    const persistedTheme = normalizeCanvasTheme(
      useSettingsStore.getState().settings?.canvasTheme ?? confirmedThemeRef.current,
    )
    previewThemeRef.current = persistedTheme
    themePreviewChangedRef.current = false
    endCanvasThemePreview()
    applyCanvasTheme(persistedTheme)
    setForm(createSettingsDraft(useSettingsStore.getState().settings))
    setSaveStatus('idle')
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

  /** 一键重新登录:清掉作废令牌并拉起浏览器 OAuth(登录态失效时用) */
  const handleCodexRelogin = async () => {
    setCodexReloginStarting(true)
    setCodexTestResult(null)
    try {
      const result = await startCodexLogin()
      setCodexTestResult({ ok: result.ok, message: result.message })
    } catch (err: unknown) {
      setCodexTestResult({
        ok: false,
        message: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setCodexReloginStarting(false)
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

  const handleTestApiProvider = async (providerId: ApiProviderId) => {
    const definition = API_PROVIDER_DEFINITIONS[providerId]
    setTestingApiProvider(providerId)
    setApiProviderTestResults((current) => {
      const next = { ...current }
      delete next[providerId]
      return next
    })
    try {
      const result = await testLlmConnection({
        llmBaseUrl: String(form[definition.baseUrlKey] ?? ''),
        llmApiKey: String(form[definition.apiKeyKey] ?? ''),
      })
      setApiProviderTestResults((current) => ({
        ...current,
        [providerId]: {
          ok: result.ok,
          message: result.message ?? (result.ok ? '连接成功' : '连接失败'),
        },
      }))
    } catch (err: unknown) {
      setApiProviderTestResults((current) => ({
        ...current,
        [providerId]: {
          ok: false,
          message: err instanceof Error ? err.message : String(err),
        },
      }))
    } finally {
      setTestingApiProvider((current) => (current === providerId ? null : current))
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

  const addImageModel = (modelId: string) => {
    update('imageModels', cleanImageModelIds([...(form.imageModels ?? []), modelId]))
  }

  const addVideoModel = (modelId: string) => {
    update('videoModels', cleanVideoModelIds([...(form.videoModels ?? []), modelId]))
  }

  const addLlmModel = (modelId: string) => {
    update('llmModels', appendUniqueModelId(form.llmModels ?? [], modelId))
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
            ? 'var(--theme-accent-soft, rgba(255, 255, 255, 0.12))'
            : 'var(--theme-accent-softer, rgba(255, 255, 255, 0.08))',
          border: result.ok
            ? '1px solid var(--theme-border-strong, rgba(255, 255, 255, 0.34))'
            : '1px solid var(--theme-border, rgba(255, 255, 255, 0.2))',
          color: result.ok ? 'var(--theme-heading, #eeeeee)' : 'var(--theme-text, #cfcfcf)',
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

  const apiProviderModelIds = new Set<string>(
    Object.values(API_PROVIDER_DEFINITIONS).flatMap((definition) =>
      definition.models.map((model) => model.id),
    ),
  )
  const getApiProviderModels = (providerId: ApiProviderId) => {
    const modelIds = new Set<string>(
      API_PROVIDER_DEFINITIONS[providerId].models.map((model) => model.id),
    )
    const indices = selectedLlmModels
      .map((id, idx) => ({ id, idx }))
      .filter(({ id }) => modelIds.has(id))
      .map(({ idx }) => idx)
    return {
      indices,
      models: indices.map((idx) => selectedLlmModels[idx]),
    }
  }
  const kimiApiModelState = getApiProviderModels('kimi')
  const kimiCodingModelState = getApiProviderModels('kimi-coding')
  const deepseekModelState = getApiProviderModels('deepseek')

  const relayModelIndices = selectedLlmModels
    .map((id, idx) => ({ id, idx }))
    .filter(
      ({ id }) =>
        !id.toLowerCase().startsWith('codex:') &&
        !apiProviderModelIds.has(id) &&
        !isJimengImageModel(id) &&
        !isJimengVideoModel(id),
    )
    .map(({ idx }) => idx)
  const relayModels = relayModelIndices.map((idx) => selectedLlmModels[idx])

  const jimengImageOptions = IMAGE_MODELS.map((m) => ({ id: m.id, label: m.label }))
  const codexImageOptions = [{ id: CODEX_IMAGE_MODEL_ID, label: CODEX_IMAGE_MODEL_ID }]
  const jimengVideoOptions = VIDEO_MODELS.map((m) => ({ id: m.id, label: m.label }))
  const codexChatOptions = CODEX_CHAT_MODEL_OPTIONS

  const renderModelList = (
    pickerId: string,
    title: string,
    emptyHint: string,
    models: string[],
    indices: number[],
    options: LlmModelInfo[],
    selectedModelIds: string[],
    addLabel: string,
    onAdd: (modelId: string) => void,
    onUpdate: (index: number, modelId: string) => void,
    onRemove: (index: number) => void,
    pickerCategories?: ModelPickerCategory[],
    pickerDirection: 'up' | 'down' = 'down',
  ) => {
    const pickerDirectionClass = pickerDirection === 'up' ? ' is-upward' : ''
    const isPickerOpen = (target: 'add' | number) =>
      openModelPicker?.id === pickerId && openModelPicker.target === target
    const selectModel = (target: 'add' | number, modelId: string) => {
      if (target === 'add') {
        onAdd(modelId)
      } else {
        onUpdate(target, modelId)
      }
      setOpenModelPicker(null)
    }

    return (
      <div className="settings-model-list">
        <div style={{ ...labelStyle, color: 'var(--theme-heading, #c0c0c0)' }}>{title}</div>
        {models.length === 0 && (
          <div className="settings-model-list-empty">{emptyHint}</div>
        )}

        {models.map((modelId, displayIndex) => {
          const originalIndex = indices[displayIndex]
          const model = options.find((item) => item.id === modelId)
          const label = model?.label || modelId
          const pickerOpen = isPickerOpen(originalIndex)

          return (
            <div className="settings-model-list-row" key={modelId + '-' + originalIndex}>
              <div className={'settings-model-picker-wrap' + pickerDirectionClass}>
                <button
                  type="button"
                  className={'settings-model-list-selected' + (pickerOpen ? ' is-open' : '')}
                  onClick={() =>
                    setOpenModelPicker((current) =>
                      current?.id === pickerId && current.target === originalIndex
                        ? null
                        : { id: pickerId, target: originalIndex },
                    )
                  }
                  aria-expanded={pickerOpen}
                >
                  <span className="settings-model-list-selected-copy">
                    <span className="settings-model-list-selected-label">{label}</span>
                  </span>
                  <ChevronDown size={14} aria-hidden="true" />
                </button>

                {pickerOpen && (
                  <SettingsModelPickerPanel
                    models={options}
                    selectedModelIds={selectedModelIds}
                    currentModelId={modelId}
                    categories={pickerCategories}
                    onSelect={(value) => selectModel(originalIndex, value)}
                  />
                )}
              </div>
              <button
                type="button"
                className="settings-icon-button"
                onClick={() => onRemove(originalIndex)}
                aria-label={'移除' + title}
                title={'移除' + title}
              >
                <Trash2 size={14} />
              </button>
            </div>
          )
        })}

        <div className={'settings-model-picker-wrap' + pickerDirectionClass}>
          <button
            type="button"
            className={'settings-model-list-add' + (isPickerOpen('add') ? ' is-open' : '')}
            onClick={() =>
              setOpenModelPicker((current) =>
                current?.id === pickerId && current.target === 'add'
                  ? null
                  : { id: pickerId, target: 'add' },
              )
            }
            aria-expanded={isPickerOpen('add')}
          >
            <Plus size={14} />
            {addLabel}
            <ChevronDown size={14} aria-hidden="true" />
          </button>

          {isPickerOpen('add') && (
            <SettingsModelPickerPanel
              models={options}
              selectedModelIds={selectedModelIds}
              categories={pickerCategories}
              onSelect={(modelId) => selectModel('add', modelId)}
            />
          )}
        </div>
      </div>
    )
  }

  const renderApiProviderSection = (
    providerId: ApiProviderId,
    modelState: { models: string[]; indices: number[] },
  ) => {
    const definition = API_PROVIDER_DEFINITIONS[providerId]
    const isTesting = testingApiProvider === providerId
    const baseUrl = String(form[definition.baseUrlKey] ?? '')
    const apiKey = String(form[definition.apiKeyKey] ?? '')

    return (
      <section style={sectionStyle} key={providerId}>
        <div
          style={{
            ...sectionTitleStyle,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{definition.title}</span>
          <button
            type="button"
            onClick={() => void handleTestApiProvider(providerId)}
            className="settings-action-button"
            disabled={isTesting}
            style={{
              padding: '4px 10px',
              borderRadius: '4px',
              border: '1px solid var(--theme-border-strong, #444)',
              background: isTesting ? 'var(--theme-control-hover, #333)' : 'var(--theme-control, #252525)',
              color: isTesting ? 'var(--theme-muted, #888)' : 'var(--theme-heading, #cfcfcf)',
              cursor: isTesting ? 'not-allowed' : 'pointer',
              fontSize: '12px',
            }}
          >
            {isTesting ? '测试中...' : '测试连接'}
          </button>
        </div>
        <div style={{ ...helperTextStyle, marginBottom: '12px' }}>
          {definition.description}
        </div>
        {renderTestResult(apiProviderTestResults[providerId] ?? null)}
        <div style={gridStyle}>
          <div style={fieldStyle}>
            <label style={labelStyle} htmlFor={`set-${providerId}-base`}>
              Base URL
            </label>
            <input
              id={`set-${providerId}-base`}
              style={inputStyle}
              value={baseUrl}
              onChange={(event) =>
                updateStringSetting(definition.baseUrlKey, event.target.value)
              }
              placeholder={definition.baseUrlPlaceholder}
            />
          </div>
          <div style={{ ...fieldStyle, gridColumn: '1 / span 2' }}>
            <div className="settings-api-key-label-row">
              <label style={labelStyle} htmlFor={`set-${providerId}-key`}>
                API Key
              </label>
              <a
                className="settings-api-key-link"
                href={definition.apiKeyUrl}
                target="_blank"
                rel="noreferrer"
                title={`打开${definition.title}密钥管理页面`}
              >
                获取 API Key
                <ExternalLink size={12} aria-hidden="true" />
              </a>
            </div>
            <input
              id={`set-${providerId}-key`}
              style={inputStyle}
              type="password"
              value={apiKey}
              onChange={(event) =>
                updateStringSetting(definition.apiKeyKey, event.target.value)
              }
              placeholder="sk-..."
            />
          </div>
          <div style={{ ...fieldStyle, gridColumn: '1 / span 2', gap: '10px' }}>
            {renderModelList(
              `api-${providerId}`,
              '模型',
              `暂未添加${definition.title}模型。点击下方加号添加。`,
              modelState.models,
              modelState.indices,
              [...definition.models],
              selectedLlmModels,
              '添加一个模型',
              addLlmModel,
              updateLlmModelRow,
              removeLlmModelRow,
            )}
          </div>
        </div>
      </section>
    )
  }

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
        background: 'var(--theme-overlay, rgba(0, 0, 0, 0.58))',
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
          background: 'var(--theme-panel, #1a1a1a)',
          color: 'var(--theme-heading, #e8e8e8)',
          borderRadius: '12px',
          width: 'min(960px, calc(100vw - 96px))',
          height: 'min(720px, calc(100vh - 96px))',
          overflow: 'auto',
          boxShadow: 'var(--theme-panel-shadow, 0 10px 40px rgba(0,0,0,0.6))',
          border: '1px solid var(--theme-border, #2a2a2a)',
        }}
        onClick={(e) => {
          if (
            openModelPicker &&
            !(e.target instanceof Element && e.target.closest('.settings-model-picker-wrap'))
          ) {
            setOpenModelPicker(null)
          }
          e.stopPropagation()
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 18px',
            borderBottom: '1px solid var(--theme-border, #2a2a2a)',
            position: 'sticky',
            top: 0,
            background: 'var(--theme-panel, #1a1a1a)',
            zIndex: 1,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <SettingsIcon size={16} color="var(--theme-muted, #a0a0a0)" />
            <span style={{ fontSize: '15px', fontWeight: 600 }}>设置</span>
          </div>
          <button
            type="button"
            onClick={handleCancel}
            disabled={guards.closeBlocked}
            aria-label="关闭"
            className="settings-icon-button settings-modal-close-button"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--theme-muted, #9a9a9a)',
              cursor: guards.closeBlocked ? 'not-allowed' : 'pointer',
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
                background: 'var(--theme-accent-softer, rgba(255, 255, 255, 0.08))',
                border: '1px solid var(--theme-border, rgba(255, 255, 255, 0.2))',
                borderRadius: '6px',
                color: 'var(--theme-text, #cfcfcf)',
                fontSize: '12px',
              }}
            >
              加载设置失败：{loadError}
            </div>
          )}


          <ThemePicker
            value={normalizeCanvasTheme(form.canvasTheme)}
            onChange={handleThemePreview}
          />

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
                className="settings-action-button"
                disabled={testingJimeng}
                style={{
                  padding: '4px 10px',
                  borderRadius: '4px',
                  border: '1px solid var(--theme-border-strong, #444)',
                  background: testingJimeng ? 'var(--theme-control-hover, #333)' : 'var(--theme-control, #252525)',
                  color: testingJimeng ? 'var(--theme-muted, #888)' : 'var(--theme-heading, #cfcfcf)',
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
              <span style={{ color: 'var(--theme-muted, #777)', fontSize: 11 }}>
                生成将使用本机即梦登录态，不需要火山引擎 API Key。首次使用请先在终端运行 dreamina login。
              </span>
            </div>
            <div style={{ ...fieldStyle, gap: '16px', marginTop: '8px' }}>
              {renderModelList(
                'jimeng-image',
                '图片模型',
                '暂未添加即梦图片模型。点击下方加号添加。',
                jimengImageModels,
                jimengImageModelIndices,
                jimengImageOptions,
                selectedImageModels,
                '添加一个图片模型',
                addImageModel,
                updateImageModelRow,
                removeImageModelRow,
              )}
              {renderModelList(
                'jimeng-video',
                '视频模型',
                '暂未添加即梦视频模型。点击下方加号添加。',
                jimengVideoModels,
                jimengVideoModelIndices,
                jimengVideoOptions,
                selectedVideoModels,
                '添加一个视频模型',
                addVideoModel,
                updateVideoModelRow,
                removeVideoModelRow,
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
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleCodexRelogin}
                  className="settings-action-button"
                  disabled={codexReloginStarting}
                  title="登录态失效时点击:清除旧令牌并在浏览器中重新登录"
                  style={{
                    padding: '4px 10px',
                    borderRadius: '4px',
                    border: '1px solid var(--theme-border-strong, #444)',
                    background: codexReloginStarting ? 'var(--theme-control-hover, #333)' : 'var(--theme-control, #252525)',
                    color: codexReloginStarting ? 'var(--theme-muted, #888)' : 'var(--theme-heading, #cfcfcf)',
                    cursor: codexReloginStarting ? 'not-allowed' : 'pointer',
                    fontSize: '12px',
                  }}
                >
                  {codexReloginStarting ? '正在打开登录...' : '重新登录'}
                </button>
                <button
                  type="button"
                  onClick={handleTestCodex}
                  className="settings-action-button"
                  disabled={testingCodex}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '4px',
                    border: '1px solid var(--theme-border-strong, #444)',
                    background: testingCodex ? 'var(--theme-control-hover, #333)' : 'var(--theme-control, #252525)',
                    color: testingCodex ? 'var(--theme-muted, #888)' : 'var(--theme-heading, #cfcfcf)',
                    cursor: testingCodex ? 'not-allowed' : 'pointer',
                    fontSize: '12px',
                  }}
                >
                  {testingCodex ? '检测中...' : '检测 Codex'}
                </button>
              </div>
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
                  <span style={{ ...labelStyle, color: 'var(--theme-text, #b8b8b8)' }}>
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
                    className="settings-icon-button"
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
                'codex-image',
                '图片模型',
                '暂未添加 OpenAI CLI 图片模型。点击下方加号添加。',
                codexImageModels,
                codexImageModelIndices,
                codexImageOptions,
                selectedImageModels,
                '添加一个图片模型',
                addImageModel,
                updateImageModelRow,
                removeImageModelRow,
              )}
              {renderModelList(
                'codex-chat',
                '大语言模型',
                '暂未添加 OpenAI CLI 大语言模型。点击下方加号添加。',
                codexChatModels,
                codexChatModelIndices,
                codexChatOptions,
                selectedLlmModels,
                '添加一个模型',
                addLlmModel,
                updateLlmModelRow,
                removeLlmModelRow,
              )}
            </div>
          </section>

          {renderApiProviderSection('kimi', kimiApiModelState)}
          {renderApiProviderSection('kimi-coding', kimiCodingModelState)}
          {renderApiProviderSection('deepseek', deepseekModelState)}

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
                className="settings-action-button"
                disabled={testingLlm}
                style={{
                  padding: '4px 10px',
                  borderRadius: '4px',
                  border: '1px solid var(--theme-border-strong, #444)',
                  background: testingLlm ? 'var(--theme-control-hover, #333)' : 'var(--theme-control, #252525)',
                  color: testingLlm ? 'var(--theme-muted, #888)' : 'var(--theme-heading, #cfcfcf)',
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
                    className="settings-action-button"
                    style={{
                      ...subtleButtonStyle,
                      opacity: loadingLlmModels ? 0.65 : 1,
                      cursor: loadingLlmModels ? 'not-allowed' : 'pointer',
                    }}
                    disabled={loadingLlmModels}
                    onClick={() => void refreshLlmModels()}
                  >
                    <RefreshCw size={13} className={loadingLlmModels ? 'animate-spin' : undefined} />
                    {loadingLlmModels ? '拉取中' : '拉取模型'}
                  </button>
                </div>

                {llmModelsMessage && (
                  <div style={{ ...helperTextStyle, color: llmModelsMessage.includes('失败') ? 'var(--theme-text, #cfcfcf)' : 'var(--theme-muted, #8d8d8d)' }}>
                    {llmModelsMessage}
                  </div>
                )}

                {renderModelList(
                  'relay-models',
                  '已添加模型',
                  '暂未添加第三方 API 模型。点击下方加号添加。',
                  relayModels,
                  relayModelIndices,
                  availableLlmModels,
                  selectedLlmModels,
                  '添加一个模型',
                  addLlmModel,
                  updateLlmModelRow,
                  removeLlmModelRow,
                  RELAY_MODEL_PICKER_CATEGORIES,
                  'up',
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
            borderTop: '1px solid var(--theme-border, #2a2a2a)',
            position: 'sticky',
            bottom: 0,
            background: 'var(--theme-panel, #1a1a1a)',
          }}
        >
          {saveError && (
            <div style={{ marginRight: 'auto', color: 'var(--theme-text, #cfcfcf)', fontSize: '12px', alignSelf: 'center' }}>
              保存失败：{saveError}
            </div>
          )}
          <button
            type="button"
            onClick={handleCancel}
            disabled={guards.closeBlocked}
            className="settings-action-button settings-footer-button settings-action-button--quiet"
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: '1px solid var(--theme-border, #333)',
              background: 'transparent',
              color: 'var(--theme-text, #cfcfcf)',
              cursor: guards.closeBlocked ? 'not-allowed' : 'pointer',
              fontSize: '13px',
            }}
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={guards.saveBlocked}
            className={'settings-action-button settings-footer-button settings-action-button--primary' + (submitting ? ' is-saving' : saveStatus === 'saved' ? ' is-success' : saveStatus === 'error' ? ' is-error' : '')}
            aria-busy={submitting}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: '1px solid var(--theme-border-strong, #4a4a4a)',
              background: guards.saveBlocked ? 'var(--theme-control, #3a3a3a)' : 'var(--theme-accent, #2d2d2d)',
              color: 'var(--theme-accent-contrast, #fff)',
              cursor: guards.saveBlocked ? 'not-allowed' : 'pointer',
              fontSize: '13px',
            }}
          >
            {submitting ? (
              <>
                <RefreshCw size={13} className="animate-spin" />
                确认中...
              </>
            ) : saveStatus === 'saved' ? (
              <>
                <Check size={13} />
                已确认
              </>
            ) : saveStatus === 'error' ? (
              '重试确认'
            ) : (
              '确认'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default SettingsModal
