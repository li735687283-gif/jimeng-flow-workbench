import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { NodeProps } from '@xyflow/react'
import { Film, Video } from 'lucide-react'
import { createGeneration, subscribeGeneration } from '../api/generations'
import { getAssetFileUrl } from '../api/assets'
import { VideoGenerationPanel } from '../components/VideoGenerationPanel'
import { VideoGenerationHistoryStrip } from '../components/VideoGenerationHistoryStrip'
import { NodeWrapper } from './NodeWrapper'
import { useAgentStore } from '../state/agentStore'
import { useCanvasStore } from '../state/canvasStore'
import { getCurrentFlowId, useFlowStore } from '../state/flowStore'
import { IDLE_CALL_STATE, useGenerateStore } from '../state/generateStore'
import { useSettingsStore } from '../state/settingsStore'
import type { BaseNodeData } from '../types/nodeTypes'
import { shouldCloseFloatingEditorOnPointerDown } from '../utils/editorPointer'
import { resolveGenerationFlowId } from '../utils/generationFlow'
import { getImageGenerationInputImages } from '../utils/imageGenerationInputs'
import { applyAgentStoryboardVideoRestoreResult } from '../utils/agentVideoGeneration'
import {
  buildVideoCompletionNodePatch,
  buildVideoRunningNodePatch,
  getVideoSubmitLabel,
  resolveVideoInputImages,
  resolveVideoModeForInputImages,
} from '../utils/videoGenerationState'
import {
  getConfiguredDefaultVideoModel,
  getConfiguredVideoModels,
  getUnsupportedVideoModelMessage,
  videoModelNeedsJimeng,
} from '../utils/videoModels'
import {
  buildVideoReferencesFromInputImages,
  mergeVideoDefaults,
  type VideoAspectRatio,
  type VideoGenerationRequest,
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
  const nodeData = mergeVideoDefaults(data as Partial<VideoNodeData>)
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

  const [editorMounted, setEditorMounted] = useState(false)
  const [editorClosing, setEditorClosing] = useState(false)
  const [prompt, setPrompt] = useState(nodeData.prompt)
  const [selectedModelId, setSelectedModelId] = useState('')
  const [modelTouched, setModelTouched] = useState(false)
  const [aspectRatio, setAspectRatio] =
    useState<VideoAspectRatio>(nodeData.aspectRatio)
  const [resolution, setResolution] =
    useState<VideoResolution>(nodeData.resolution)
  const [durationSeconds, setDurationSeconds] = useState(
    nodeData.durationSeconds,
  )
  const [count, setCount] = useState<VideoNodeData['count']>(nodeData.count)
  const [modelMenuOpen, setModelMenuOpen] = useState(false)
  const [qualityMenuOpen, setQualityMenuOpen] = useState(false)
  const [countMenuOpen, setCountMenuOpen] = useState(false)
  const [sendError, setSendError] = useState('')

  useEffect(() => {
    return () => {
      generationUnsubscribeRef.current?.()
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    setPrompt(nodeData.prompt)
    setAspectRatio(nodeData.aspectRatio)
    setResolution(nodeData.resolution)
    setDurationSeconds(nodeData.durationSeconds)
    setCount(nodeData.count)
  }, [
    nodeData.aspectRatio,
    nodeData.count,
    nodeData.durationSeconds,
    nodeData.prompt,
    nodeData.resolution,
  ])

  const videoModelOptions = useMemo(
    () => getConfiguredVideoModels(settings?.videoModels, settings?.modelConfigs),
    [settings?.modelConfigs, settings?.videoModels],
  )
  useEffect(() => {
    const fallbackModel = getConfiguredDefaultVideoModel(
      settings?.videoModels,
      nodeData.model || settings?.defaultVideoModel,
      settings?.modelConfigs,
    )
    setSelectedModelId((current) => {
      if (
        modelTouched &&
        current &&
        videoModelOptions.some((model) => model.id === current)
      ) {
        return current
      }
      return fallbackModel
    })
  }, [
    modelTouched,
    nodeData.model,
    settings?.defaultVideoModel,
    settings?.modelConfigs,
    settings?.videoModels,
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

  useEffect(() => {
    if (!editorMounted) return
    const handleDocumentPointerDown = (event: globalThis.PointerEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      const isInsideEditorOwner = !!target.closest(`[data-flow-node-id="${id}"]`)
      if (
        shouldCloseFloatingEditorOnPointerDown({
          button: event.button,
          isInsideEditorOwner,
        })
      ) {
        handleCloseEditor()
      }
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

  const firstAssetId = nodeData.assetIds[0]
  const displayStatus =
    callState.status !== 'idle'
      ? callState.status
      : (data as BaseNodeData).status ?? nodeData.status
  const running = displayStatus === 'queued' || displayStatus === 'running'
  const submitLabel = getVideoSubmitLabel(running, nodeData.assetIds.length > 0)
  const upstreamImageAssetIds = useMemo(
    () =>
      getImageGenerationInputImages({
        assetId: undefined,
        modelId: selectedModelId,
        nodeId: id,
        nodes,
        edges,
      }),
    [edges, id, nodes, selectedModelId],
  )
  const referenceAssetIds = useMemo(
    () =>
      resolveVideoInputImages(nodeData.inputImageAssetIds, upstreamImageAssetIds, {
        preferUpstream: true,
      }),
    [nodeData.inputImageAssetIds, upstreamImageAssetIds],
  )
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
    const trimmedPrompt = prompt.trim()
    if (!trimmedPrompt) {
      setSendError('请输入视频提示词')
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

    const inputImages = referenceAssetIds
    const mode = resolveVideoModeForInputImages(nodeData.mode, inputImages)
    const request: VideoGenerationRequest = {
      flowId: resolveGenerationFlowId(getCurrentFlowId()),
      nodeId: id,
      mediaType: 'video',
      mode,
      prompt: trimmedPrompt,
      inputImages,
      references: buildVideoReferencesFromInputImages(mode, inputImages),
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

  return (
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
        {firstAssetId ? (
          <div className="video-media-stack">
            <div
              className="media-display-node video-media-display"
              data-node-handle-anchor
              style={VIDEO_DISPLAY_STYLE}
              onClick={handleOpenEditor}
            >
              <video
                src={getAssetFileUrl(firstAssetId)}
                controls
                muted
                style={{
                  width: '100%',
                  maxHeight: 420,
                  objectFit: 'contain',
                  display: 'block',
                }}
              />
            </div>
            <VideoGenerationHistoryStrip
              items={generationHistoryItems}
              currentAssetId={firstAssetId}
              onSelect={handleSelectHistory}
            />
          </div>
        ) : (
          <div
            className="image-node-container video-node-container"
            data-node-handle-anchor
            onClick={handleOpenEditor}
            style={EMPTY_VIDEO_FRAME_STYLE}
          >
            <div className="node-preview-area image-node-preview">
              <Video
                size={64}
                strokeWidth={1.8}
                className="node-placeholder-icon video-placeholder-icon"
              />
            </div>
          </div>
        )}

        {editorMounted ? (
          <VideoGenerationPanel
            closing={editorClosing}
            prompt={prompt}
            referenceAssetIds={referenceAssetIds}
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
            submitLabel={submitLabel}
            sendError={sendError || callState.error}
            onPromptChange={(value) => {
              setPrompt(value)
              if (sendError) setSendError('')
            }}
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
            onSend={() => void handleSend()}
          />
        ) : null}
      </>
    </NodeWrapper>
  )
}

export default VideoNode
