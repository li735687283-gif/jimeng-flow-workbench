// 即梦 Flow 前端 - Text/Prompt 节点
// 简化为：提示词输入 + 选择 LLM + 发送
// 点击节点后下方弹出提示词编辑器（交互对齐图片节点）。

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  CSSProperties,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  WheelEvent,
} from 'react'
import type { NodeProps } from '@xyflow/react'
import { createPortal } from 'react-dom'
import {
  ArrowUp,
  Check,
  ChevronDown,
  FileText,
  LayoutTemplate,
  Loader2,
  Maximize2,
  Sparkles,
} from 'lucide-react'
import {
  DEFAULT_IMAGE_REVERSE_PROMPT,
  type TextNodeData,
} from '@jimeng-flow/shared/textNode'
import { NodeWrapper } from './NodeWrapper'
import type { BaseNodeData } from '../types/nodeTypes'
import { PromptEditor } from '../components/PromptEditor'
import { PromptTemplateLibrary } from '../components/PromptTemplateLibrary'
import { ReferenceAssetStrip } from '../components/ReferenceAssetStrip'
import {
  TEXT_FRAME_COLOR_PRESETS,
  TextActionCard,
} from '../components/TextActionCard'
import { listLlmModels, runTextNode } from '../api/llm'
import { useCanvasStore } from '../state/canvasStore'
import { useFlowStore } from '../state/flowStore'
import { useSettingsStore } from '../state/settingsStore'
import { useTextNodeStore } from '../state/textNodeStore'
import { getConfiguredChatModels } from '../utils/chatModels'
import {
  getUpstreamImageAssetIds,
  getUpstreamImageReferences,
  isCodexTextModel,
} from '../utils/textNodeImageInputs'
import {
  shouldCloseFloatingEditorOnPointerDown,
  shouldCloseFloatingMenuOnPointerDown,
} from '../utils/editorPointer'
import {
  chooseFloatingMenuDirection,
  type FloatingMenuDirection,
} from '../utils/floatingMenuPlacement'

const EDITOR_CLOSE_ANIMATION_MS = 260
const TEXT_MENU_GAP = 8
const MODEL_MENU_ROW_HEIGHT = 56
const MODEL_MENU_VERTICAL_PADDING = 20
const MODEL_MENU_MAX_HEIGHT = 440
const PROMPT_LIBRARY_ESTIMATED_HEIGHT = 520
const PROMPT_LIBRARY_WIDTH = 720

const COLORS = {
  text: '#e5e5e5',
  textDim: '#5d5d5d',
  jsonBg: '#101010',
  border: '#373737',
}

const DEFAULT_FRAME_COLOR = TEXT_FRAME_COLOR_PRESETS[0].color

const CONTAINER_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  width: 360,
  minHeight: 300,
  height: '100%',
}

const CONTENT_AREA_STYLE: CSSProperties = {
  flex: 1,
  minHeight: 240,
  width: '100%',
  display: 'flex',
  alignItems: 'stretch',
  justifyContent: 'stretch',
  padding: 0,
  overflow: 'hidden',
  boxSizing: 'border-box',
  position: 'relative',
}

const EMPTY_STATE_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  height: '100%',
  minHeight: 240,
  gap: 0,
  color: COLORS.textDim,
  fontSize: 12,
}

/** 与 CSS .text-node-body-editor / .text-node-summary 保持一致，避免预览↔编辑切换跳动 */
const TEXT_CONTENT_PADDING = '22px 40px 22px 28px'

const BODY_EDITOR_STYLE: CSSProperties = {
  width: '100%',
  height: '100%',
  minHeight: 240,
  boxSizing: 'border-box',
  resize: 'none',
  border: 'none',
  outline: 'none',
  background: 'transparent',
  color: COLORS.text,
  fontSize: 13,
  lineHeight: 1.6,
  fontFamily: 'inherit',
  padding: TEXT_CONTENT_PADDING,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  overflow: 'auto',
}

const SUMMARY_STYLE = (isJson: boolean): CSSProperties => ({
  width: '100%',
  minHeight: '100%',
  color: COLORS.text,
  fontSize: 13,
  lineHeight: 1.6,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  overflow: 'visible',
  background: isJson ? COLORS.jsonBg : 'transparent',
  border: isJson ? `1px solid ${COLORS.border}` : 'none',
  borderRadius: isJson ? 8 : 0,
  padding: isJson ? '12px 14px' : 0,
  fontFamily: isJson ? 'ui-monospace, "SF Mono", Menlo, monospace' : 'inherit',
  boxSizing: 'border-box',
})

