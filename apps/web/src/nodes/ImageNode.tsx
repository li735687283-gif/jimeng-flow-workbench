// 即梦 Flow 前端 - Image 节点
// 参考 PRD 6.2、7.3、13.9。
//
// MVP 能力：
// - 大面积图片预览（基于 data.assetId 通过 /api/assets/<id>/file 加载）
// - 空图片或加载失败显示居中图片占位图标
// - data 字段：title, status, assetId?, assetPath?, asReference?

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent } from 'react'
import { createPortal } from 'react-dom'
import type { NodeProps } from '@xyflow/react'
import {
  ArrowUp,
  Check,
  ChevronDown,
  History,
  Image as ImageIcon,
  Sparkles,
} from 'lucide-react'
import {
  appendImageGenerationRun,
  type GenerationRequest,
  type GenerationResponse,
  type ImageGenerationRun,
  isJimengImageModel,
} from '@jimeng-flow/shared/generateNode'
import { NodeWrapper } from './NodeWrapper'
import type { BaseNodeData } from '../types/nodeTypes'
import {
  downloadAssetFile,
  getAssetFileUrl,
  upscaleImageAsset,
} from '../api/assets'
import { startImageGenerationFlow } from '../utils/imageGenerationFlow'
import { getCodexStatus, testJimengConnection } from '../api/settings'
import { ImageActionCard } from '../components/ImageActionCard'
import { ImageFullscreenViewer } from '../components/ImageFullscreenViewer'
import { PromptEditor } from '../components/PromptEditor'
import { PromptTemplateLibrary } from '../components/PromptTemplateLibrary'
import { ReferenceAssetStrip } from '../components/ReferenceAssetStrip'
import { useCanvasStore } from '../state/canvasStore'
import { useFlowStore } from '../state/flowStore'
import { useGenerateStore } from '../state/generateStore'
import { useSettingsStore } from '../state/settingsStore'
import {
  shouldCloseFloatingEditorOnPointerDown,
  shouldCloseFloatingMenuOnPointerDown,
} from '../utils/editorPointer'
import {
  buildImageGenerationRunFromResponse,
  getEditorStateFromImageGenerationRun,
  getImageGenerationHistoryItems,
  getImageGenerationHistoryPreviewScale,
} from '../utils/imageGenerationHistory'
import {
  getImageGenerationProgressState,
  shouldShowImagePlaceholderIcon,
} from '../utils/imageGenerationProgress'
import { getImageGenerationInputImages } from '../utils/imageGenerationInputs'
import {
  getConfiguredImageModels,
  getImageModelMenuWidth,
  shouldRequireJimengCliForImageModel,
} from '../utils/imageModels'
import { clampPreviewScale } from '../utils/imageFullscreenPreview'
import { resolveImageGenerationDefaults } from '../utils/generationDefaults'
import { useGenerationDefaultsStore } from '../state/generationDefaultsStore'
import {
  chooseFloatingMenuDirection,
  type FloatingMenuDirection,
} from '../utils/floatingMenuPlacement'

interface ImageNodeData extends BaseNodeData {
  assetId?: string
  assetPath?: string
  localPreviewUrl?: string
  asReference?: boolean
  width?: number
  height?: number
  outputAssetIds?: string[]
  generationId?: string
  prompt?: string
  model?: string
  count?: number
  quality?: string
  ratio?: string
  resolution?: string
  inputImageAssetIds?: string[]
  generationRuns?: ImageGenerationRun[]
}

const CONTAINER_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  width: 360,
  minHeight: 300,
}

const PREVIEW_STYLE: CSSProperties = {
  flex: 1,
  minHeight: 178,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  borderRadius: 11,
  overflow: 'hidden',
}

const MEDIA_DISPLAY_STYLE: CSSProperties = {
  width: 720,
  maxWidth: '72vw',
  maxHeight: 420,
  borderRadius: 12,
  overflow: 'hidden',
}

const MEDIA_IMG_STYLE: CSSProperties = {
  display: 'block',
  width: '100%',
  height: '100%',
  objectFit: 'contain',
}

const PLACEHOLDER_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  minHeight: 178,
  color: 'var(--text-dim)',
}

const QUALITY_OPTIONS = ['低画质', '标准画质', '高画质'] as const
const RESOLUTION_OPTIONS = ['1K', '2K', '4K'] as const
const RATIO_OPTIONS = [
  '自适应',
  '1:1',
  '1:2',
  '2:1',
  '9:16',
  '16:9',
  '3:4',
  '4:3',
  '3:2',
  '2:3',
  '5:4',
  '4:5',
  '21:9',
  '9:21',
] as const
const COUNT_OPTIONS = [1, 2, 4] as const
const EDITOR_CLOSE_ANIMATION_MS = 260
const IMAGE_MENU_GAP = 8
const MODEL_MENU_ROW_HEIGHT = 56
const MODEL_MENU_VERTICAL_PADDING = 20
const MODEL_MENU_MAX_HEIGHT = 440
const QUALITY_MENU_ESTIMATED_HEIGHT = 468
const COUNT_MENU_VERTICAL_PADDING = 14
const COUNT_MENU_ITEM_HEIGHT = 36
const PROMPT_LIBRARY_ESTIMATED_HEIGHT = 520
const PROMPT_LIBRARY_WIDTH = 720

type ImageEditorMenuKind = 'model' | 'quality' | 'count' | 'prompt'

function isCodexImageModel(modelId: string): boolean {
  return modelId.trim().toLowerCase().startsWith('codex:')
}

interface ImageGenerationSubmitOptions {
  prompt?: string
  modelId?: string
  quality?: (typeof QUALITY_OPTIONS)[number]
  ratio?: (typeof RATIO_OPTIONS)[number]
  resolution?: (typeof RESOLUTION_OPTIONS)[number]
  count?: (typeof COUNT_OPTIONS)[number]
  inputImageAssetIds?: string[]
}

