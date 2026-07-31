import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { NodeProps } from '@xyflow/react'
import { Film, Video } from 'lucide-react'
import { createGeneration } from '../api/generations'
import {
  compressVideoAsset,
  downloadAssetFile,
  getAssetFileUrl,
  trimVideoAsset,
} from '../api/assets'
import { testJimengConnection } from '../api/settings'
import { VideoActionCard } from '../components/VideoActionCard'
import { VideoCompressionOverlay } from '../components/VideoCompressionOverlay'
import { VideoTrimOverlay } from '../components/VideoTrimOverlay'
import { VideoGenerationPanel } from '../components/VideoGenerationPanel'
import { NodeWrapper } from './NodeWrapper'
import { useCanvasStore } from '../state/canvasStore'
import { getCurrentFlowId, useFlowStore } from '../state/flowStore'
import { IDLE_CALL_STATE, useGenerateStore } from '../state/generateStore'
import { useSettingsStore } from '../state/settingsStore'
import { useVideoPlayerStore } from '../state/videoPlayerStore'
import type { BaseNodeData } from '../types/nodeTypes'
import {
  shouldCloseFloatingEditorOnPointerDown,
  shouldCloseFloatingMenuOnPointerDown,
} from '../utils/editorPointer'
import { resolveGenerationFlowId } from '../utils/generationFlow'
import { subscribeGenerationWithFallback } from '../utils/generationStatusSubscription'
import {
  getImageGenerationInputImages,
  getUpstreamTextReferences,
  joinUpstreamTextPrompts,
  resolveImageGenerationPrompt,
} from '../utils/imageGenerationInputs'
import { resolveVideoGenerationDefaults } from '../utils/generationDefaults'
import { captureCurrentVideoFrame } from '../utils/videoFrameCapture'
import { resumeGenerationSubscription } from '../utils/generationResume'
import { replaceGenerationSubscription } from '../utils/generationSubscription'
import { useGenerationDefaultsStore } from '../state/generationDefaultsStore'
import {
  buildVideoCompletionNodePatch,
  buildVideoRunningNodePatch,
  isInterruptedVideoGeneration,
  persistInitialVideoGenerationResponse,
  resolveVideoInputImages,
  resolveVideoModeForInputImages,
} from '../utils/videoGenerationState'
import {
  getConfiguredVideoModels,
  getUnsupportedVideoModelMessage,
  videoModelNeedsJimeng,
} from '../utils/videoModels'
import {
  buildVideoReferencesFromInputImages,
  mergeVideoDefaults,
  type VideoAspectRatio,
  type VideoGenerationRequest,
  type VideoMode,
  type VideoNodeData,
  type VideoResolution,
} from '@jimeng-flow/shared/videoNode'
import type { GenerationResponse } from '@jimeng-flow/shared/generateNode'
import type {
  VideoCompressionTargetHeight,
} from '@jimeng-flow/shared/videoCompression'
import {
  getEditorStateFromVideoGenerationHistoryItem,
  getVideoGenerationHistoryItems,
  type VideoGenerationHistoryItem,
} from '../utils/videoGenerationHistory'

const EDITOR_CLOSE_ANIMATION_MS = 260

const EMPTY_VIDEO_FRAME_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  width: 620,
  aspectRatio: '16 / 9',
  minHeight: 0,
  position: 'relative',
}

const VIDEO_DISPLAY_STYLE: CSSProperties = {
  width: 720,
  maxWidth: '72vw',
  borderRadius: 28,
  overflow: 'hidden',
  cursor: 'pointer',
}

function normalizeVideoCount(value: number): VideoNodeData['count'] {
  return value === 2 || value === 4 ? value : 1
}

