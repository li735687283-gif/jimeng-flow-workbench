// 即梦 Flow 前端 - SettingsModal 设置弹窗组件
// 暗色主题，固定遮罩 + 居中卡片。
// 字段分组：Dreamina CLI、LLM Provider。
// 加载时拉取 GET /api/settings；保存时 PUT /api/settings，成功后更新 store，并在弹窗内显示保存状态。
// 参考 PRD 7.1、8.6、11.3、12.1。

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Copy, Plus, RefreshCw, Settings as SettingsIcon, Trash2, X } from 'lucide-react'
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

const helperTextStyle: React.CSSProperties = {
  color: '#777',
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
  const [availableLlmModels, setAvailableLlmModels] = useState<LlmModelInfo[]>([])
  const [loadingLlmModels, setLoadingLlmModels] = useState(false)
  const [llmModelsMessage, setLlmModelsMessage] = useState<string | null>(null)
  const [openModelPicker, setOpenModelPicker] = useState<{
    id: string
    target: 'add' | number
  } | null>(null)
  const autoFetchedModelsRef = useRef(false)

  // 打开时拉取一次最新 settings
  useEffect(() => {
    if (!open) return
    setForm(createSettingsDraft(useSettingsStore.getState().settings))
    setLoadError(null)
    setSaveError(null)
    setJimengTestResult(null)
    setCodexTestResult(null)
    setCodexSetupCommands(FALLBACK_CODEX_SETUP_COMMANDS)
    setLlmTestResult(null)
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
    if (settings) {
      setForm(createSettingsDraft(settings))
    }
  }, [settings])

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
      setSaveStatus('saved')
    } catch (err: unknown) {
      setSaveStatus('error')
      setSaveError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = () => {
    if (guards.closeBlocked) return
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
        <div style={{ ...labelStyle, color: '#c0c0c0' }}>{title}</div>
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
            disabled={guards.closeBlocked}
            aria-label="关闭"
            className="settings-icon-button settings-modal-close-button"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#9a9a9a',
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
                className="settings-action-button"
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
                    border: '1px solid #444',
                    background: codexReloginStarting ? '#333' : '#252525',
                    color: codexReloginStarting ? '#888' : '#cfcfcf',
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
                  <div style={{ ...helperTextStyle, color: llmModelsMessage.includes('失败') ? '#cfcfcf' : '#8d8d8d' }}>
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
            disabled={guards.closeBlocked}
            className="settings-action-button settings-footer-button settings-action-button--quiet"
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: '1px solid #333',
              background: 'transparent',
              color: '#cfcfcf',
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
              border: '1px solid #4a4a4a',
              background: guards.saveBlocked ? '#3a3a3a' : '#2d2d2d',
              color: '#fff',
              cursor: guards.saveBlocked ? 'not-allowed' : 'pointer',
              fontSize: '13px',
            }}
          >
            {submitting ? (
              <>
                <RefreshCw size={13} className="animate-spin" />
                保存中...
              </>
            ) : saveStatus === 'saved' ? (
              <>
                <Check size={13} />
                已保存
              </>
            ) : saveStatus === 'error' ? (
              '重试保存'
            ) : (
              '保存'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default SettingsModal
