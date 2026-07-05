// 即梦 Flow 前端 - Image 节点
// 参考 PRD 6.2、7.3、13.9。
//
// MVP 能力：
// - 大面积图片预览（基于 data.assetId 通过 /api/assets/<id>/file 加载）
// - 空图片或加载失败显示居中图片占位图标
// - data 字段：title, status, assetId?, assetPath?, asReference?

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { NodeProps } from '@xyflow/react'
import {
  ArrowUp,
  Box,
  Check,
  ChevronDown,
  History,
  Image as ImageIcon,
  MapPin,
  Maximize2,
  Plus,
  Sparkles,
} from 'lucide-react'
import {
  appendImageGenerationRun,
  type GenerationRequest,
  type ImageGenerationRun,
  isJimengImageModel,
} from '@jimeng-flow/shared/generateNode'
import { NodeWrapper } from './NodeWrapper'
import type { BaseNodeData } from '../types/nodeTypes'
import { getAssetFileUrl } from '../api/assets'
import { createGeneration } from '../api/generations'
import { useCanvasStore } from '../state/canvasStore'
import { useFlowStore } from '../state/flowStore'
import { useGenerateStore } from '../state/generateStore'
import { useSettingsStore } from '../state/settingsStore'
import { shouldCloseFloatingEditorOnPointerDown } from '../utils/editorPointer'
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
import {
  getConfiguredImageModels,
  getImageModelMenuWidth,
} from '../utils/imageModels'
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

type ImageEditorMenuKind = 'model' | 'quality' | 'count'

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