export function VideoNode({ id, data, selected }: NodeProps) {
  const rawNodeData = data as Partial<VideoNodeData>
  const nodeData = mergeVideoDefaults(rawNodeData)
  const settings = useSettingsStore((state) => state.settings)
  const isJimengConfigured = useSettingsStore((state) => state.isJimengConfigured)
  const nodes = useCanvasStore((state) => state.nodes)
  const edges = useCanvasStore((state) => state.edges)
  const updateNodeData = useCanvasStore((state) => state.updateNodeData)
  const openVideoPlayer = useVideoPlayerStore((state) => state.openPlayer)
  const removeIncomingImageReference = useCanvasStore(
    (state) => state.removeIncomingImageReference,
  )
  const callState = useGenerateStore((state) => state.states[id] ?? IDLE_CALL_STATE)
  const generationRequestInFlight =
    callState.status === 'queued' || callState.status === 'running'
  const closeTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null)
  const generationUnsubscribeRef = useRef<(() => void) | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const mountedRef = useRef(true)
  const rememberedDefaultsRef = useRef(useGenerationDefaultsStore.getState().video)
  const initialVideoDefaults = resolveVideoGenerationDefaults({
    nodeData: rawNodeData,
    remembered: rememberedDefaultsRef.current,
    modelOptions: [],
  })

  const [editorMounted, setEditorMounted] = useState(false)
  const [editorClosing, setEditorClosing] = useState(false)
  const [prompt, setPrompt] = useState(nodeData.prompt)
  const [mode, setMode] = useState<VideoMode>(nodeData.mode)
  const [selectedModelId, setSelectedModelId] = useState('')
  const [modelTouched, setModelTouched] = useState(false)
  const [aspectRatio, setAspectRatio] =
    useState<VideoAspectRatio>(initialVideoDefaults.aspectRatio)
  const [resolution, setResolution] =
    useState<VideoResolution>(initialVideoDefaults.resolution)
  const [durationSeconds, setDurationSeconds] = useState(
    initialVideoDefaults.durationSeconds,
  )
  const [count, setCount] = useState<VideoNodeData['count']>(
    initialVideoDefaults.count,
  )
  const [modelMenuOpen, setModelMenuOpen] = useState(false)
  const [qualityMenuOpen, setQualityMenuOpen] = useState(false)
  const [countMenuOpen, setCountMenuOpen] = useState(false)
  const [sendError, setSendError] = useState('')
  const [actionBusy, setActionBusy] = useState(false)
  const [validationStatus, setValidationStatus] = useState<
    'idle' | 'checking' | 'success' | 'error'
  >('idle')
  const [compressionOpen, setCompressionOpen] = useState(false)
  const [compressionBusy, setCompressionBusy] = useState(false)
  const [compressionError, setCompressionError] = useState<string | null>(null)
  const [trimOpen, setTrimOpen] = useState(false)
  const [trimBusy, setTrimBusy] = useState(false)
  const [trimError, setTrimError] = useState<string | null>(null)
  const [videoDimensions, setVideoDimensions] = useState({
    width: nodeData.width ?? 0,
    height: nodeData.height ?? 0,
  })

  useEffect(() => {
    return () => {
      mountedRef.current = false
      generationUnsubscribeRef.current?.()
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const defaults = resolveVideoGenerationDefaults({
      nodeData: rawNodeData,
      remembered: rememberedDefaultsRef.current,
      modelOptions: [],
    })
    setPrompt(nodeData.prompt)
    setMode(nodeData.mode)
    setAspectRatio(defaults.aspectRatio)
    setResolution(defaults.resolution)
    setDurationSeconds(defaults.durationSeconds)
    setCount(defaults.count)
  }, [
    rawNodeData.aspectRatio,
    rawNodeData.count,
    rawNodeData.durationSeconds,
    nodeData.mode,
    nodeData.prompt,
    rawNodeData.resolution,
  ])

  const videoModelOptions = useMemo(
    () => getConfiguredVideoModels(settings?.videoModels, settings?.modelConfigs),
    [settings?.modelConfigs, settings?.videoModels],
  )
  useEffect(() => {
    const defaults = resolveVideoGenerationDefaults({
      nodeData: rawNodeData,
      remembered: rememberedDefaultsRef.current,
      modelOptions: videoModelOptions,
    })
    setSelectedModelId((current) => {
      if (
        modelTouched &&
        current &&
        videoModelOptions.some((model) => model.id === current)
      ) {
        return current
      }
      return defaults.modelId
    })
  }, [
    modelTouched,
    rawNodeData.model,
    videoModelOptions,
  ])

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [])

  const handleOpenEditor = useCallback(() => {
    clearCloseTimer()
    setEditorMounted(true)
    setEditorClosing(false)
  }, [clearCloseTimer])

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

  const handleValidateVideoProvider = useCallback(async () => {
    setActionBusy(true)
    setValidationStatus('checking')
    try {
      if (videoModelNeedsJimeng(selectedModelId)) {
        const result = await testJimengConnection(settings ?? {})
        setValidationStatus(result.ok ? 'success' : 'error')
        return
      }
      setValidationStatus('success')
    } catch {
      setValidationStatus('error')
    } finally {
      setActionBusy(false)
    }
  }, [selectedModelId, settings])

  const handleDownloadVideo = useCallback(async () => {
    const assetId = nodeData.assetIds[0]
    if (!assetId) {
      return
    }
    setActionBusy(true)
    try {
      await downloadAssetFile(assetId)
    } catch {
      // 下载失败时保留当前界面
    } finally {
      setActionBusy(false)
    }
  }, [nodeData.assetIds])

  const handleCaptureFrame = useCallback(
    async (video: HTMLVideoElement) => {
      try {
        const frame = captureCurrentVideoFrame(video)
        const capturedNodeId = useCanvasStore
          .getState()
          .createCapturedFrameNode(id, frame)
        if (!capturedNodeId) {
          throw new Error('无法在画布中创建截帧节点')
        }
        await useFlowStore.getState().saveCurrent()
        setSendError('')
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        setSendError(`截取当前帧失败：${message}`)
        throw error instanceof Error ? error : new Error(message)
      }
    },
    [id],
  )

  const handleOpenCompression = useCallback(() => {
    const video = videoRef.current
    if (video?.videoWidth && video.videoHeight) {
      setVideoDimensions({ width: video.videoWidth, height: video.videoHeight })
    }
    setCompressionError(null)
    setCompressionOpen(true)
  }, [])

  const handleOpenTrim = useCallback(() => {
    setTrimError(null)
    setTrimOpen(true)
  }, [])

  const handleTrimVideo = useCallback(
    async (startSeconds: number, durationSeconds: number) => {
      const sourceAssetId = nodeData.assetIds[0]
      if (!sourceAssetId || trimBusy) return
      setTrimBusy(true)
      setTrimError(null)
      let targetNodeId = ''
      try {
        targetNodeId = useCanvasStore
          .getState()
          .createTrimmedVideoNode(id, startSeconds, durationSeconds)
        if (!targetNodeId) throw new Error('无法创建裁切结果节点')
        useGenerateStore.getState().setStatus(targetNodeId, 'running')
        setTrimOpen(false)
        void useFlowStore.getState().saveCurrent().catch(() => undefined)

        const asset = await trimVideoAsset(
          sourceAssetId,
          startSeconds,
          durationSeconds,
        )
        useCanvasStore.getState().updateNodeData(targetNodeId, {
          assetIds: [asset.id],
          status: 'success',
          error: undefined,
          ...(videoDimensions.width > 0 && videoDimensions.height > 0
            ? {
                width: videoDimensions.width,
                height: videoDimensions.height,
              }
            : {}),
          updatedAt: new Date().toISOString(),
        } as unknown as Partial<BaseNodeData>)
        useGenerateStore.getState().setStatus(targetNodeId, 'success')
        await useFlowStore.getState().saveCurrent().catch(() => undefined)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (targetNodeId) {
          useCanvasStore.getState().updateNodeData(targetNodeId, {
            status: 'error',
            error: message,
            updatedAt: new Date().toISOString(),
          } as unknown as Partial<BaseNodeData>)
          useGenerateStore.getState().patch(targetNodeId, {
            status: 'error',
            error: message,
          })
          void useFlowStore.getState().saveCurrent().catch(() => undefined)
        }
        if (mountedRef.current) setTrimError(message)
      } finally {
        if (mountedRef.current) setTrimBusy(false)
      }
    },
    [id, nodeData.assetIds, trimBusy, videoDimensions],
  )

  const handleCompressVideo = useCallback(
    async (
      targetHeight: VideoCompressionTargetHeight,
      outputWidth: number,
      outputHeight: number,
    ) => {
      const sourceAssetId = nodeData.assetIds[0]
      if (!sourceAssetId || compressionBusy) return
      setCompressionBusy(true)
      setCompressionError(null)
      let targetNodeId = ''
      try {
        targetNodeId = useCanvasStore
          .getState()
          .createCompressedVideoNode(id, targetHeight)
        if (!targetNodeId) throw new Error('无法创建压缩结果节点')
        useGenerateStore.getState().setStatus(targetNodeId, 'running')
        setCompressionOpen(false)
        void useFlowStore.getState().saveCurrent().catch(() => undefined)

        const asset = await compressVideoAsset(sourceAssetId, targetHeight)
        useCanvasStore.getState().updateNodeData(targetNodeId, {
          assetIds: [asset.id],
          status: 'success',
          error: undefined,
          width: outputWidth,
          height: outputHeight,
          updatedAt: new Date().toISOString(),
        } as unknown as Partial<BaseNodeData>)
        useGenerateStore.getState().setStatus(targetNodeId, 'success')
        await useFlowStore.getState().saveCurrent().catch(() => undefined)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (targetNodeId) {
          useCanvasStore.getState().updateNodeData(targetNodeId, {
            status: 'error',
            error: message,
            updatedAt: new Date().toISOString(),
          } as unknown as Partial<BaseNodeData>)
          useGenerateStore.getState().patch(targetNodeId, {
            status: 'error',
            error: message,
          })
          void useFlowStore.getState().saveCurrent().catch(() => undefined)
        }
        if (mountedRef.current) setCompressionError(message)
      } finally {
        if (mountedRef.current) setCompressionBusy(false)
      }
    },
    [compressionBusy, id, nodeData.assetIds],
  )

  /** 退出节点上可能触发的浏览器原生全屏（双击 video 常见） */
  const exitNativeVideoFullscreen = useCallback(() => {
    const video = videoRef.current as
      | (HTMLVideoElement & {
          webkitDisplayingFullscreen?: boolean
          webkitExitFullscreen?: () => void
        })
      | null
    try {
      if (document.fullscreenElement) {
        void document.exitFullscreen?.().catch(() => undefined)
      }
      if (video?.webkitDisplayingFullscreen && video.webkitExitFullscreen) {
        video.webkitExitFullscreen()
      }
    } catch {
      // ignore
    }
  }, [])

  /** 工具条放大或双击节点时，直接打开首页同款全视口播放器。 */
  const handleOpenFullSize = useCallback(
    (event?: {
      target?: EventTarget | null
      preventDefault?: () => void
      stopPropagation?: () => void
    }) => {
      event?.stopPropagation?.()
      const target = event?.target
      if (
        target instanceof Element &&
        target.closest(
          'button, input, textarea, select, a, [role="button"], [contenteditable="true"]',
        )
      ) {
        return
      }
      event?.preventDefault?.()
      exitNativeVideoFullscreen()
      const assetId = nodeData.assetIds[0]
      if (!assetId) return
      openVideoPlayer(
        getAssetFileUrl(assetId),
        nodeData.title || '视频预览',
        handleCaptureFrame,
      )
    },
    [
      exitNativeVideoFullscreen,
      handleCaptureFrame,
      nodeData.assetIds,
      nodeData.title,
      openVideoPlayer,
    ],
  )

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

  const handleCloseEditorMenus = useCallback(() => {
    setModelMenuOpen(false)
    setQualityMenuOpen(false)
    setCountMenuOpen(false)
  }, [])

  useEffect(() => {
    if (!editorMounted) return
    const handleDocumentPointerDown = (event: globalThis.PointerEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      const isInsideEditorOwner =
        !!target.closest(`[data-flow-node-id="${id}"]`) ||
        !!target.closest('.image-editor-panel') ||
        !!target.closest('.video-generation-panel') ||
        !!target.closest('.video-player-overlay') ||
        !!target.closest('.prompt-editor-modal')
      const isInsideMenuRoot =
        !!target.closest('.image-editor-menu-anchor') ||
        !!target.closest('.prompt-template-library')
      if (
        shouldCloseFloatingMenuOnPointerDown({
          button: event.button,
          isMenuOpen: modelMenuOpen || qualityMenuOpen || countMenuOpen,
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
    qualityMenuOpen,
  ])

  const firstAssetId = nodeData.assetIds[0]
  const displayStatus =
    callState.status !== 'idle'
      ? callState.status
      : (data as BaseNodeData).status ?? nodeData.status
  const running = displayStatus === 'queued' || displayStatus === 'running'
  const videoProgressLabel = nodeData.trimSourceNodeId
    ? '视频裁切中'
    : nodeData.compressionSourceNodeId
      ? '视频压缩中'
      : '视频生成中'
  const videoGenerationProgress = running
  const videoGenerationProgressOverlay = videoGenerationProgress ? (
    <div className="image-generation-progress-overlay" aria-live="polite">
      <div className="image-generation-progress-content">
        <div className="image-generation-progress-label">
          <span className="image-generation-progress-dot" />
          <span>{videoProgressLabel}</span>
        </div>
        <div
          className="image-generation-progress-track"
          role="progressbar"
          aria-label={videoProgressLabel}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuetext="生成中"
        >
          <span className="image-generation-progress-fill" />
        </div>
      </div>
    </div>
  ) : null

  useEffect(() => {
    if (
      !isInterruptedVideoGeneration(
        nodeData.status,
        nodeData.generationId,
        generationRequestInFlight,
      )
    ) {
      return
    }
    const message = '上次生成在任务创建完成前中断，请重新发送'
    updateNodeData(id, {
      status: 'error',
      error: message,
      updatedAt: new Date().toISOString(),
    } as unknown as Partial<BaseNodeData>)
    useGenerateStore.getState().patch(id, {
      status: 'error',
      error: message,
    })
    void useFlowStore.getState().saveCurrent().catch(() => undefined)
  }, [
    generationRequestInFlight,
    id,
    nodeData.generationId,
    nodeData.status,
    updateNodeData,
  ])

  // 刷新页面后恢复正在进行的生成任务订阅
  useEffect(() => {
    if (!nodeData.generationId) return
    if (displayStatus !== 'running' && displayStatus !== 'queued') return
    if (generationUnsubscribeRef.current) return
    const unsubscribe = resumeGenerationSubscription({
      nodeId: id,
      generationId: nodeData.generationId,
    })
    return replaceGenerationSubscription(generationUnsubscribeRef, unsubscribe)
  }, [nodeData.generationId, displayStatus, id])

  const upstreamImageAssetIds = useMemo(
    () =>
      getImageGenerationInputImages({
        nodeId: id,
        nodes,
        edges,
      }),
    [edges, id, nodes],
  )
  const referenceAssetIds = useMemo(
    () =>
      resolveVideoInputImages(nodeData.inputImageAssetIds, upstreamImageAssetIds, {
        preferUpstream: true,
      }),
    [nodeData.inputImageAssetIds, upstreamImageAssetIds],
  )
  const mentionImages = useMemo(
    () =>
      referenceAssetIds.map((assetId, index) => ({
        assetId,
        label: `图片${index + 1}`,
      })),
    [referenceAssetIds],
  )
  /** 上游文本节点：可作为视频提示词，无需在视频节点重复填写 */
  const upstreamTextRefs = useMemo(
    () =>
      getUpstreamTextReferences({
        nodeId: id,
        nodes,
        edges,
      }),
    [edges, id, nodes],
  )
  const upstreamTextPrompt = useMemo(
    () => joinUpstreamTextPrompts(upstreamTextRefs),
    [upstreamTextRefs],
  )
  const upstreamTextBrief = useMemo(() => {
    const text = upstreamTextPrompt.replace(/\s+/g, ' ').trim()
    if (!text) return ''
    return `${text.slice(0, 16)}…`
  }, [upstreamTextPrompt])

  useEffect(() => {
    if (!upstreamTextPrompt || !sendError) return
    if (sendError.includes('提示词')) setSendError('')
  }, [sendError, upstreamTextPrompt])

  const handleRemoveReferenceAsset = useCallback(
    (assetId: string) => {
      removeIncomingImageReference(id, assetId)
      void useFlowStore.getState().saveCurrent().catch(() => undefined)
    },
    [id, removeIncomingImageReference],
  )
  const generationHistoryItems = useMemo(
    () => getVideoGenerationHistoryItems(nodeData.generationRuns),
    [nodeData.generationRuns],
  )
  const selectedModel =
    videoModelOptions.find((model) => model.id === selectedModelId) ??
    videoModelOptions[0]
  const activeVideoModelNeedsJimeng = videoModelNeedsJimeng(
    selectedModel?.id ?? '',
  )
  const unsupportedModelMessage = getUnsupportedVideoModelMessage(
    selectedModel?.id ?? '',
  )

  const clearGenerationSubscription = () => {
    generationUnsubscribeRef.current?.()
    generationUnsubscribeRef.current = null
  }

  const applyProgress = (response: GenerationResponse) => {
    updateNodeData(id, {
      status: response.status,
      error: response.error,
      generationId: response.id,
      updatedAt: new Date().toISOString(),
    } as unknown as Partial<BaseNodeData>)
    useGenerateStore.getState().patch(id, {
      status: response.status,
      error: response.error,
      generationId: response.id,
    })
  }

  const applyResponse = async (
    response: GenerationResponse,
    request: VideoGenerationRequest,
  ) => {
    const latestData = useCanvasStore
      .getState()
      .nodes.find((node) => node.id === id)
      ?.data as Partial<VideoNodeData> | undefined
    const completionPatch = buildVideoCompletionNodePatch(
      response,
      request,
      latestData ?? nodeData,
    )
    updateNodeData(
      id,
      completionPatch as unknown as Partial<BaseNodeData>,
    )
    useGenerateStore.getState().patch(id, {
      status: response.status,
      error: response.error,
      generationId: response.id,
    })
    if (response.status === 'success') {
      useGenerationDefaultsStore.getState().rememberVideoDefaults({
        model: request.model,
        aspectRatio: request.aspectRatio,
        resolution: request.resolution,
        durationSeconds: request.durationSeconds,
        count: request.count as VideoNodeData['count'],
      })
      try {
        await useFlowStore.getState().saveCurrent()
      } catch (error) {
        setSendError(
          `视频已生成，但保存到画布失败：${
            error instanceof Error ? error.message : String(error)
          }`,
        )
        return
      }
      handleCloseEditor()
      return
    }
    setSendError(response.error ?? '视频生成失败')
  }

  const handleGenerationResponse = async (
    response: GenerationResponse,
    request: VideoGenerationRequest,
  ) => {
    clearGenerationSubscription()
    if (response.status === 'success' || response.status === 'error') {
      await applyResponse(response, request)
      return
    }
    await persistInitialVideoGenerationResponse(response, {
      applyResponse: applyProgress,
      saveCurrent: () => useFlowStore.getState().saveCurrent(),
    })
    const unsubscribe = subscribeGenerationWithFallback(response.id, {
      onUpdate: (data) => {
        if (data.status !== 'success' && data.status !== 'error') {
          applyProgress(data)
        }
      },
      onComplete: (data) => {
        void applyResponse(data, request)
        clearGenerationSubscription()
      },
      onError: (error) => {
        updateNodeData(id, {
          status: 'error',
          error,
          updatedAt: new Date().toISOString(),
        } as unknown as Partial<BaseNodeData>)
        useGenerateStore.getState().patch(id, { status: 'error', error })
        setSendError(error)
        clearGenerationSubscription()
      },
    })
    replaceGenerationSubscription(generationUnsubscribeRef, unsubscribe)
  }

  const handleSend = async () => {
    if (running) return
    // 发送时取最新画布，本地提示词为空则回退上游文本节点
    const canvasSnapshot = useCanvasStore.getState()
    const resolved = resolveImageGenerationPrompt({
      localPrompt: prompt,
      nodeId: id,
      nodes: canvasSnapshot.nodes,
      edges: canvasSnapshot.edges,
    })
    const trimmedPrompt = resolved.prompt
    if (!trimmedPrompt) {
      setSendError(
        resolved.upstreamRefs.length > 0
          ? '上游文本节点暂无可用内容，请先在文本节点填写'
          : '请输入视频提示词，或连接带内容的文本节点',
      )
      return
    }
    if (!selectedModel) {
      setSendError('请选择视频模型')
      return
    }
    if (activeVideoModelNeedsJimeng && !isJimengConfigured) {
      setSendError('未配置 dreamina CLI，请先在设置中配置')
      return
    }
    if (unsupportedModelMessage) {
      setSendError(unsupportedModelMessage)
      return
    }
    setSendError('')

    const inputImages = referenceAssetIds
    const effectiveMode = resolveVideoModeForInputImages(
      inputImages.length > 0 ? mode : 'text_to_video',
      inputImages,
    )
    const request: VideoGenerationRequest = {
      flowId: resolveGenerationFlowId(getCurrentFlowId()),
      nodeId: id,
      mediaType: 'video',
      mode: effectiveMode,
      prompt: trimmedPrompt,
      inputImages,
      references: buildVideoReferencesFromInputImages(effectiveMode, inputImages),
      model: selectedModel.id,
      aspectRatio,
      resolution,
      quality: nodeData.quality,
      durationSeconds,
      count,
      generateAudio: nodeData.generateAudio,
    }

    const latestData = useCanvasStore
      .getState()
      .nodes.find((node) => node.id === id)
      ?.data as Partial<VideoNodeData> | undefined
    updateNodeData(
      id,
      buildVideoRunningNodePatch(request, latestData ?? nodeData) as unknown as Partial<BaseNodeData>,
    )
    useGenerateStore.getState().patch(id, {
      status: 'queued',
      error: undefined,
      lastRequest: request,
      generationId: undefined,
    })
    setSendError('')

    try {
      await useFlowStore.getState().saveCurrent()
      const response = await createGeneration(request)
      await handleGenerationResponse(response, request)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      updateNodeData(id, {
        status: 'error',
        error: message,
        updatedAt: new Date().toISOString(),
      } as unknown as Partial<BaseNodeData>)
      useGenerateStore.getState().patch(id, {
        status: 'error',
        error: message,
      })
      setSendError(message)
    }
  }

  const handleSelectHistory = (item: VideoGenerationHistoryItem) => {
    const state = getEditorStateFromVideoGenerationHistoryItem(item)
    const { run } = item
    updateNodeData(id, {
      ...state,
      generationId: run.generationId,
      status: run.status === 'success' ? 'success' : run.status,
      error: run.error,
      updatedAt: new Date().toISOString(),
    } as unknown as Partial<BaseNodeData>)
    void useFlowStore.getState().saveCurrent().catch(() => undefined)
  }

  const handleVideoModeChange = useCallback(
    (nextMode: VideoMode) => {
      setMode(nextMode)
      updateNodeData(id, {
        mode: nextMode,
        references: buildVideoReferencesFromInputImages(nextMode, referenceAssetIds),
        updatedAt: new Date().toISOString(),
      } as unknown as Partial<BaseNodeData>)
      void useFlowStore.getState().saveCurrent().catch(() => undefined)
    },
    [id, referenceAssetIds, updateNodeData],
  )

  const playerSrc = firstAssetId ? getAssetFileUrl(firstAssetId) : ''

  // 捕获阶段拦截双击：阻止 Chromium 等视频控件的原生全屏
  useEffect(() => {
    const video = videoRef.current
    if (!video || !firstAssetId) return

    const onDblClickCapture = (event: Event) => {
      event.preventDefault()
      event.stopPropagation()
      exitNativeVideoFullscreen()
      handleOpenFullSize()
    }

    const onFullscreenChange = () => {
      // 节点内 video 被原生全屏时立刻退出（全屏只允许播放器内按钮）
      if (
        document.fullscreenElement === video ||
        (video as HTMLVideoElement & { webkitDisplayingFullscreen?: boolean })
          .webkitDisplayingFullscreen
      ) {
        exitNativeVideoFullscreen()
      }
    }

    video.addEventListener('dblclick', onDblClickCapture, true)
    document.addEventListener('fullscreenchange', onFullscreenChange)
    video.addEventListener(
      'webkitbeginfullscreen',
      exitNativeVideoFullscreen as EventListener,
    )
    return () => {
      video.removeEventListener('dblclick', onDblClickCapture, true)
      document.removeEventListener('fullscreenchange', onFullscreenChange)
      video.removeEventListener(
        'webkitbeginfullscreen',
        exitNativeVideoFullscreen as EventListener,
      )
    }
  }, [exitNativeVideoFullscreen, firstAssetId, handleOpenFullSize])

  return (
    <>
    <NodeWrapper
      icon={Film}
      title={nodeData.title}
      status={displayStatus as BaseNodeData['status']}
      selected={selected}
      nodeId={id}
      nodeType="video"
      mediaDisplay={!!firstAssetId}
    >
      <>
        {editorMounted && (
          <VideoActionCard
            busy={actionBusy || compressionBusy || trimBusy}
            closing={editorClosing}
            validationStatus={validationStatus}
            validationLabel={'校验'}
            validationAriaLabel={
              videoModelNeedsJimeng(selectedModelId)
                ? '校验即梦 CLI'
                : '校验当前视频模型'
            }
            onValidate={() => void handleValidateVideoProvider()}
            onDownload={handleDownloadVideo}
            onTrim={handleOpenTrim}
            onCompress={handleOpenCompression}
            onOpenFullSize={() => handleOpenFullSize()}
          />
        )}

        {firstAssetId ? (
          <div
            className="media-display-node video-media-display"
            style={VIDEO_DISPLAY_STYLE}
            onClick={handleOpenEditor}
            onDoubleClick={(event) => handleOpenFullSize(event)}
          >
            <video
              ref={videoRef}
              src={playerSrc}
              controls
              // 去掉原生全屏入口，避免与双击/工具条逻辑冲突
              controlsList="nofullscreen nodownload noremoteplayback noplaybackrate"
              disablePictureInPicture
              playsInline
              draggable={false}
              onDoubleClick={(event) => handleOpenFullSize(event)}
              onLoadedMetadata={(event) => {
                if (
                  event.currentTarget.videoWidth > 0 &&
                  event.currentTarget.videoHeight > 0
                ) {
                  setVideoDimensions({
                    width: event.currentTarget.videoWidth,
                    height: event.currentTarget.videoHeight,
                  })
                }
              }}
              style={{
                width: '100%',
                maxHeight: 420,
                objectFit: 'contain',
                display: 'block',
              }}
            />
            {videoGenerationProgressOverlay}
          </div>
        ) : (
          <div
            className="image-node-container video-node-container"
            onClick={handleOpenEditor}
            style={EMPTY_VIDEO_FRAME_STYLE}
          >
            {/* 生成中只显示进度，隐藏摄像机占位图标 */}
            {!running ? (
              <div className="node-preview-area image-node-preview">
                <Video
                  size={64}
                  strokeWidth={1.8}
                  className="node-placeholder-icon video-placeholder-icon"
                />
              </div>
            ) : null}
            {videoGenerationProgressOverlay}
          </div>
        )}

        {editorMounted ? (
          <VideoGenerationPanel
            closing={editorClosing}
            prompt={prompt}
            referenceAssetIds={referenceAssetIds}
            mentionImages={mentionImages}
            upstreamTextBrief={upstreamTextBrief}
            upstreamTextFull={upstreamTextPrompt}
            modelOptions={videoModelOptions}
            selectedModelId={selectedModel?.id ?? ''}
            modelMenuOpen={modelMenuOpen}
            qualityMenuOpen={qualityMenuOpen}
            countMenuOpen={countMenuOpen}
            aspectRatio={aspectRatio}
            resolution={resolution}
            durationSeconds={durationSeconds}
            count={count}
            running={running}
            sendError={sendError || callState.error}
            historyItems={generationHistoryItems}
            currentAssetId={firstAssetId}
            videoMode={mode}
            onPromptChange={persistPromptDraft}
            onVideoModeChange={handleVideoModeChange}
            onModelToggle={() => {
              setModelMenuOpen((open) => !open)
              setQualityMenuOpen(false)
              setCountMenuOpen(false)
            }}
            onSelectModel={(modelId) => {
              setModelTouched(true)
              setSelectedModelId(modelId)
              setModelMenuOpen(false)
            }}
            onQualityToggle={() => {
              setQualityMenuOpen((open) => !open)
              setModelMenuOpen(false)
              setCountMenuOpen(false)
            }}
            onAspectRatioChange={setAspectRatio}
            onResolutionChange={setResolution}
            onDurationChange={setDurationSeconds}
            onCountToggle={() => {
              setCountMenuOpen((open) => !open)
              setModelMenuOpen(false)
              setQualityMenuOpen(false)
            }}
            onCountChange={(value) => {
              setCount(normalizeVideoCount(value))
              setCountMenuOpen(false)
            }}
            onRemoveReference={handleRemoveReferenceAsset}
            onSelectHistory={handleSelectHistory}
            onSend={() => void handleSend()}
          />
        ) : null}
      </>
    </NodeWrapper>

    <VideoCompressionOverlay
      open={compressionOpen && Boolean(playerSrc)}
      videoUrl={playerSrc}
      sourceWidth={videoDimensions.width}
      sourceHeight={videoDimensions.height}
      busy={compressionBusy}
      error={compressionError}
      onCancel={() => setCompressionOpen(false)}
      onConfirm={(targetHeight, outputWidth, outputHeight) =>
        void handleCompressVideo(targetHeight, outputWidth, outputHeight)
      }
    />
    <VideoTrimOverlay
      open={trimOpen && Boolean(playerSrc)}
      videoUrl={playerSrc}
      sourceWidth={videoDimensions.width}
      sourceHeight={videoDimensions.height}
      busy={trimBusy}
      error={trimError}
      onCancel={() => setTrimOpen(false)}
      onConfirm={(startSeconds, durationSeconds) =>
        void handleTrimVideo(startSeconds, durationSeconds)
      }
    />
    </>
  )
}

export default VideoNode