function getSizeFromRatio(ratio: string, resolution: string) {
  const longSide = resolution === '4K' ? 2048 : resolution === '2K' ? 1536 : 1024
  const shortSide = resolution === '4K' ? 1152 : resolution === '2K' ? 864 : 576

  switch (ratio) {
    case '9:16':
      return { width: shortSide, height: longSide }
    case '16:9':
      return { width: longSide, height: shortSide }
    case '1:2':
      return { width: shortSide, height: shortSide * 2 }
    case '2:1':
      return { width: shortSide * 2, height: shortSide }
    case '3:4':
      return { width: shortSide, height: Math.round((shortSide * 4) / 3) }
    case '4:3':
      return { width: Math.round((shortSide * 4) / 3), height: shortSide }
    case '3:2':
      return { width: Math.round((shortSide * 3) / 2), height: shortSide }
    case '2:3':
      return { width: shortSide, height: Math.round((shortSide * 3) / 2) }
    case '5:4':
      return { width: Math.round((shortSide * 5) / 4), height: shortSide }
    case '4:5':
      return { width: shortSide, height: Math.round((shortSide * 5) / 4) }
    case '21:9':
      return { width: longSide, height: Math.round((longSide * 9) / 21) }
    case '9:21':
      return { width: Math.round((longSide * 9) / 21), height: longSide }
    case '1:1':
    case '自适应':
    default:
      return { width: longSide, height: longSide }
  }
}

function getDisplayFrameStyle(size: { width: number; height: number }): CSSProperties {
  const ratio = size.width / size.height
  let width: number
  let height: number

  if (ratio >= 1) {
    width = ratio >= 1.7 ? 720 : ratio >= 1.2 ? 560 : 430
    height = width / ratio
  } else {
    height = ratio <= 0.6 ? 560 : ratio <= 0.82 ? 520 : 430
    width = height * ratio
  }

  return {
    width,
    height,
    maxWidth: '72vw',
    maxHeight: '62vh',
    aspectRatio: `${size.width} / ${size.height}`,
  }
}