export function ImageNode({ id, data, selected }: NodeProps) {
  const nodeData = data as ImageNodeData
  const settings = useSettingsStore((state) => state.settings)
  const isJimengConfigured = useSettingsStore((state) => state.isJimengConfigured)
  const closeTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null)
  const modelMenuButtonRef = useRef<HTMLButtonElement | null>(null)
  const qualityMenuButtonRef = useRef<HTMLButtonElement | null>(null)
  const countMenuButtonRef = useRef<HTMLButtonElement | null>(null)
  const [imgError, setImgError] = useState(false)
  const [editorMounted, setEditorMounted] = useState(false)
  const [editorClosing, setEditorClosing] = useState(false)
  const [prompt, setPrompt] = useState(
    typeof nodeData.prompt === 'string' ? nodeData.prompt : '',
  )
  const [selectedModelId, setSelectedModelId] = useState('')
  const [modelTouched, setModelTouched] = useState(false)
  const [quality, setQuality] = useState<(typeof QUALITY_OPTIONS)[number]>('标准画质')
  const [resolution, setResolution] = useState<(typeof RESOLUTION_OPTIONS)[number]>('2K')
  const [ratio, setRatio] = useState<(typeof RATIO_OPTIONS)[number]>('16:9')
  const [count, setCount] = useState<(typeof COUNT_OPTIONS)[number]>(1)
  const [isGenerating, setIsGenerating] = useState(false)
  const [sendError, setSendError] = useState('')
  const [modelMenuOpen, setModelMenuOpen] = useState(false)
  const [qualityMenuOpen, setQualityMenuOpen] = useState(false)
  const [countMenuOpen, setCountMenuOpen] = useState(false)
  const [menuDirections, setMenuDirections] = useState<
    Record<ImageEditorMenuKind, FloatingMenuDirection>
  >({
    model: 'down',
    quality: 'down',
    count: 'down',
  })
  const generationRuns = useMemo(
    () => getImageGenerationHistoryItems(nodeData.generationRuns),
    [nodeData.generationRuns],
  )
  const historyPreviewStyle = useMemo(
    () =>
      ({
        '--image-history-preview-scale': String(
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
    return getConfiguredImageModels(settings?.imageModels, settings?.llmModels)
  }, [settings?.imageModels, settings?.llmModels])
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
      return QUALITY_MENU_ESTIMATED_HEIGHT
    },
    [modelOptions.length],
  )
  const getMenuButton = useCallback((kind: ImageEditorMenuKind) => {
    if (kind === 'model') return modelMenuButtonRef.current
    if (kind === 'quality') return qualityMenuButtonRef.current
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
  const updateOpenMenuDirections = useCallback(() => {
    if (modelMenuOpen) updateMenuDirection('model')
    if (qualityMenuOpen) updateMenuDirection('quality')
    if (countMenuOpen) updateMenuDirection('count')
  }, [countMenuOpen, modelMenuOpen, qualityMenuOpen, updateMenuDirection])
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
    const preferredModel = settings?.defaultModel?.trim()
    const fallbackModel =
      (preferredModel &&
        modelOptions.find((model) => model.id === preferredModel)?.id) ||
      modelOptions.find((model) => model.id === 'jimeng')?.id ||
      modelOptions[0]?.id ||
      ''

    setSelectedModelId((current) => {
      if (modelTouched && current && modelOptions.some((model) => model.id === current)) {
        return current
      }
      return fallbackModel
    })
  }, [modelOptions, modelTouched, settings?.defaultModel])

  const handleCloseEditor = useCallback(() => {
    if (!editorMounted || editorClosing) return
    setModelMenuOpen(false)
    setQualityMenuOpen(false)
    setCountMenuOpen(false)
    setEditorClosing(true)
    clearCloseTimer()
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null
      setEditorMounted(false)
      setEditorClosing(false)
    }, EDITOR_CLOSE_ANIMATION_MS)
  }, [clearCloseTimer, editorClosing, editorMounted])

  const handleOpenEditor = useCallback(() => {
    clearCloseTimer()
    setEditorMounted(true)
    setEditorClosing(false)
  }, [clearCloseTimer])

  useEffect(() => {
    if (!editorMounted) return

    const handleDocumentPointerDown = (event: globalThis.PointerEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      const isInsideEditorOwner = !!target.closest(`[data-flow-node-id="${id}"]`)
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
  }, [editorMounted, handleCloseEditor, id])

  const handleModelToggle = () => {
    if (!modelMenuOpen) updateMenuDirection('model')
    setModelMenuOpen((open) => !open)
    setQualityMenuOpen(false)
    setCountMenuOpen(false)
  }

  const handleQualityToggle = () => {
    if (!qualityMenuOpen) updateMenuDirection('quality')
    setQualityMenuOpen((open) => !open)
    setModelMenuOpen(false)
    setCountMenuOpen(false)
  }

  const handleCountToggle = () => {
    if (!countMenuOpen) updateMenuDirection('count')
    setCountMenuOpen((open) => !open)
    setModelMenuOpen(false)
    setQualityMenuOpen(false)
  }

  useEffect(() => {
    if (!modelMenuOpen && !qualityMenuOpen && !countMenuOpen) return

    updateOpenMenuDirections()
    window.addEventListener('resize', updateOpenMenuDirections)
    window.addEventListener('scroll', updateOpenMenuDirections, true)
    return () => {
      window.removeEventListener('resize', updateOpenMenuDirections)
      window.removeEventListener('scroll', updateOpenMenuDirections, true)
    }
  }, [countMenuOpen, modelMenuOpen, qualityMenuOpen, updateOpenMenuDirections])

  const handleSend = async (options: ImageGenerationSubmitOptions = {}) => {
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

    const startedFlowId = useFlowStore.getState().currentFlowId
    const store = useCanvasStore.getState()
    const size = getSizeFromRatio(effectiveRatio, effectiveResolution)
    const inputImageAssetIds =
      options.inputImageAssetIds ??
      (nodeData.assetId && isJimengImageModel(effectiveModel.id)
        ? [nodeData.assetId]
        : [])
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
        setSendError(`生成前保存节点失败：${message}`)
        return
      }
    }

    setIsGenerating(true)
    setSendError('')
    try {
      const response = await createGeneration(request)
      generateStore.setGenerationId(id, response.id)
      const results = response.results ?? []
      const outputAssetIds =
        results
          .map((result) => result.assetId)
          .filter((assetId): assetId is string => !!assetId)
      const generationRun = buildImageGenerationRunFromResponse(
        response,
        request,
        {
          quality: effectiveQuality,
          ratio: effectiveRatio,
          resolution: effectiveResolution,
        },
      )

      const failedMessage =
        response.status === 'error'
          ? response.error || '生图失败，请稍后重试'
          : outputAssetIds.length === 0
            ? response.error || '生图完成，但没有返回可上图的图片'
            : ''
      const nextStatus = failedMessage ? 'error' : response.status
      const reloadStartedFlow = async (fallbackMessage: string) => {
        if (!startedFlowId || response.status === 'error') {
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
      if (failedMessage || response.error) {
        generateStore.setError(id, failedMessage || response.error)
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
        error: failedMessage || response.error,
        outputAssetIds,
        assetId: outputAssetIds[0] ?? nodeData.assetId,
        generationId: response.id,
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
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      generateStore.setStatus(id, 'error')
      generateStore.setError(id, message)
      store.updateNodeData(id, {
        status: 'error',
        error: message,
        updatedAt: new Date().toISOString(),
      } as unknown as Partial<BaseNodeData>)
      setSendError(message)
    } finally {
      setIsGenerating(false)
    }
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

        {editorMounted && (
          <div
            className={`image-editor-panel nodrag nopan${
              editorClosing ? ' closing' : ''
            }`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="image-editor-tools">
              <button type="button" className="image-editor-tool">
                <Box size={20} strokeWidth={1.6} />
                <span>风格</span>
              </button>
              <button type="button" className="image-editor-tool">
                <MapPin size={20} strokeWidth={1.6} />
                <span>标记</span>
              </button>
              <button type="button" className="image-editor-tool">
                <Plus size={24} strokeWidth={1.5} />
                <span>参考</span>
              </button>
              <button type="button" className="image-editor-expand" title="展开">
                <Maximize2 size={18} strokeWidth={1.6} />
              </button>
            </div>

            <textarea
              className="image-editor-prompt"
              value={prompt}
              onChange={(event) => {
                setPrompt(event.target.value)
                if (sendError) setSendError('')
              }}
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
