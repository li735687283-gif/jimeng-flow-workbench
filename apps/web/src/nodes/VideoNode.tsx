import { createPortal } from 'react-dom'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { NodeProps } from '@xyflow/react'
import { Film, Video, Volume2, VolumeX } from 'lucide-react'
import { createGeneration, subscribeGeneration } from '../api/generations'
import { downloadAssetFile, getAssetFileUrl } from '../api/assets'
import { testJimengConnection } from '../api/settings'
import { VideoActionCard } from '../components/VideoActionCard'
import { VideoGenerationPanel } from '../components/VideoGenerationPanel'
import { VideoPlayerModal } from '../components/VideoPlayerModal'
import { NodeWrapper } from './NodeWrapper'
import { useAgentStore } from '../state/agentStore'
import { useCanvasStore } from '../state/canvasStore'
import { getCurrentFlowId, useFlowStore } from '../state/flowStore'
import { IDLE_CALL_STATE, useGenerateStore } from '../state/generateStore'
import { useSettingsStore } from '../state/settingsStore'
import type { BaseNodeData } from '../types/nodeTypes'
import {
  shouldCloseFloatingEditorOnPointerDown,
  shouldCloseFloatingMenuOnPointerDown,
} from '../utils/editorPointer'
import { resolveGenerationFlowId } from '../utils/generationFlow'
import {
  getImageGenerationInputImages,
  getUpstreamTextReferences,
  joinUpstreamTextPrompts,
  resolveImageGenerationPrompt,
} from '../utils/imageGenerationInputs'
import { applyAgentStoryboardVideoRestoreResult } from '../utils/agentVideoGeneration'
import { resolveVideoGenerationDefaults } from '../utils/generationDefaults'
import { resumeGenerationSubscription } from '../utils/generationResume'
import { useGenerationDefaultsStore } from '../state/generationDefaultsStore'
import {
  buildVideoCompletionNodePatch,
  buildVideoRunningNodePatch,
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
  borderRadius: 12,
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
  const removeIncomingImageReference = useCanvasStore(
    (state) => state.removeIncomingImageReference,
  )
  const callState = useGenerateStore((state) => state.states[id] ?? IDLE_CALL_STATE)
  const closeTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null)
  const generationUnsubscribeRef = useRef<(() => void) | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
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
  const [videoMuted, setVideoMuted] = useState(false)
  const [actionBusy, setActionBusy] = useState(false)
  const [validationStatus, setValidationStatus] = useState<
    'idle' | 'checking' | 'success' | 'error'
  >('idle')
  /** 画布内直接挂首页同款 VideoPlayerModal */
  const [playerOpen, setPlayerOpen] = useState(false)

  useEffect(() => {
    return () => {
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

  /**
   * 打开一级小播放器（非全屏）。
   * 入口：工具条放大、双击节点/视频。
   * 全屏仅在播放器内再点全屏按钮。
   */
  const handleOpenFullSize = useCallback(
    (event?: {
      preventDefault?: () => void
      stopPropagation?: () => void
    }) => {
      event?.preventDefault?.()
      event?.stopPropagation?.()
      // 先干掉原生全屏，再开我们的弹层小播放器
      exitNativeVideoFullscreen()
      if (!nodeData.assetIds[0]) return
      setPlayerOpen(true)
    },
    [exitNativeVideoFullscreen, nodeData.assetIds],
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
  const videoGenerationProgress = running
  const videoGenerationProgressOverlay = videoGenerationProgress ? (
    <div className="image-generation-progress-overlay" aria-live="polite">
      <div className="image-generation-progress-content">
        <div className="image-generation-progress-label">
          <span className="image-generation-progress-dot" />
          <span>视频生成中</span>
        </div>
        <div
          className="image-generation-progress-track"
          role="progressbar"
          aria-label="视频生成中"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuetext="生成中"
        >
          <span className="image-generation-progress-fill" />
        </div>
      </div>
    </div>
  ) : null

  // 刷新页面后恢复正在进行的生成任务订阅
  useEffect(() => {
    if (!nodeData.generationId) return
    if (displayStatus !== 'running' && displayStatus !== 'queued') return
    if (generationUnsubscribeRef.current) return
    generationUnsubscribeRef.current = resumeGenerationSubscription({
      nodeId: id,
      generationId: nodeData.generationId,
    })
    return () => {
      generationUnsubscribeRef.current?.()
      generationUnsubscribeRef.current = null
    }
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

  const handleGenerationResponse = (
    response: GenerationResponse,
    request: VideoGenerationRequest,
  ) => {
    clearGenerationSubscription()
    if (response.status === 'success' || response.status === 'error') {
      void applyResponse(response, request)
      return
    }
    applyProgress(response)
    generationUnsubscribeRef.current = subscribeGeneration(response.id, {
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
      handleGenerationResponse(response, request)
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
    useAgentStore.setState((agentState) => ({
      messages: applyAgentStoryboardVideoRestoreResult(agentState.messages, {
        videoNodeId: id,
        videoAssetId: item.assetId,
      }),
    }))
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

  const handleToggleVideoMute = useCallback(() => {
    setVideoMuted((muted) => {
      const nextMuted = !muted
      if (videoRef.current) {
        videoRef.current.muted = nextMuted
        if (!nextMuted) {
          videoRef.current.volume = 1
        }
      }
      return nextMuted
    })
  }, [])

  const playerSrc = firstAssetId ? getAssetFileUrl(firstAssetId) : ''

  // 捕获阶段拦截双击：阻止 Chromium 等视频控件的原生全屏
  useEffect(() => {
    const video = videoRef.current
    if (!video || !firstAssetId) return

    const onDblClickCapture = (event: Event) => {
      event.preventDefault()
      event.stopPropagation()
      exitNativeVideoFullscreen()
      if (!nodeData.assetIds[0]) return
      // 只开一级小播放器，绝不进系统全屏
      setPlayerOpen(true)
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
  }, [exitNativeVideoFullscreen, firstAssetId, nodeData.assetIds])

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
            busy={actionBusy}
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
              controlsList="nofullscreen nodownload noremoteplayback"
              disablePictureInPicture
              playsInline
              muted={videoMuted}
              draggable={false}
              onDoubleClick={(event) => handleOpenFullSize(event)}
              onLoadedMetadata={(event) => {
                event.currentTarget.muted = videoMuted
                if (!videoMuted) event.currentTarget.volume = 1
              }}
              style={{
                width: '100%',
                maxHeight: 420,
                objectFit: 'contain',
                display: 'block',
              }}
            />
            <button
              type="button"
              className={`video-sound-toggle nodrag nopan${videoMuted ? ' muted' : ''}`}
              onClick={(event) => {
                event.stopPropagation()
                handleToggleVideoMute()
              }}
              aria-label={videoMuted ? '取消静音' : '静音'}
              title={videoMuted ? '取消静音' : '静音'}
            >
              {videoMuted ? (
                <VolumeX size={19} strokeWidth={1.9} />
              ) : (
                <Volume2 size={19} strokeWidth={1.9} />
              )}
            </button>
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

    {/* 首页同一个 VideoPlayerModal，直接挂到 body */}
    {typeof document !== 'undefined'
      ? createPortal(
          <VideoPlayerModal
            open={playerOpen && Boolean(playerSrc)}
            src={playerSrc}
            title={nodeData.title || '视频预览'}
            onClose={() => setPlayerOpen(false)}
          />,
          document.body,
        )
      : null}
    </>
  )
}

export default VideoNode