function PromptLibraryIcon() {
  return (
    <svg
      className="prompt-library-icon"
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4.2 5.8h2.4v8.1H4.2a1 1 0 0 1-1-1V6.8a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinejoin="round"
      />
      <path
        d="M6.6 5.1h2.5v8.8H6.6V5.1Z"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinejoin="round"
      />
      <path
        d="M9.1 5.8h2.4a1 1 0 0 1 1 1v6.1a1 1 0 0 1-1 1H9.1V5.8Z"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinejoin="round"
      />
      <path
        d="M5.1 4.5 12.9 2.7l.6 2.5-7.8 1.8-.6-2.5Z"
        fill="#2a2a2a"
        stroke="currentColor"
        strokeWidth="1.45"
        strokeLinejoin="round"
      />
      <path d="M4.6 8.1h1.1M7.2 8.1H8M9.7 8.1h1.1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

export function ImageNode({ id, data, selected }: NodeProps) {
  const nodeData = data as ImageNodeData
  const settings = useSettingsStore((state) => state.settings)
  const isJimengConfigured = useSettingsStore((state) => state.isJimengConfigured)
  const nodes = useCanvasStore((state) => state.nodes)
  const edges = useCanvasStore((state) => state.edges)
  const updateNodeData = useCanvasStore((state) => state.updateNodeData)
  const removeIncomingImageReference = useCanvasStore(
    (state) => state.removeIncomingImageReference,
  )
  const closeTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null)
  const modelMenuButtonRef = useRef<HTMLButtonElement | null>(null)
  const qualityMenuButtonRef = useRef<HTMLButtonElement | null>(null)
  const countMenuButtonRef = useRef<HTMLButtonElement | null>(null)
  const promptMenuButtonRef = useRef<HTMLButtonElement | null>(null)
  const generationUnsubscribeRef = useRef<(() => void) | null>(null)
  const rememberedDefaultsRef = useRef(useGenerationDefaultsStore.getState().image)

  useEffect(() => {
    return () => {
      generationUnsubscribeRef.current?.()
    }
  }, [])
  const [imgError, setImgError] = useState(false)
  const [editorMounted, setEditorMounted] = useState(false)
  const [editorClosing, setEditorClosing] = useState(false)
  const [prompt, setPrompt] = useState(
    typeof nodeData.prompt === 'string' ? nodeData.prompt : '',
  )
  const [selectedModelId, setSelectedModelId] = useState('')
  const [modelTouched, setModelTouched] = useState(false)
  const initialImageDefaults = resolveImageGenerationDefaults({
    nodeData,
    remembered: rememberedDefaultsRef.current,
    modelOptions: [],
  })
  const [quality, setQuality] = useState<(typeof QUALITY_OPTIONS)[number]>(
    initialImageDefaults.quality as (typeof QUALITY_OPTIONS)[number],
  )
  const [resolution, setResolution] = useState<(typeof RESOLUTION_OPTIONS)[number]>(
    initialImageDefaults.resolution as (typeof RESOLUTION_OPTIONS)[number],
  )
  const [ratio, setRatio] = useState<(typeof RATIO_OPTIONS)[number]>(
    initialImageDefaults.ratio as (typeof RATIO_OPTIONS)[number],
  )
  const [count, setCount] = useState<(typeof COUNT_OPTIONS)[number]>(
    initialImageDefaults.count as (typeof COUNT_OPTIONS)[number],
  )
  const [isGenerating, setIsGenerating] = useState(false)
  const [sendError, setSendError] = useState('')
  const [modelMenuOpen, setModelMenuOpen] = useState(false)
  const [qualityMenuOpen, setQualityMenuOpen] = useState(false)
  const [countMenuOpen, setCountMenuOpen] = useState(false)
  const [promptMenuOpen, setPromptMenuOpen] = useState(false)
  const [promptMenuStyle, setPromptMenuStyle] = useState<CSSProperties>({})
  const [actionBusy, setActionBusy] = useState(false)
  const [validationStatus, setValidationStatus] = useState<
    'idle' | 'checking' | 'success' | 'error'
  >('idle')
  const [upscaleResolution, setUpscaleResolution] = useState<'2k' | '4k' | '8k'>('2k')
  const [fullSizeOpen, setFullSizeOpen] = useState(false)
  const [fullSizeScale, setFullSizeScale] = useState(1)
  const [fullSizeRotation, setFullSizeRotation] = useState(0)
  const [fullSizeOffset, setFullSizeOffset] = useState({ x: 0, y: 0 })
  const [fullSizePanning, setFullSizePanning] = useState(false)
  const fullSizePanAnchorRef = useRef<{
    pointer: { x: number; y: number }
    offset: { x: number; y: number }
  } | null>(null)
  const [fullSizeReloadVersion, setFullSizeReloadVersion] = useState(0)
  const [menuDirections, setMenuDirections] = useState<
    Record<ImageEditorMenuKind, FloatingMenuDirection>
  >({
    model: 'down',
    quality: 'down',
    count: 'down',
    prompt: 'down',
  })
  const generationRuns = useMemo(
    () => getImageGenerationHistoryItems(nodeData.generationRuns),
    [nodeData.generationRuns],
  )
  const referenceAssetIds = useMemo(() => {
    const references = new Set<string>()
    for (const assetId of nodeData.inputImageAssetIds ?? []) {
      if (assetId) references.add(assetId)
    }
    for (const assetId of getImageGenerationInputImages({
      assetId: undefined,
      modelId: selectedModelId,
      nodeId: id,
      nodes,
      edges,
    })) {
      references.add(assetId)
    }
    return Array.from(references)
  }, [
    edges,
    id,
    nodeData.inputImageAssetIds,
    nodes,
    selectedModelId,
  ])
  const handleRemoveReferenceAsset = useCallback(
    (assetId: string) => {
      removeIncomingImageReference(id, assetId)
      void useFlowStore.getState().saveCurrent().catch(() => undefined)
    },
    [id, removeIncomingImageReference],
  )
  const historyPreviewStyle = useMemo(
    () =>
      ({
        '--history-preview-scale': String(
          getImageGenerationHistoryPreviewScale(),
        ),
      }) as CSSProperties,
    [],
  )

  // assetId 变化时重置加载错误状态，便于重新尝试加载新图片
  useEffect(() => {
    setImgError(false)
  }, [nodeData.assetId, nodeData.localPreviewUrl])

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => clearCloseTimer()
  }, [clearCloseTimer])

  const imageSrc = nodeData.assetId
    ? getAssetFileUrl(nodeData.assetId)
    : nodeData.localPreviewUrl
  const hasImage = !!imageSrc && !imgError
  const generationProgress = getImageGenerationProgressState(
    nodeData.status,
    isGenerating,
  )
  const showPlaceholderIcon = shouldShowImagePlaceholderIcon(
    generationProgress.visible,
    imgError,
  )
  const modelOptions = useMemo(() => {
    return getConfiguredImageModels(
      settings?.imageModels,
      settings?.llmModels,
      settings?.modelConfigs,
    )
  }, [settings?.imageModels, settings?.llmModels, settings?.modelConfigs])
  const modelMenuStyle = useMemo(
    () =>
      ({
        '--image-model-menu-width': `${getImageModelMenuWidth(modelOptions)}px`,
      }) as CSSProperties,
    [modelOptions],
  )
  const getMenuEstimatedHeight = useCallback(
    (kind: ImageEditorMenuKind) => {
      if (kind === 'model') {
        return Math.min(
          MODEL_MENU_MAX_HEIGHT,
          MODEL_MENU_VERTICAL_PADDING + modelOptions.length * MODEL_MENU_ROW_HEIGHT,
        )
      }
      if (kind === 'count') {
        return COUNT_MENU_VERTICAL_PADDING + COUNT_OPTIONS.length * COUNT_MENU_ITEM_HEIGHT
      }
      if (kind === 'prompt') {
        return PROMPT_LIBRARY_ESTIMATED_HEIGHT
      }
      return QUALITY_MENU_ESTIMATED_HEIGHT
    },
    [modelOptions.length],
  )
  const getMenuButton = useCallback((kind: ImageEditorMenuKind) => {
    if (kind === 'model') return modelMenuButtonRef.current
    if (kind === 'quality') return qualityMenuButtonRef.current
    if (kind === 'prompt') return promptMenuButtonRef.current
    return countMenuButtonRef.current
  }, [])
  const updateMenuDirection = useCallback(
    (kind: ImageEditorMenuKind) => {
      const button = getMenuButton(kind)
      if (!button) return
      const rect = button.getBoundingClientRect()
      const direction = chooseFloatingMenuDirection({
        triggerTop: rect.top,
        triggerBottom: rect.bottom,
        viewportHeight: window.innerHeight,
        menuHeight: getMenuEstimatedHeight(kind),
        gap: IMAGE_MENU_GAP,
      })
      setMenuDirections((current) =>
        current[kind] === direction ? current : { ...current, [kind]: direction },
      )
    },
    [getMenuButton, getMenuEstimatedHeight],
  )
  const updatePromptMenuPlacement = useCallback(() => {
    const button = promptMenuButtonRef.current
    if (!button) return
    const rect = button.getBoundingClientRect()
      const direction = chooseFloatingMenuDirection({
        triggerTop: rect.top,
        triggerBottom: rect.bottom,
        viewportHeight: window.innerHeight,
        menuHeight: PROMPT_LIBRARY_ESTIMATED_HEIGHT,
        gap: IMAGE_MENU_GAP,
      })
    const left = Math.min(
      Math.max(8, rect.left),
      Math.max(8, window.innerWidth - PROMPT_LIBRARY_WIDTH - 8),
    )
    const top =
      direction === 'up'
        ? Math.max(8, rect.top - PROMPT_LIBRARY_ESTIMATED_HEIGHT - IMAGE_MENU_GAP)
        : Math.min(
            window.innerHeight - PROMPT_LIBRARY_ESTIMATED_HEIGHT - 8,
            rect.bottom + IMAGE_MENU_GAP,
          )
    setPromptMenuStyle({
      position: 'fixed',
      left,
      top,
      width: PROMPT_LIBRARY_WIDTH,
    })
    setMenuDirections((current) =>
      current.prompt === direction ? current : { ...current, prompt: direction },
    )
  }, [])
  const updateOpenMenuDirections = useCallback(() => {
    if (modelMenuOpen) updateMenuDirection('model')
    if (qualityMenuOpen) updateMenuDirection('quality')
    if (countMenuOpen) updateMenuDirection('count')
    if (promptMenuOpen) updatePromptMenuPlacement()
  }, [
    countMenuOpen,
    modelMenuOpen,
    promptMenuOpen,
    qualityMenuOpen,
    updateMenuDirection,
    updatePromptMenuPlacement,
  ])
  const selectedModel =
    modelOptions.find((model) => model.id === selectedModelId) ??
    modelOptions[0]
  const selectedSize = getSizeFromRatio(ratio, resolution)
  const savedSize =
    typeof nodeData.width === 'number' && typeof nodeData.height === 'number'
      ? { width: nodeData.width, height: nodeData.height }
      : null
  const frameSize = editorMounted || !savedSize ? selectedSize : savedSize
  const frameStyle = getDisplayFrameStyle(frameSize)
  const mediaDisplayStyle = {
    ...MEDIA_DISPLAY_STYLE,
    ...frameStyle,
  }
  const emptyContainerStyle = {
    ...CONTAINER_STYLE,
    ...frameStyle,
    minHeight: frameStyle.height,
  }

  useEffect(() => {
    const defaults = resolveImageGenerationDefaults({
      nodeData,
      remembered: rememberedDefaultsRef.current,
      modelOptions,
    })

    setSelectedModelId((current) => {
      if (modelTouched && current && modelOptions.some((model) => model.id === current)) {
        return current
      }
      return defaults.modelId
    })
  }, [modelOptions, modelTouched, nodeData])

  const handleCloseEditor = useCallback(() => {
    if (!editorMounted || editorClosing) return
    setModelMenuOpen(false)
    setQualityMenuOpen(false)
    setCountMenuOpen(false)
    setPromptMenuOpen(false)
    setFullSizeOpen(false)
    setEditorClosing(true)
    clearCloseTimer()
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null
      setEditorMounted(false)
      setEditorClosing(false)
    }, EDITOR_CLOSE_ANIMATION_MS)
  }, [clearCloseTimer, editorClosing, editorMounted])

  const handleCloseEditorMenus = useCallback(() => {
    setModelMenuOpen(false)
    setQualityMenuOpen(false)
    setCountMenuOpen(false)
    setPromptMenuOpen(false)
  }, [])

  const handleOpenEditor = useCallback(() => {
    clearCloseTimer()
    setEditorMounted(true)
    setEditorClosing(false)
  }, [clearCloseTimer])

  const persistPromptDraft = useCallback(
    (value: string) => {
      setPrompt(value)
      if (sendError) setSendError('')
      updateNodeData(id, {
        prompt: value,
        updatedAt: new Date().toISOString(),
      } as unknown as Partial<BaseNodeData>)
      void useFlowStore.getState().saveCurrent().catch(() => undefined)
    },
    [id, sendError, updateNodeData],
  )

  const persistSelectedImageModel = useCallback(
    (modelId: string) => {
      const nextDefaults = {
        ...(rememberedDefaultsRef.current ?? {}),
        model: modelId,
        quality,
        ratio,
        resolution,
        count,
      }
      rememberedDefaultsRef.current = nextDefaults
      useGenerationDefaultsStore.getState().rememberImageDefaults(nextDefaults)
      updateNodeData(id, {
        model: modelId,
        updatedAt: new Date().toISOString(),
      } as unknown as Partial<BaseNodeData>)
      void useFlowStore.getState().saveCurrent().catch(() => undefined)
    },
    [count, id, quality, ratio, resolution, updateNodeData],
  )

  const handleValidateImageProvider = useCallback(async () => {
    setActionBusy(true)
    setValidationStatus('checking')
    try {
      if (shouldRequireJimengCliForImageModel(selectedModel.id)) {
        const result = await testJimengConnection(settings ?? {})
        setValidationStatus(result.ok ? 'success' : 'error')
        return
      }

      if (isCodexImageModel(selectedModel.id)) {
        const result = await getCodexStatus()
        setValidationStatus(result.available ? 'success' : 'error')
        return
      }

      setValidationStatus('success')
    } catch {
      setValidationStatus('error')
    } finally {
      setActionBusy(false)
    }
  }, [selectedModel.id, settings])

  const handleDownloadImage = useCallback(async () => {
    if (!nodeData.assetId) {
      return
    }
    setActionBusy(true)
    try {
      downloadAssetFile(nodeData.assetId)
    } catch {
      // 下载失败时保留当前界面，不再显示额外状态文字。
    } finally {
      setActionBusy(false)
    }
  }, [nodeData.assetId])

  const handleUpscaleImage = useCallback(async (resolution = upscaleResolution) => {
    if (!nodeData.assetId) {
      return
    }
    setActionBusy(true)
    let targetNodeId = ''
    try {
      targetNodeId = useCanvasStore
        .getState()
        .createUpscaleImageNode(id, resolution)
      if (!targetNodeId) {
        return
      }
      void useFlowStore.getState().saveCurrent().catch(() => undefined)
      const asset = await upscaleImageAsset(nodeData.assetId, resolution)
      useCanvasStore.getState().updateNodeData(targetNodeId, {
        assetId: asset.id,
        status: 'success',
        error: undefined,
        updatedAt: new Date().toISOString(),
      } as unknown as Partial<BaseNodeData>)
      try {
        await useFlowStore.getState().saveCurrent()
      } catch {
        // 保存失败不打断高清结果展示；用户后续操作仍可继续。
      }
    } catch (error) {
      if (targetNodeId) {
        useCanvasStore.getState().updateNodeData(targetNodeId, {
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
          updatedAt: new Date().toISOString(),
        } as unknown as Partial<BaseNodeData>)
        void useFlowStore.getState().saveCurrent().catch(() => undefined)
      }
    } finally {
      setActionBusy(false)
    }
  }, [id, nodeData.assetId, upscaleResolution])

  const handleOpenFullSize = useCallback(() => {
    if (!hasImage || !imageSrc) {
      return
    }
    setFullSizeScale(1)
    setFullSizeRotation(0)
    setFullSizeOffset({ x: 0, y: 0 })
    setFullSizePanning(false)
    fullSizePanAnchorRef.current = null
    setFullSizeOpen(true)
  }, [hasImage, imageSrc])

  const handleFullSizeScaleChange = useCallback((scale: number) => {
    setFullSizeScale(clampPreviewScale(scale))
  }, [])

  const handleFullSizeWheelZoom = useCallback((deltaY: number) => {
    setFullSizeScale((scale) => {
      const nextScale = deltaY < 0 ? scale * 1.08 : scale / 1.08
      return clampPreviewScale(nextScale)
    })
  }, [])

  const handleFullSizeReset = useCallback(() => {
    setFullSizeScale(1)
    setFullSizeRotation(0)
    setFullSizeOffset({ x: 0, y: 0 })
    setFullSizeReloadVersion((version) => version + 1)
  }, [])

  const handleFullSizeRename = useCallback((title: string) => {
    useCanvasStore.getState().updateNodeData(id, {
      title: title || '未命名图片',
      updatedAt: new Date().toISOString(),
    } as unknown as Partial<BaseNodeData>)
  }, [id])

  const handleFullSizePanStart = useCallback((point: { x: number; y: number }) => {
    setFullSizePanning(true)
    fullSizePanAnchorRef.current = {
      pointer: point,
      offset: fullSizeOffset,
    }
  }, [fullSizeOffset])

  const handleFullSizePanMove = useCallback((point: { x: number; y: number }) => {
    const anchor = fullSizePanAnchorRef.current
    if (!anchor) return
    setFullSizeOffset({
      x: anchor.offset.x + point.x - anchor.pointer.x,
      y: anchor.offset.y + point.y - anchor.pointer.y,
    })
  }, [])

  const handleFullSizePanEnd = useCallback(() => {
    setFullSizePanning(false)
    fullSizePanAnchorRef.current = null
  }, [])

  const fullSizeImageInfo = useMemo(() => {
    const resolution =
      nodeData.width && nodeData.height
        ? `${Math.round(nodeData.width)} x ${Math.round(nodeData.height)}`
        : '未知'
    return `分辨率 ${resolution} · 文件大小未知`
  }, [nodeData.height, nodeData.width])

  const fullSizeImageSrc = useMemo(() => {
    if (!imageSrc) return ''
    if (!fullSizeReloadVersion) return imageSrc
    const joiner = imageSrc.includes('?') ? '&' : '?'
    return `${imageSrc}${joiner}viewerReload=${fullSizeReloadVersion}`
  }, [fullSizeReloadVersion, imageSrc])

  useEffect(() => {
    if (!editorMounted) return

    const handleDocumentPointerDown = (event: globalThis.PointerEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      const isInsideEditorOwner =
        !!target.closest(`[data-flow-node-id="${id}"]`) ||
        !!target.closest('.image-editor-panel') ||
        !!target.closest('.prompt-template-library') ||
        !!target.closest('.image-fullscreen-viewer') ||
        !!target.closest('.prompt-editor-modal')
      const isInsideMenuRoot =
        !!target.closest('.image-editor-menu-anchor') ||
        !!target.closest('.prompt-template-library')
      if (
        shouldCloseFloatingMenuOnPointerDown({
          button: event.button,
          isMenuOpen:
            modelMenuOpen || qualityMenuOpen || countMenuOpen || promptMenuOpen,
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
      handleCloseEditor()
    }

    const handleDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleCloseEditor()
    }

    document.addEventListener('pointerdown', handleDocumentPointerDown, true)
    window.addEventListener('keydown', handleDocumentKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handleDocumentPointerDown, true)
      window.removeEventListener('keydown', handleDocumentKeyDown)
    }
  }, [
    countMenuOpen,
    editorMounted,
    handleCloseEditor,
    handleCloseEditorMenus,
    id,
    modelMenuOpen,
    promptMenuOpen,
    qualityMenuOpen,
  ])

  const handleModelToggle = () => {
    if (!modelMenuOpen) updateMenuDirection('model')
    setModelMenuOpen((open) => !open)
    setQualityMenuOpen(false)
    setCountMenuOpen(false)
    setPromptMenuOpen(false)
  }

  const handleQualityToggle = () => {
    if (!qualityMenuOpen) updateMenuDirection('quality')
    setQualityMenuOpen((open) => !open)
    setModelMenuOpen(false)
    setCountMenuOpen(false)
    setPromptMenuOpen(false)
  }

  const handleCountToggle = () => {
    if (!countMenuOpen) updateMenuDirection('count')
    setCountMenuOpen((open) => !open)
    setModelMenuOpen(false)
    setQualityMenuOpen(false)
    setPromptMenuOpen(false)
  }

  const handlePromptMenuToggle = () => {
    if (!promptMenuOpen) updatePromptMenuPlacement()
    setPromptMenuOpen((open) => !open)
    setModelMenuOpen(false)
    setQualityMenuOpen(false)
    setCountMenuOpen(false)
  }

  const handlePromptMenuPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    handlePromptMenuToggle()
  }

  const handleApplyPromptTemplate = useCallback(
    (templatePrompt: string) => {
      persistPromptDraft(templatePrompt)
      setPromptMenuOpen(false)
    },
    [persistPromptDraft],
  )

  useEffect(() => {
    if (!modelMenuOpen && !qualityMenuOpen && !countMenuOpen && !promptMenuOpen) return

    updateOpenMenuDirections()
    window.addEventListener('resize', updateOpenMenuDirections)
    window.addEventListener('scroll', updateOpenMenuDirections, true)
    return () => {
      window.removeEventListener('resize', updateOpenMenuDirections)
      window.removeEventListener('scroll', updateOpenMenuDirections, true)
    }
  }, [
    countMenuOpen,
    modelMenuOpen,
    promptMenuOpen,
    qualityMenuOpen,
    updateOpenMenuDirections,
  ])

  const handleSend = async (options: ImageGenerationSubmitOptions = {}) => {
    if (isGenerating) return
    const effectivePrompt = options.prompt ?? prompt
    const trimmedPrompt = effectivePrompt.trim()
    const effectiveModel =
      modelOptions.find((model) => model.id === options.modelId) ??
      selectedModel
    const effectiveQuality = options.quality ?? quality
    const effectiveRatio = options.ratio ?? ratio
    const effectiveResolution = options.resolution ?? resolution
    const effectiveCount = options.count ?? count
    if (!trimmedPrompt) {
      setSendError('请输入提示词')
      return
    }
    if (isJimengImageModel(effectiveModel.id) && !isJimengConfigured) {
      setSendError('未配置 dreamina CLI，请先在设置中配置')
      return
    }

    let startedFlowId = ''
    try {
      startedFlowId = await useFlowStore.getState().ensureCurrentFlow()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setSendError(`工作流准备失败：${message}`)
      return
    }
    setIsGenerating(true)
    const store = useCanvasStore.getState()
    const size = getSizeFromRatio(effectiveRatio, effectiveResolution)
    const inputImageAssetIds =
      options.inputImageAssetIds ??
      getImageGenerationInputImages({
        assetId: nodeData.assetId,
        modelId: effectiveModel.id,
        nodeId: id,
        nodes,
        edges,
      })
    const request: GenerationRequest = {
      flowId: startedFlowId ?? 'local',
      nodeId: id,
      mediaType: 'image',
      prompt: trimmedPrompt,
      inputImages: inputImageAssetIds,
      model: effectiveModel.id,
      width: size.width,
      height: size.height,
      count: effectiveCount,
      seed: null,
    }
    const generateStore = useGenerateStore.getState()

    setPrompt(trimmedPrompt)
    setModelTouched(true)
    setSelectedModelId(effectiveModel.id)
    setQuality(effectiveQuality)
    setRatio(effectiveRatio)
    setResolution(effectiveResolution)
    setCount(effectiveCount)
    generateStore.setLastRequest(id, request)
    generateStore.setStatus(id, 'queued')
    generateStore.setError(id, undefined)
    store.updateNodeData(id, {
      prompt: trimmedPrompt,
      model: effectiveModel.id,
      width: size.width,
      height: size.height,
      count: effectiveCount,
      seed: null,
      inputImageAssetIds,
      quality: effectiveQuality,
      ratio: effectiveRatio,
      resolution: effectiveResolution,
      status: 'running',
      error: undefined,
      updatedAt: new Date().toISOString(),
    } as unknown as Partial<BaseNodeData>)

    if (startedFlowId) {
      try {
        await useFlowStore.getState().saveCurrent()
      } catch (saveErr) {
        const message =
          saveErr instanceof Error ? saveErr.message : String(saveErr)
        generateStore.setStatus(id, 'error')
        generateStore.setError(id, message)
        store.updateNodeData(id, {
          status: 'error',
          error: message,
          updatedAt: new Date().toISOString(),
        } as unknown as Partial<BaseNodeData>)
        setIsGenerating(false)
        setSendError(`生成前保存节点失败：${message}`)
        return
      }
    }

    setSendError('')

    const applyFinal = async (resp: GenerationResponse) => {
      const results = resp.results ?? []
      const outputAssetIds = results
        .map((result) => result.assetId)
        .filter((assetId): assetId is string => !!assetId)
      const generationRun = buildImageGenerationRunFromResponse(resp, request, {
        quality: effectiveQuality,
        ratio: effectiveRatio,
        resolution: effectiveResolution,
      })
      const failedMessage =
        resp.status === 'error'
          ? resp.error || '生图失败，请稍后重试'
          : outputAssetIds.length === 0
            ? resp.error || '生图完成，但没有返回可上图的图片'
            : ''
      const nextStatus = failedMessage ? 'error' : resp.status
      const reloadStartedFlow = async (fallbackMessage: string) => {
        if (!startedFlowId || resp.status === 'error') {
          setSendError(fallbackMessage)
          return
        }
        try {
          await useFlowStore.getState().loadFlow(startedFlowId)
          setImgError(false)
          handleCloseEditor()
        } catch (reloadErr) {
          const message =
            reloadErr instanceof Error
              ? reloadErr.message
              : String(reloadErr)
          setSendError(`图片已生成并保存，但重新加载画布失败：${message}`)
        }
      }

      generateStore.setStatus(id, nextStatus)
      if (failedMessage || resp.error) {
        generateStore.setError(id, failedMessage || resp.error)
      }
      const latestStore = useCanvasStore.getState()
      const nodeExists = latestStore.nodes.some((node) => node.id === id)
      if (!nodeExists) {
        await reloadStartedFlow(
          failedMessage || '生成结束，但当前画布状态需要刷新后显示',
        )
        return
      }
      const latestNode = latestStore.nodes.find((node) => node.id === id)
      const latestNodeData = latestNode?.data as ImageNodeData | undefined
      store.updateNodeData(id, {
        status: nextStatus,
        error: failedMessage || resp.error,
        outputAssetIds,
        assetId: outputAssetIds[0] ?? nodeData.assetId,
        generationId: resp.id,
        prompt: trimmedPrompt,
        model: effectiveModel.id,
        width: size.width,
        height: size.height,
        count: effectiveCount,
        quality: effectiveQuality,
        ratio: effectiveRatio,
        resolution: effectiveResolution,
        inputImageAssetIds,
        generationRuns: appendImageGenerationRun(
          latestNodeData?.generationRuns ?? nodeData.generationRuns,
          generationRun,
        ),
        updatedAt: new Date().toISOString(),
      } as unknown as Partial<BaseNodeData>)

      if (failedMessage) {
        await reloadStartedFlow(failedMessage)
        return
      }

      if (outputAssetIds.length > 0) {
        useGenerationDefaultsStore.getState().rememberImageDefaults({
          model: effectiveModel.id,
          quality: effectiveQuality,
          ratio: effectiveRatio,
          resolution: effectiveResolution,
          count: effectiveCount,
        })
        setImgError(false)
        try {
          const flowStore = useFlowStore.getState()
          if (flowStore.currentFlowId === startedFlowId) {
            await flowStore.saveCurrent()
          }
        } catch (saveErr) {
          const message =
            saveErr instanceof Error
              ? saveErr.message
              : String(saveErr)
          console.warn('[ImageNode] save generated image to flow failed', saveErr)
          setSendError(`图片已生成，但保存到画布失败：${message}`)
          return
        }
        handleCloseEditor()
      }
    }

    const handleGenerationError = (message: string) => {
      generateStore.setStatus(id, 'error')
      generateStore.setError(id, message)
      store.updateNodeData(id, {
        status: 'error',
        error: message,
        updatedAt: new Date().toISOString(),
      } as unknown as Partial<BaseNodeData>)
      setIsGenerating(false)
      setSendError(message)
    }

    const flow = startImageGenerationFlow(request, {
      onQueued: () => {
        setSendError('')
      },
      onUpdate: (data) => {
        if (data.status !== 'success' && data.status !== 'error') {
          store.updateNodeData(id, {
            status: data.status,
            error: data.error,
            updatedAt: new Date().toISOString(),
          } as unknown as Partial<BaseNodeData>)
          generateStore.setStatus(id, data.status)
          if (data.error) generateStore.setError(id, data.error)
        }
      },
      onComplete: async (data) => {
        try {
          await applyFinal(data)
        } catch (applyErr) {
          handleGenerationError(
            applyErr instanceof Error ? applyErr.message : String(applyErr),
          )
          return
        }
        setIsGenerating(false)
      },
      onError: (error) => {
        handleGenerationError(error)
      },
    })
    generationUnsubscribeRef.current = flow.cancel
  }

  const applyEditorStateFromRun = (run: ImageGenerationRun) => {
    const state = getEditorStateFromImageGenerationRun(run)
    setPrompt(state.prompt)
    setModelTouched(true)
    setSelectedModelId(state.modelId)
    if (QUALITY_OPTIONS.includes(state.quality as (typeof QUALITY_OPTIONS)[number])) {
      setQuality(state.quality as (typeof QUALITY_OPTIONS)[number])
    }
    if (RATIO_OPTIONS.includes(state.ratio as (typeof RATIO_OPTIONS)[number])) {
      setRatio(state.ratio as (typeof RATIO_OPTIONS)[number])
    }
    if (
      RESOLUTION_OPTIONS.includes(
        state.resolution as (typeof RESOLUTION_OPTIONS)[number],
      )
    ) {
      setResolution(state.resolution as (typeof RESOLUTION_OPTIONS)[number])
    }
    if (COUNT_OPTIONS.includes(state.count as (typeof COUNT_OPTIONS)[number])) {
      setCount(state.count as (typeof COUNT_OPTIONS)[number])
    }
    setModelMenuOpen(false)
    setQualityMenuOpen(false)
    setCountMenuOpen(false)
    setSendError('')
    return state
  }

  const handleRestoreRun = async (run: ImageGenerationRun) => {
    const state = applyEditorStateFromRun(run)
    if (!state.assetId) {
      setSendError('这个历史版本没有可恢复的图片')
      return
    }

    useCanvasStore.getState().updateNodeData(id, {
      status: run.status === 'error' ? 'error' : 'success',
      error: run.error,
      assetId: state.assetId,
      outputAssetIds: state.outputAssetIds,
      generationId: run.generationId,
      prompt: state.prompt,
      model: state.modelId,
      width: state.width,
      height: state.height,
      count: state.count,
      quality: state.quality,
      ratio: state.ratio,
      resolution: state.resolution,
      inputImageAssetIds: state.inputImageAssetIds,
      updatedAt: new Date().toISOString(),
    } as unknown as Partial<BaseNodeData>)
    setImgError(false)

    try {
      await useFlowStore.getState().saveCurrent()
    } catch (saveErr) {
      const message = saveErr instanceof Error ? saveErr.message : String(saveErr)
      setSendError(`历史版本已恢复，但保存到画布失败：${message}`)
    }
  }

  const generationProgressOverlay = generationProgress.visible ? (
    <div className="image-generation-progress-overlay" aria-live="polite">
      <div className="image-generation-progress-content">
        <div className="image-generation-progress-label">
          <span className="image-generation-progress-dot" />
          <span>{generationProgress.label}</span>
        </div>
        <div
          className="image-generation-progress-track"
          role="progressbar"
          aria-label={generationProgress.label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuetext={generationProgress.valueText}
        >
          <span className="image-generation-progress-fill" />
        </div>
      </div>
    </div>
  ) : null

  return (
    <NodeWrapper
      icon={ImageIcon}
      title={nodeData.title}
      status={nodeData.status}
      selected={selected}
      nodeId={id}
      nodeType="image"
      mediaDisplay={hasImage}
      hideTitle={!hasImage}
    >
      <>
        {editorMounted && (
          <ImageActionCard
            busy={actionBusy}
            closing={editorClosing}
            validationStatus={validationStatus}
            validationLabel={
              isCodexImageModel(selectedModel.id) ? '校验 OpenAI' : '校验'
            }
            validationAriaLabel={
              isCodexImageModel(selectedModel.id)
                ? '校验 OpenAI CLI'
                : shouldRequireJimengCliForImageModel(selectedModel.id)
                  ? '校验即梦 CLI'
                  : '校验当前图片模型'
            }
            upscaleResolution={upscaleResolution}
            onUpscale={(resolution) => void handleUpscaleImage(resolution)}
            onUpscaleResolutionChange={setUpscaleResolution}
            onValidate={() => void handleValidateImageProvider()}
            onDownload={handleDownloadImage}
            onOpenFullSize={handleOpenFullSize}
          />
        )}

        {hasImage && imageSrc ? (
          <div
            className="media-display-node image-media-display"
            onClick={handleOpenEditor}
            style={mediaDisplayStyle}
          >
            <img
              src={imageSrc}
              alt={nodeData.title}
              onError={() => setImgError(true)}
              style={MEDIA_IMG_STYLE}
              draggable={false}
            />
            {generationProgressOverlay}
          </div>
        ) : (
          <div
            className="image-node-container"
            onClick={handleOpenEditor}
            style={emptyContainerStyle}
          >
            <div className="node-preview-area image-node-preview" style={PREVIEW_STYLE}>
              <div className="image-node-placeholder" style={PLACEHOLDER_STYLE}>
                {showPlaceholderIcon ? (
                  <ImageIcon
                    size={54}
                    strokeWidth={1.8}
                    className="node-placeholder-icon"
                  />
                ) : null}
                {imgError ? (
                  <span className="node-placeholder">图片加载失败</span>
                ) : null}
              </div>
            </div>
            {generationProgressOverlay}
          </div>
        )}

        {fullSizeOpen && hasImage && imageSrc && typeof document !== 'undefined'
          ? createPortal(
              <ImageFullscreenViewer
                imageSrc={fullSizeImageSrc}
                title={nodeData.title}
                imageInfo={fullSizeImageInfo}
                scale={fullSizeScale}
                rotation={fullSizeRotation}
                offset={fullSizeOffset}
                isPanning={fullSizePanning}
                onClose={() => setFullSizeOpen(false)}
                onDownload={() => void handleDownloadImage()}
                onRename={handleFullSizeRename}
                onReset={handleFullSizeReset}
                onRotateClockwise={() => {
                  setFullSizeRotation((rotation) => rotation + 90)
                }}
                onRotateCounterClockwise={() => {
                  setFullSizeRotation((rotation) => rotation - 90)
                }}
                onPanStart={handleFullSizePanStart}
                onPanMove={handleFullSizePanMove}
                onPanEnd={handleFullSizePanEnd}
                onScaleChange={handleFullSizeScaleChange}
                onZoomIn={() => {
                  setFullSizeScale((scale) => clampPreviewScale(scale + 0.1))
                }}
                onZoomOut={() => {
                  setFullSizeScale((scale) => clampPreviewScale(scale - 0.1))
                }}
                onWheelZoom={handleFullSizeWheelZoom}
              />,
              document.body,
            )
          : null}

        {editorMounted && (
          <div
            className={`image-editor-panel nodrag nopan${
              editorClosing ? ' closing' : ''
            }`}
            onClick={(event) => event.stopPropagation()}
          >
            <ReferenceAssetStrip
              assetIds={referenceAssetIds}
              onRemove={handleRemoveReferenceAsset}
            />

            <PromptEditor
              value={prompt}
              onChange={persistPromptDraft}
              placeholder="可直接文字生图，或上传图片输入文字指令对图片进行编辑，如：将背景改为雪夜"
            />

            <div className="image-editor-bottom">
              <div
                className={`image-editor-menu-anchor ${
                  menuDirections.model === 'up' ? 'drop-up' : 'drop-down'
                }`}
              >
                <button
                  ref={modelMenuButtonRef}
                  type="button"
                  className="image-editor-model-button"
                  onClick={handleModelToggle}
                >
                  <Sparkles size={19} strokeWidth={1.8} />
                  <span>{selectedModel.label}</span>
                  <ChevronDown size={16} strokeWidth={1.8} />
                </button>
                {modelMenuOpen && (
                  <div className="image-model-menu" style={modelMenuStyle}>
                    {modelOptions.map((model) => (
                      <button
                        type="button"
                        key={model.id}
                        className={`image-model-option${
                          model.id === selectedModel.id ? ' selected' : ''
                        }`}
                        onClick={() => {
                          setModelTouched(true)
                          setSelectedModelId(model.id)
                          persistSelectedImageModel(model.id)
                          setModelMenuOpen(false)
                        }}
                      >
                        <span className="image-model-icon">
                          <Sparkles size={17} strokeWidth={1.8} />
                        </span>
                        <span className="image-model-copy">
                          <strong>{model.label}</strong>
                        </span>
                        {model.id === selectedModel.id ? (
                          <Check size={15} strokeWidth={1.8} />
                        ) : null}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div
                className={`image-editor-menu-anchor ${
                  menuDirections.quality === 'up' ? 'drop-up' : 'drop-down'
                }`}
              >
                <button
                  ref={qualityMenuButtonRef}
                  type="button"
                  className="image-editor-pill"
                  onClick={handleQualityToggle}
                >
                  <span>{`${ratio} · ${quality} · ${resolution}`}</span>
                  <ChevronDown size={15} strokeWidth={1.8} />
                </button>
                {qualityMenuOpen && (
                  <div className="image-quality-menu">
                    <div className="image-quality-section">
                      <span>画质</span>
                      <div className="image-quality-row">
                        {QUALITY_OPTIONS.map((item) => (
                          <button
                            type="button"
                            key={item}
                            className={item === quality ? 'selected' : ''}
                            onClick={() => setQuality(item)}
                          >
                            {item}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="image-quality-section">
                      <span>清晰度</span>
                      <div className="image-quality-row">
                        {RESOLUTION_OPTIONS.map((item) => (
                          <button
                            type="button"
                            key={item}
                            className={item === resolution ? 'selected' : ''}
                            onClick={() => setResolution(item)}
                          >
                            {item}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="image-quality-section">
                      <span>比例</span>
                      <div className="image-ratio-grid">
                        {RATIO_OPTIONS.map((item) => (
                          <button
                            type="button"
                            key={item}
                            className={item === ratio ? 'selected' : ''}
                            onClick={() => setRatio(item)}
                          >
                            <span className="image-ratio-icon" />
                            <span>{item}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div
                className={`image-editor-menu-anchor image-editor-menu-anchor-end ${
                  menuDirections.count === 'up' ? 'drop-up' : 'drop-down'
                }`}
              >
                <button
                  ref={countMenuButtonRef}
                  type="button"
                  className="image-editor-pill image-editor-count-button"
                  onClick={handleCountToggle}
                >
                  <span>{count}张</span>
                  <ChevronDown size={15} strokeWidth={1.8} />
                </button>
                {countMenuOpen && (
                  <div className="image-count-menu">
                    {COUNT_OPTIONS.map((item) => (
                      <button
                        type="button"
                        key={item}
                        className={item === count ? 'selected' : ''}
                        onClick={() => {
                          setCount(item)
                          setCountMenuOpen(false)
                        }}
                      >
                        {item}张
                        {item === count ? <Check size={15} strokeWidth={1.8} /> : null}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div
                className={`image-editor-menu-anchor ${
                  menuDirections.prompt === 'up' ? 'drop-up' : 'drop-down'
                }`}
              >
                <button
                  ref={promptMenuButtonRef}
                  type="button"
                  className={`image-editor-pill image-editor-prompt-action-button${
                    promptMenuOpen ? ' active' : ''
                  }`}
                  onPointerDown={handlePromptMenuPointerDown}
                  title="提示词操作"
                  aria-label="提示词操作"
                  aria-expanded={promptMenuOpen}
                >
                  <PromptLibraryIcon />
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
                disabled={isGenerating}
                title={isGenerating ? '正在生成' : '发送生成'}
              >
                <ArrowUp size={20} strokeWidth={2} />
              </button>
            </div>

            {sendError ? (
              <div className="image-editor-status error">{sendError}</div>
            ) : null}
            {generationRuns.length > 0 && (
              <div className="image-generation-history">
                <div className="image-generation-history-head">
                  <History size={15} strokeWidth={1.8} />
                  <span>历史版本</span>
                </div>
                <div className="image-generation-history-list">
                  {generationRuns.map(({ run, assetId }) => {
                    const isCurrent = assetId && assetId === nodeData.assetId
                    return (
                      <button
                        type="button"
                        className={`image-generation-history-item${
                          isCurrent ? ' current' : ''
                        }`}
                        key={run.generationId}
                        onClick={() => void handleRestoreRun(run)}
                        style={historyPreviewStyle}
                        title="恢复这个版本"
                      >
                        <img
                          className="image-generation-history-thumb"
                          src={getAssetFileUrl(assetId)}
                          alt=""
                          draggable={false}
                        />
                        <span className="image-generation-history-preview" aria-hidden>
                          <img src={getAssetFileUrl(assetId)} alt="" draggable={false} />
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

          </div>
        )}
      </>
    </NodeWrapper>
  )
}