function uniqueModels(models: string[]): string[] {
  return Array.from(new Set(models.map((item) => item.trim()).filter(Boolean)))
}

interface ChatModelOption {
  id: string
  label: string
}

export function TextNode({ id, data, selected }: NodeProps) {
  const nodeData = data as BaseNodeData & Partial<TextNodeData>
  const updateNodeData = useCanvasStore((s) => s.updateNodeData)
  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)
  const settings = useSettingsStore((s) => s.settings)
  const setLoading = useTextNodeStore((s) => s.setLoading)
  const setError = useTextNodeStore((s) => s.setError)
  const setLastRequest = useTextNodeStore((s) => s.setLastRequest)
  const callState = useTextNodeStore((s) => s.states[id])
  const loading = callState?.loading === true || nodeData.status === 'running'

  const frameColor =
    typeof nodeData.frameColor === 'string' && nodeData.frameColor.trim()
      ? nodeData.frameColor.trim()
      : DEFAULT_FRAME_COLOR

  /**
   * 上游图片引用（识图反推）：
   * 1) 优先读节点 data.inputImageAssetIds（连线时写入，保证节点会重渲染）
   * 2) 再从图结构实时计算（兼容已有连线/未写回 data 的情况）
   */
  const graphImageRefs = useMemo(
    () =>
      getUpstreamImageReferences({
        nodeId: id,
        nodes,
        edges,
      }),
    [edges, id, nodes],
  )
  const storedImageAssetIds = useMemo(() => {
    const raw = (nodeData as { inputImageAssetIds?: unknown }).inputImageAssetIds
    if (!Array.isArray(raw)) return [] as string[]
    return Array.from(
      new Set(
        raw
          .filter((item): item is string => typeof item === 'string')
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    )
  }, [nodeData])
  const upstreamImageAssetIds = useMemo(() => {
    const fromGraph = graphImageRefs.map((ref) => ref.assetId)
    return Array.from(new Set([...storedImageAssetIds, ...fromGraph]))
  }, [graphImageRefs, storedImageAssetIds])
  const hasUpstreamImages = upstreamImageAssetIds.length > 0

  // 已有连线但 data 未写 inputImageAssetIds 时，回填一次以触发节点刷新与 UI 显示
  useEffect(() => {
    if (graphImageRefs.length === 0) return
    const missing = graphImageRefs.some(
      (ref) => !storedImageAssetIds.includes(ref.assetId),
    )
    if (!missing) return
    updateNodeData(id, {
      inputImageAssetIds: upstreamImageAssetIds,
      updatedAt: new Date().toISOString(),
    } as Partial<TextNodeData>)
  }, [
    graphImageRefs,
    id,
    storedImageAssetIds,
    updateNodeData,
    upstreamImageAssetIds,
  ])

  const closeTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null)
  const modelMenuButtonRef = useRef<HTMLButtonElement | null>(null)
  const promptMenuButtonRef = useRef<HTMLButtonElement | null>(null)
  const remoteModelsFetchedRef = useRef(false)
  /** 与 bodyEditing 同步，供 click 回调里同步判断 */
  const bodyEditingRef = useRef(false)

  const [editorMounted, setEditorMounted] = useState(false)
  const [editorClosing, setEditorClosing] = useState(false)
  const [panelNoAnim, setPanelNoAnim] = useState(false)
  const [bodyEditing, setBodyEditing] = useState(false)
  const [contentExpanded, setContentExpanded] = useState(false)
  const bodyEditorRef = useRef<HTMLTextAreaElement | null>(null)
  const summaryScrollRef = useRef<HTMLDivElement | null>(null)
  /** 下方提示词框：对应 node.input，发给 LLM 的指令 */
  const [prompt, setPrompt] = useState(
    typeof nodeData.input === 'string' ? nodeData.input : '',
  )
  /** 节点正文：对应 node.content，双击编辑的是这里 */
  const [bodyDraft, setBodyDraft] = useState(
    typeof nodeData.content === 'string' ? nodeData.content : '',
  )
  const [selectedModelId, setSelectedModelId] = useState(
    nodeData.llm?.model?.trim() || '',
  )
  const [modelTouched, setModelTouched] = useState(false)
  const [modelMenuOpen, setModelMenuOpen] = useState(false)
  const [promptMenuOpen, setPromptMenuOpen] = useState(false)
  const [promptMenuStyle, setPromptMenuStyle] = useState<CSSProperties>({})
  const [menuDirection, setMenuDirection] = useState<FloatingMenuDirection>('down')
  const [remoteModels, setRemoteModels] = useState<ChatModelOption[]>([])
  const [sendError, setSendError] = useState('')

  const content = nodeData.content ?? ''
  const contentType = nodeData.contentType ?? 'text'
  const status = nodeData.status ?? 'idle'
  const llmModel = nodeData.llm?.model
  const isJson = contentType === 'json'
  const isEmpty = content.trim().length === 0

  // 外部更新 content（如 LLM 返回）时，同步正文草稿（编辑中不打断）
  useEffect(() => {
    if (bodyEditing) return
    setBodyDraft(typeof nodeData.content === 'string' ? nodeData.content : '')
  }, [bodyEditing, nodeData.content])

  // 外部更新 input 时同步提示词（用户正在改提示词时不覆盖）
  useEffect(() => {
    if (typeof nodeData.input !== 'string') return
    setPrompt((current) => (current === nodeData.input ? current : nodeData.input!))
  }, [nodeData.input])

  const configuredModelIds = useMemo(
    () =>
      getConfiguredChatModels(
        settings?.llmModels,
        settings?.llmModel,
        settings?.modelConfigs,
      ),
    [settings?.llmModel, settings?.llmModels, settings?.modelConfigs],
  )

  const modelOptions = useMemo<ChatModelOption[]>(() => {
    const fromConfig = configuredModelIds.map((modelId) => ({
      id: modelId,
      label: modelId,
    }))
    if (fromConfig.length > 0) return fromConfig
    if (remoteModels.length > 0) return remoteModels
    if (llmModel) return [{ id: llmModel, label: llmModel }]
    return []
  }, [configuredModelIds, llmModel, remoteModels])

  const selectedModel =
    modelOptions.find((model) => model.id === selectedModelId) ?? modelOptions[0]

  useEffect(() => {
    if (configuredModelIds.length > 0) return
    if (remoteModelsFetchedRef.current) return
    remoteModelsFetchedRef.current = true
    listLlmModels()
      .then((list) => {
        setRemoteModels(
          uniqueModels(list.map((item) => item.id)).map((modelId) => {
            const matched = list.find((item) => item.id === modelId)
            return {
              id: modelId,
              label: matched?.label?.trim() || modelId,
            }
          }),
        )
      })
      .catch(() => {
        setRemoteModels([])
      })
  }, [configuredModelIds.length])

  useEffect(() => {
    setSelectedModelId((current) => {
      if (modelTouched && current && modelOptions.some((model) => model.id === current)) {
        return current
      }
      if (llmModel && modelOptions.some((model) => model.id === llmModel)) {
        return llmModel
      }
      return modelOptions[0]?.id ?? ''
    })
  }, [llmModel, modelOptions, modelTouched])

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [])

  useEffect(
    () => () => {
      clearCloseTimer()
    },
    [clearCloseTimer],
  )

  const handleCloseEditorMenus = useCallback(() => {
    setModelMenuOpen(false)
    setPromptMenuOpen(false)
  }, [])

  /** 关闭下方 LLM 面板（不影响节点正文编辑） */
  const handleClosePromptPanel = useCallback(() => {
    if (!editorMounted || editorClosing) return
    setModelMenuOpen(false)
    setPromptMenuOpen(false)
    setEditorClosing(true)
    clearCloseTimer()
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null
      setEditorMounted(false)
      setEditorClosing(false)
    }, EDITOR_CLOSE_ANIMATION_MS)
  }, [clearCloseTimer, editorClosing, editorMounted])

  /** 退出节点正文编辑 */
  const handleExitBodyEdit = useCallback(() => {
    bodyEditingRef.current = false
    setBodyEditing(false)
  }, [])

  /** 打开下方提示词面板（可选择跳过入场动画） */
  const handleOpenPromptPanel = useCallback(
    (options?: { noAnim?: boolean }) => {
      clearCloseTimer()
      const alreadyOpen = editorMounted && !editorClosing
      setPanelNoAnim(Boolean(options?.noAnim) || alreadyOpen)
      setEditorMounted(true)
      setEditorClosing(false)
    },
    [clearCloseTimer, editorClosing, editorMounted],
  )

  /**
   * 双击：编辑节点正文（content）。
   * 底栏保持打开；若尚未打开则无动画挂上。
   */
  const handleEnterBodyEdit = useCallback(() => {
    bodyEditingRef.current = true
    setModelMenuOpen(false)
    setPromptMenuOpen(false)
    clearCloseTimer()
    setPanelNoAnim(true)
    setEditorMounted(true)
    setEditorClosing(false)
    setBodyDraft(typeof nodeData.content === 'string' ? nodeData.content : '')
    setBodyEditing(true)
  }, [clearCloseTimer, nodeData.content])

  const handleNodeClick = useCallback(
    (event: ReactMouseEvent) => {
      // 双击第二次 click：只进正文
      if (event.detail > 1) {
        event.stopPropagation()
        handleEnterBodyEdit()
        return
      }
      // 与图片/视频节点一致：单击立即打开底栏，无延迟
      handleOpenPromptPanel()
    },
    [handleEnterBodyEdit, handleOpenPromptPanel],
  )

  const handleNodeDoubleClick = useCallback(
    (event: ReactMouseEvent) => {
      event.stopPropagation()
      event.preventDefault()
      handleEnterBodyEdit()
    },
    [handleEnterBodyEdit],
  )

  useEffect(() => {
    if (!bodyEditing) return
    const frame = window.requestAnimationFrame(() => {
      const el = bodyEditorRef.current
      if (!el) return
      el.focus({ preventScroll: true })
      // 不调用 setSelectionRange，避免部分浏览器滚动/选区跳动造成「缩放感」
    })
    return () => window.cancelAnimationFrame(frame)
  }, [bodyEditing])

  const updateMenuDirection = useCallback(() => {
    const rect = modelMenuButtonRef.current?.getBoundingClientRect()
    if (!rect) return
    const estimatedHeight = Math.min(
      MODEL_MENU_MAX_HEIGHT,
      MODEL_MENU_VERTICAL_PADDING +
        Math.max(1, modelOptions.length) * MODEL_MENU_ROW_HEIGHT,
    )
    setMenuDirection(
      chooseFloatingMenuDirection({
        triggerTop: rect.top,
        triggerBottom: rect.bottom,
        viewportHeight: window.innerHeight,
        menuHeight: estimatedHeight,
        gap: TEXT_MENU_GAP,
      }),
    )
  }, [modelOptions.length])

  const updatePromptMenuPlacement = useCallback(() => {
    const button = promptMenuButtonRef.current
    if (!button) return
    const rect = button.getBoundingClientRect()
    const direction = chooseFloatingMenuDirection({
      triggerTop: rect.top,
      triggerBottom: rect.bottom,
      viewportHeight: window.innerHeight,
      menuHeight: PROMPT_LIBRARY_ESTIMATED_HEIGHT,
      gap: TEXT_MENU_GAP,
    })
    const left = Math.min(
      Math.max(8, rect.left),
      Math.max(8, window.innerWidth - PROMPT_LIBRARY_WIDTH - 8),
    )
    const top =
      direction === 'up'
        ? Math.max(8, rect.top - PROMPT_LIBRARY_ESTIMATED_HEIGHT - TEXT_MENU_GAP)
        : Math.min(
            window.innerHeight - PROMPT_LIBRARY_ESTIMATED_HEIGHT - 8,
            rect.bottom + TEXT_MENU_GAP,
          )
    setPromptMenuStyle({
      position: 'fixed',
      left,
      top,
      width: PROMPT_LIBRARY_WIDTH,
    })
  }, [])

  const handlePromptMenuToggle = useCallback(() => {
    if (!promptMenuOpen) updatePromptMenuPlacement()
    setPromptMenuOpen((open) => !open)
    setModelMenuOpen(false)
  }, [promptMenuOpen, updatePromptMenuPlacement])

  const handlePromptMenuPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      event.preventDefault()
      event.stopPropagation()
      handlePromptMenuToggle()
    },
    [handlePromptMenuToggle],
  )

  // 正文编辑：点节点外退出
  useEffect(() => {
    if (!bodyEditing) return

    const handleDocumentPointerDown = (event: globalThis.PointerEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (target.closest(`[data-flow-node-id="${id}"]`)) return
      if (event.button !== 0) return
      handleExitBodyEdit()
    }

    const handleDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleExitBodyEdit()
    }

    document.addEventListener('pointerdown', handleDocumentPointerDown, true)
    window.addEventListener('keydown', handleDocumentKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handleDocumentPointerDown, true)
      window.removeEventListener('keydown', handleDocumentKeyDown)
    }
  }, [bodyEditing, handleExitBodyEdit, id])

  // 提示词面板：点面板外关闭
  useEffect(() => {
    if (!editorMounted) return

    const handleDocumentPointerDown = (event: globalThis.PointerEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      const isInsideEditorOwner =
        !!target.closest(`[data-flow-node-id="${id}"]`) ||
        !!target.closest('.image-editor-panel') ||
        !!target.closest('.prompt-editor-modal') ||
        !!target.closest('.prompt-template-library')
      const isInsideMenuRoot =
        !!target.closest('.image-editor-menu-anchor') ||
        !!target.closest('.prompt-template-library')

      if (
        shouldCloseFloatingMenuOnPointerDown({
          button: event.button,
          isMenuOpen: modelMenuOpen || promptMenuOpen,
          isInsideMenuRoot,
        })
      ) {
        handleCloseEditorMenus()
      }

      if (
        !shouldCloseFloatingEditorOnPointerDown({
          button: event.button,
          isInsideEditorOwner,
        })
      ) {
        return
      }
      handleClosePromptPanel()
    }

    const handleDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleClosePromptPanel()
    }

    document.addEventListener('pointerdown', handleDocumentPointerDown, true)
    window.addEventListener('keydown', handleDocumentKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handleDocumentPointerDown, true)
      window.removeEventListener('keydown', handleDocumentKeyDown)
    }
  }, [
    editorMounted,
    handleCloseEditorMenus,
    handleClosePromptPanel,
    id,
    modelMenuOpen,
    promptMenuOpen,
  ])

  /** 仅更新下方提示词框（input），不改节点正文 */
  const persistPromptDraft = useCallback(
    (value: string) => {
      setPrompt(value)
      if (sendError) setSendError('')
      updateNodeData(id, {
        input: value,
        updatedAt: new Date().toISOString(),
      } as Partial<TextNodeData>)
      void useFlowStore.getState().saveCurrent().catch(() => undefined)
    },
    [id, sendError, updateNodeData],
  )

  const handleApplyPromptTemplate = useCallback(
    (templatePrompt: string) => {
      persistPromptDraft(templatePrompt)
      setPromptMenuOpen(false)
    },
    [persistPromptDraft],
  )

  useEffect(() => {
    if (!modelMenuOpen && !promptMenuOpen) return
    const handleResize = () => {
      if (modelMenuOpen) updateMenuDirection()
      if (promptMenuOpen) updatePromptMenuPlacement()
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    window.addEventListener('scroll', handleResize, true)
    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('scroll', handleResize, true)
    }
  }, [
    modelMenuOpen,
    promptMenuOpen,
    updateMenuDirection,
    updatePromptMenuPlacement,
  ])

  /** 双击编辑：只改节点正文（content） */
  const persistBodyDraft = useCallback(
    (value: string) => {
      setBodyDraft(value)
      updateNodeData(id, {
        content: value,
        contentType: 'text',
        promptCandidate: undefined,
        status: value.trim() ? 'success' : 'idle',
        error: undefined,
        updatedAt: new Date().toISOString(),
      } as Partial<TextNodeData>)
      void useFlowStore.getState().saveCurrent().catch(() => undefined)
    },
    [id, updateNodeData],
  )

  const persistFrameColor = useCallback(
    (color: string) => {
      updateNodeData(id, {
        frameColor: color,
        updatedAt: new Date().toISOString(),
      } as Partial<TextNodeData>)
      void useFlowStore.getState().saveCurrent().catch(() => undefined)
    },
    [id, updateNodeData],
  )

  const handleCopyAllText = useCallback(async () => {
    const text = (bodyEditing ? bodyDraft : content).trim()
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // 降级：选区复制
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.setAttribute('readonly', '')
      textarea.style.position = 'fixed'
      textarea.style.left = '-9999px'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
  }, [bodyDraft, bodyEditing, content])

  /** 与提示词框放大一致：打开大屏文本编辑界面 */
  const handleExpandText = useCallback(() => {
    setContentExpanded(true)
  }, [])

  const persistSelectedModel = useCallback(
    (modelId: string) => {
      updateNodeData(id, {
        llm: {
          provider: nodeData.llm?.provider || 'openai-compatible',
          model: modelId,
          baseUrl: nodeData.llm?.baseUrl || '',
        },
        updatedAt: new Date().toISOString(),
      } as Partial<TextNodeData>)
      void useFlowStore.getState().saveCurrent().catch(() => undefined)
    },
    [id, nodeData.llm?.baseUrl, nodeData.llm?.provider, updateNodeData],
  )

  const handleModelToggle = () => {
    if (!modelMenuOpen) updateMenuDirection()
    setModelMenuOpen((open) => !open)
    setPromptMenuOpen(false)
  }

  const handleSend = useCallback(async () => {
    const modelId = selectedModel?.id?.trim() || ''
    // 发送时取最新上游图：图结构 + 节点上缓存的 inputImageAssetIds
    const canvas = useCanvasStore.getState()
    const liveNode = canvas.nodes.find((n) => n.id === id)
    const stored = Array.isArray(
      (liveNode?.data as { inputImageAssetIds?: unknown } | undefined)
        ?.inputImageAssetIds,
    )
      ? (
          (liveNode?.data as { inputImageAssetIds?: unknown }).inputImageAssetIds as unknown[]
        )
          .filter((item): item is string => typeof item === 'string')
          .map((item) => item.trim())
          .filter(Boolean)
      : []
    const fromGraph = getUpstreamImageAssetIds({
      nodeId: id,
      nodes: canvas.nodes,
      edges: canvas.edges,
    })
    const inputImages = Array.from(new Set([...stored, ...fromGraph]))
    const typedMessage = prompt.trim()
    // 有上游图且未写提示词 → 使用默认识图指令
    const message =
      typedMessage ||
      (inputImages.length > 0 ? DEFAULT_IMAGE_REVERSE_PROMPT : '')

    if (!modelId) {
      setSendError('请先选择大语言模型')
      return
    }
    if (inputImages.length > 0 && isCodexTextModel(modelId)) {
      setSendError(
        '当前模型（Codex）不支持识图。请改选支持视觉的模型，例如 gpt-4o / qwen-vl 等 OpenAI 兼容模型',
      )
      return
    }
    if (!message) {
      setSendError(
        inputImages.length > 0
          ? '请输入分析指令，或直接发送以反推图片提示词'
          : '请先输入提示词内容，或连接上游图片后反推',
      )
      return
    }
    if (loading) return

    setSendError('')
    setLoading(id, true)
    setError(id, undefined)
    setLastRequest(id, { model: modelId, message, outputFormat: 'auto' })
    // 用户未手写时，不把默认反推长文写入 input，保持输入框干净
    if (typedMessage) {
      updateNodeData(id, {
        input: typedMessage,
        status: 'running',
        error: undefined,
        llm: {
          provider: 'openai-compatible',
          model: modelId,
          baseUrl: '',
        },
        updatedAt: new Date().toISOString(),
      } as Partial<TextNodeData>)
    } else {
      updateNodeData(id, {
        status: 'running',
        error: undefined,
        llm: {
          provider: 'openai-compatible',
          model: modelId,
          baseUrl: '',
        },
        updatedAt: new Date().toISOString(),
      } as Partial<TextNodeData>)
    }

    try {
      const res = await runTextNode(id, {
        model: modelId,
        // 有图时后端可补默认反推词；这里仍传用户原文（可为空）
        message: typedMessage,
        outputFormat: 'auto',
        inputImages,
      })
      updateNodeData(id, {
        ...(typedMessage ? { input: typedMessage } : {}),
        content: res.content,
        contentType: res.contentType,
        promptCandidate: res.promptCandidate,
        status: 'success',
        error: undefined,
        llm: {
          provider: 'openai-compatible',
          model: res.model || modelId,
          baseUrl: '',
        },
        updatedAt: new Date().toISOString(),
      } as Partial<TextNodeData>)
      setBodyDraft(res.content)
      setLoading(id, false)
      void useFlowStore.getState().saveCurrent().catch(() => undefined)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(id, msg)
      setSendError(msg)
      updateNodeData(id, {
        status: 'error',
        error: msg,
        updatedAt: new Date().toISOString(),
      } as Partial<TextNodeData>)
    }
  }, [
    id,
    loading,
    prompt,
    selectedModel?.id,
    setError,
    setLastRequest,
    setLoading,
    updateNodeData,
  ])

  // 有上游图时，自动避开 Codex 纯文本模型，优先选视觉兼容模型
  useEffect(() => {
    if (!hasUpstreamImages) return
    if (!selectedModelId || !isCodexTextModel(selectedModelId)) return
    const visionCandidate = modelOptions.find(
      (model) => !isCodexTextModel(model.id),
    )
    if (!visionCandidate) return
    setSelectedModelId(visionCandidate.id)
    setModelTouched(true)
    persistSelectedModel(visionCandidate.id)
  }, [
    hasUpstreamImages,
    modelOptions,
    persistSelectedModel,
    selectedModelId,
  ])

  const canSend =
    !!selectedModel?.id &&
    !loading &&
    (prompt.trim().length > 0 || hasUpstreamImages) &&
    !(hasUpstreamImages && isCodexTextModel(selectedModel?.id ?? ''))
  const modelMenuStyle = {
    '--image-model-menu-width': '260px',
  } as CSSProperties

  const handleSummaryWheel = useCallback(
    (event: WheelEvent<HTMLDivElement | HTMLTextAreaElement>) => {
      // 阻止画布缩放，让节点内可以正常滚轮阅读全文
      event.stopPropagation()
    },
    [],
  )

  useEffect(() => {
    if (!contentExpanded) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setContentExpanded(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [contentExpanded])

  const wrapperStyle = {
    ['--text-node-frame-color' as string]: frameColor,
  } as CSSProperties

  return (
    <NodeWrapper
      icon={FileText}
      title={nodeData.title}
      status={status}
      selected={selected}
      nodeId={id}
      nodeType="text"
      style={wrapperStyle}
    >
      <>
        {editorMounted ? (
          <TextActionCard
            frameColor={frameColor}
            copyDisabled={isEmpty && !bodyDraft.trim()}
            closing={editorClosing}
            onFrameColorChange={persistFrameColor}
            onCopyAll={handleCopyAllText}
            onExpand={handleExpandText}
          />
        ) : null}

        <div
          className={`text-node-container${bodyEditing ? ' is-body-editing' : ''}`}
          onClick={handleNodeClick}
          onDoubleClick={handleNodeDoubleClick}
          style={CONTAINER_STYLE}
          title={bodyEditing ? '正在编辑节点正文' : '单击打开提示词面板 · 双击编辑节点正文'}
        >
          <div className="node-preview-area text-node-preview" style={CONTENT_AREA_STYLE}>
            {/*
              预览层与编辑层始终同盒叠放，双击只切可见性/指针，不卸载 DOM，
              避免高度/滚动条重算造成「整块缩放」观感。
              放大入口仅在顶部工具条，节点本体不再放放大按钮。
            */}
            <div className="text-node-content-stack">
              <div
                ref={summaryScrollRef}
                className={`text-node-preview-layer${bodyEditing ? ' is-inactive' : ''}`}
                aria-hidden={bodyEditing}
              >
                {isEmpty ? (
                  <div className="text-node-empty" style={EMPTY_STATE_STYLE}>
                    <FileText
                      size={46}
                      strokeWidth={2.4}
                      className="node-placeholder-icon"
                    />
                  </div>
                ) : (
                  <div
                    className="text-node-summary nowheel"
                    onWheel={handleSummaryWheel}
                  >
                    <div style={SUMMARY_STYLE(isJson)}>{content}</div>
                  </div>
                )}
              </div>

              <textarea
                ref={bodyEditorRef}
                className={`text-node-body-editor nowheel${
                  bodyEditing ? ' is-active nodrag nopan' : ' is-inactive'
                }`}
                style={BODY_EDITOR_STYLE}
                value={bodyDraft}
                readOnly={!bodyEditing}
                tabIndex={bodyEditing ? 0 : -1}
                onChange={(event) => {
                  if (!bodyEditing) return
                  persistBodyDraft(event.target.value)
                }}
                onKeyDown={(event) => {
                  if (!bodyEditing) return
                  event.stopPropagation()
                  if (event.key === 'Escape') {
                    event.preventDefault()
                    handleExitBodyEdit()
                  }
                }}
                onWheel={(event) => {
                  if (bodyEditing) handleSummaryWheel(event)
                }}
                onPaste={(event) => {
                  if (bodyEditing) event.stopPropagation()
                }}
                onClick={(event) => {
                  if (bodyEditing) event.stopPropagation()
                }}
                onDoubleClick={(event) => {
                  if (bodyEditing) event.stopPropagation()
                }}
                onPointerDown={(event) => {
                  if (bodyEditing) event.stopPropagation()
                }}
                placeholder="编辑节点正文…"
                disabled={loading}
                spellCheck
                aria-label="节点正文编辑"
                aria-hidden={!bodyEditing}
              />
            </div>
          </div>
        </div>

        {contentExpanded && typeof document !== 'undefined'
          ? createPortal(
              <div
                className="prompt-editor-modal-backdrop nodrag nopan"
                onClick={() => setContentExpanded(false)}
                onWheel={(event) => event.stopPropagation()}
              >
                <div
                  className="prompt-editor-modal"
                  onClick={(event) => event.stopPropagation()}
                >
                  <textarea
                    className="image-editor-prompt prompt-editor-modal-textarea nodrag nopan nowheel"
                    value={bodyEditing ? bodyDraft : content}
                    onChange={(event) => {
                      // 放大视图中也可编辑，写回正文
                      persistBodyDraft(event.target.value)
                      if (!bodyEditing) {
                        bodyEditingRef.current = true
                        setBodyEditing(true)
                      }
                    }}
                    onKeyDown={(event) => event.stopPropagation()}
                    onWheel={(event) => event.stopPropagation()}
                    placeholder="编辑节点正文…"
                    spellCheck
                    autoFocus
                  />
                  <button
                    type="button"
                    className="prompt-editor-expand prompt-editor-modal-toggle nodrag nopan"
                    onClick={() => setContentExpanded(false)}
                    aria-label="收起文本"
                    title="收起"
                  >
                    <Maximize2 size={20} strokeWidth={1.9} />
                  </button>
                </div>
              </div>,
              document.body,
            )
          : null}

        {editorMounted && (
          <div
            className={`image-editor-panel text-editor-panel nodrag nopan${
              editorClosing ? ' closing' : ''
            }${panelNoAnim ? ' no-anim' : ''}`}
            onClick={(event) => event.stopPropagation()}
          >
            {hasUpstreamImages ? (
              <ReferenceAssetStrip assetIds={upstreamImageAssetIds} />
            ) : null}

            <PromptEditor
              value={prompt}
              onChange={persistPromptDraft}
              placeholder={
                hasUpstreamImages
                  ? '可选：补充分析要求（如「只要色彩和风格」）；留空则默认反推完整生图提示词'
                  : '输入发给大模型的提示词，例如：把下面这段改得更简洁'
              }
              disabled={loading}
              autoFocus={false}
            />

            <div className="image-editor-bottom">
              <div
                className={`image-editor-menu-anchor ${
                  menuDirection === 'up' ? 'drop-up' : 'drop-down'
                }`}
              >
                <button
                  ref={modelMenuButtonRef}
                  type="button"
                  className="image-editor-model-button"
                  onClick={handleModelToggle}
                  disabled={loading}
                  title="选择大语言模型"
                >
                  <Sparkles size={19} strokeWidth={1.8} />
                  <span>{selectedModel?.label || '选择模型'}</span>
                  <ChevronDown size={16} strokeWidth={1.8} />
                </button>
                {modelMenuOpen && (
                  <div className="image-model-menu" style={modelMenuStyle}>
                    {modelOptions.length === 0 ? (
                      <div className="image-model-empty">
                        暂无可用模型，请先在设置中配置 LLM
                      </div>
                    ) : (
                      modelOptions.map((model) => (
                        <button
                          type="button"
                          key={model.id}
                          className={`image-model-option${
                            model.id === selectedModel?.id ? ' selected' : ''
                          }`}
                          onClick={() => {
                            setModelTouched(true)
                            setSelectedModelId(model.id)
                            persistSelectedModel(model.id)
                            setModelMenuOpen(false)
                          }}
                        >
                          <span className="image-model-icon">
                            <Sparkles size={17} strokeWidth={1.8} />
                          </span>
                          <span className="image-model-copy">
                            <strong>{model.label}</strong>
                          </span>
                          {model.id === selectedModel?.id ? (
                            <Check size={15} strokeWidth={1.8} />
                          ) : null}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* 提示词模板库入口（与图片节点同构：LayoutTemplate 图标按钮） */}
              <div className="image-editor-menu-anchor text-prompt-template-anchor">
                <button
                  ref={promptMenuButtonRef}
                  type="button"
                  className={`image-editor-pill image-editor-prompt-action-button${
                    promptMenuOpen ? ' active' : ''
                  }`}
                  onPointerDown={handlePromptMenuPointerDown}
                  aria-label="提示词模板库"
                  aria-expanded={promptMenuOpen}
                  disabled={loading}
                  title="提示词模板库"
                >
                  <LayoutTemplate size={17} strokeWidth={1.8} />
                </button>
              </div>
              {promptMenuOpen && typeof document !== 'undefined'
                ? createPortal(
                    <PromptTemplateLibrary
                      currentPrompt={prompt}
                      style={promptMenuStyle}
                      onApply={handleApplyPromptTemplate}
                      onClose={() => setPromptMenuOpen(false)}
                    />,
                    document.body,
                  )
                : null}

              <button
                type="button"
                className="image-editor-send"
                onClick={() => void handleSend()}
                disabled={!canSend}
                title={loading ? '正在生成' : '发送给大语言模型'}
              >
                {loading ? (
                  <Loader2 size={18} strokeWidth={2} className="animate-spin" />
                ) : (
                  <ArrowUp size={20} strokeWidth={2} />
                )}
              </button>
            </div>

            {sendError || callState?.error ? (
              <div className="image-editor-status error">
                {sendError || callState?.error}
              </div>
            ) : null}
          </div>
        )}
      </>
    </NodeWrapper>
  )
}
