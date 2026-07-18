import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { Node } from '@xyflow/react'
import {
  AlertCircle,
  Film,
  Loader2,
  RotateCcw,
  Sparkles,
  Volume2,
  XCircle,
} from 'lucide-react'
import { useCanvasStore } from '../state/canvasStore'
import { useGenerateStore, IDLE_CALL_STATE } from '../state/generateStore'
import { useSettingsStore } from '../state/settingsStore'
import { createGeneration, retryGeneration, subscribeGeneration } from '../api/generations'
import type { GenerationResponse } from '@jimeng-flow/shared/generateNode'
import type { TextNodeData } from '@jimeng-flow/shared/textNode'
import {
  VIDEO_MODES,
  VIDEO_ASPECT_RATIOS,
  VIDEO_RESOLUTIONS,
  VIDEO_DURATIONS,
  VIDEO_COUNTS,
  buildVideoReferencesFromInputImages,
  mergeVideoDefaults,
  type VideoNodeData,
  type VideoGenerationRequest,
  type VideoMode,
  type VideoAspectRatio,
  type VideoResolution,
} from '@jimeng-flow/shared/videoNode'
import {
  buildVideoCompletionNodePatch,
  buildVideoRunningNodePatch,
  getVideoSubmitLabel,
  resolveVideoInputImages,
  resolveVideoModeForInputImages,
} from '../utils/videoGenerationState'
import { getImageGenerationInputImages } from '../utils/imageGenerationInputs'
import {
  getConfiguredDefaultVideoModel,
  getConfiguredVideoModels,
  getUnsupportedVideoModelMessage,
  videoModelNeedsJimeng,
} from '../utils/videoModels'
import { getCurrentFlowId } from '../state/flowStore'
import { resolveGenerationFlowId } from '../utils/generationFlow'

interface VideoComposerProps {
  nodeId: string
}

const selectStyle: CSSProperties = {
  background: 'var(--bg-base)',
  color: 'var(--text-h)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  padding: '4px 6px',
  fontSize: 11,
  fontFamily: 'inherit',
  cursor: 'pointer',
  minWidth: 72,
}

const fieldLabelStyle: CSSProperties = {
  fontSize: 10,
  color: 'var(--text-dim)',
  marginBottom: 3,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}

const inactiveBtn: CSSProperties = {
  padding: '4px 8px',
  background: 'var(--bg-base)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 11,
  fontFamily: 'inherit',
  minWidth: 30,
}

function activeBtn(base: CSSProperties): CSSProperties {
  return {
    ...base,
    background: 'var(--accent)',
    color: '#fff',
    borderColor: 'var(--accent)',
  }
}

function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <span style={fieldLabelStyle}>{label}</span>
      {children}
    </div>
  )
}

function findUpstreamPrompt(
  currentId: string,
  nodes: Node[],
  edges: { source: string; target: string }[],
): string {
  const upstreamIds = edges
    .filter((e) => e.target === currentId)
    .map((e) => e.source)
  for (const sid of upstreamIds) {
    const n = nodes.find((x) => x.id === sid)
    if (!n || n.type !== 'text') continue
    const d = n.data as Partial<TextNodeData>
    const text = d.promptCandidate || d.content || d.input || ''
    if (text.trim()) return text
  }
  return ''
}

export function VideoComposer({ nodeId }: VideoComposerProps) {
  const node = useCanvasStore((s) => s.nodes.find((n) => n.id === nodeId))
  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)
  const updateNodeData = useCanvasStore((s) => s.updateNodeData)
  const [notice, setNotice] = useState<string | null>(null)
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const generationUnsubscribeRef = useRef<(() => void) | null>(null)

  // 组件卸载时清除 notice timer
  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current)
      generationUnsubscribeRef.current?.()
    }
  }, [])

  const callState = useGenerateStore(
    (s) => s.states[nodeId] ?? IDLE_CALL_STATE,
  )
  const settings = useSettingsStore((s) => s.settings)
  const isJimengConfigured = useSettingsStore((s) => s.isJimengConfigured)

  if (!node) {
    return (
      <div className="bottom-panel-content">
        <span className="bottom-placeholder">未选中视频节点</span>
      </div>
    )
  }

  const d = mergeVideoDefaults(node.data as Partial<VideoNodeData>)
  const videoModelOptions = getConfiguredVideoModels(
    settings?.videoModels,
    settings?.modelConfigs,
  )
  const activeVideoModelId = getConfiguredDefaultVideoModel(
    settings?.videoModels,
    d.model || settings?.defaultVideoModel,
    settings?.modelConfigs,
  )
  const set = (partial: Partial<VideoNodeData>) =>
    updateNodeData(nodeId, partial)

  const isVipModel = activeVideoModelId === 'seedance-2.0-vip'
  const activeVideoModelNeedsJimeng = videoModelNeedsJimeng(activeVideoModelId)
  const unsupportedModelMessage =
    getUnsupportedVideoModelMessage(activeVideoModelId)
  const modeLabel =
    VIDEO_MODES.find((m) => m.id === d.mode)?.label ?? d.mode
  const running = callState.status === 'queued' || callState.status === 'running'
  const submitLabel = getVideoSubmitLabel(running, d.assetIds.length > 0)
  const upstreamPrompt = findUpstreamPrompt(nodeId, nodes, edges)
  const upstreamImageAssetIds = getImageGenerationInputImages({
    modelId: activeVideoModelId,
    nodeId,
    nodes,
    edges,
  })
  const resolvedPrompt = d.prompt.trim() || upstreamPrompt
  const resolvedInputImages = resolveVideoInputImages(
    d.inputImageAssetIds,
    upstreamImageAssetIds,
  )
  const hasInputImage = resolvedInputImages.length > 0
  const submitDisabled =
    running ||
    !activeVideoModelId ||
    (activeVideoModelNeedsJimeng && !isJimengConfigured) ||
    !!unsupportedModelMessage

  /** 显示通知，自动清除前一个 timer，在 delayMs 后自动消失 */
  const showNotice = (msg: string, delayMs = 4000) => {
    setNotice(msg)
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current)
    noticeTimerRef.current = setTimeout(() => setNotice(null), delayMs)
  }

  const makeRequest = (): VideoGenerationRequest | null => {
    const prompt = resolvedPrompt.trim()
    if (!prompt || !activeVideoModelId) return null

    const mode = resolveVideoModeForInputImages(d.mode, resolvedInputImages)

    return {
      flowId: resolveGenerationFlowId(getCurrentFlowId()),
      nodeId,
      mediaType: 'video',
      mode,
      prompt,
      inputImages: resolvedInputImages,
      references: buildVideoReferencesFromInputImages(mode, resolvedInputImages),
      model: activeVideoModelId,
      aspectRatio: d.aspectRatio,
      resolution: d.resolution,
      quality: d.quality,
      durationSeconds: d.durationSeconds,
      count: d.count,
      generateAudio: d.generateAudio,
    }
  }

  const applyRunning = (req: VideoGenerationRequest) => {
    const latestData = useCanvasStore
      .getState()
      .nodes.find((item) => item.id === nodeId)
      ?.data as Partial<VideoNodeData> | undefined
    updateNodeData(nodeId, buildVideoRunningNodePatch(req, latestData ?? d))
    useGenerateStore.getState().patch(nodeId, {
      status: 'running',
      error: undefined,
      lastRequest: req,
      generationId: undefined,
    })
    setNotice(null)
  }

  const applyResponse = (
    res: GenerationResponse,
    req: VideoGenerationRequest,
  ) => {
    const latestData = useCanvasStore
      .getState()
      .nodes.find((item) => item.id === nodeId)
      ?.data as Partial<VideoNodeData> | undefined
    const completionPatch = buildVideoCompletionNodePatch(
      res,
      req,
      latestData ?? d,
    )

    updateNodeData(
      nodeId,
      completionPatch as unknown as Partial<VideoNodeData>,
    )
    useGenerateStore.getState().patch(nodeId, {
      status: res.status,
      error: res.error,
      generationId: res.id,
    })

    if (res.status === 'success') {
      const generatedCount = (res.results ?? []).filter((item) => item.assetId).length
      showNotice(`视频生成完成，共 ${generatedCount} 个结果`)
    } else {
      showNotice(res.error ?? '视频生成失败')
    }
  }

  const applyProgress = (res: GenerationResponse) => {
    updateNodeData(nodeId, {
      status: res.status,
      error: res.error,
      generationId: res.id,
      updatedAt: new Date().toISOString(),
    } as unknown as Partial<VideoNodeData>)
    useGenerateStore.getState().patch(nodeId, {
      status: res.status,
      error: res.error,
      generationId: res.id,
    })
  }

  const clearGenerationSubscription = () => {
    generationUnsubscribeRef.current?.()
    generationUnsubscribeRef.current = null
  }

  const handleGenerationResponse = (
    res: GenerationResponse,
    req: VideoGenerationRequest,
  ) => {
    clearGenerationSubscription()
    if (res.status === 'success' || res.status === 'error') {
      applyResponse(res, req)
      return
    }

    applyProgress(res)
    const unsubscribe = subscribeGeneration(res.id, {
      onUpdate: (data) => {
        if (data.status !== 'success' && data.status !== 'error') {
          applyProgress(data)
        }
      },
      onComplete: (data) => {
        applyResponse(data, req)
        clearGenerationSubscription()
      },
      onError: (error) => {
        updateNodeData(nodeId, {
          status: 'error',
          error,
          updatedAt: new Date().toISOString(),
        } as unknown as Partial<VideoNodeData>)
        useGenerateStore.getState().patch(nodeId, {
          status: 'error',
          error,
        })
        showNotice(`视频生成失败：${error}`)
        clearGenerationSubscription()
      },
    })
    generationUnsubscribeRef.current = unsubscribe
  }

  const handleSubmit = async () => {
    if (running) return
    const prompt = resolvedPrompt.trim()
    if (!prompt) {
      const msg = 'Prompt 为空，请输入视频描述或连接上游文本节点'
      updateNodeData(nodeId, { status: 'error', error: msg })
      useGenerateStore.getState().patch(nodeId, { status: 'error', error: msg })
      return
    }
    const req = makeRequest()
    if (!req) return
    applyRunning(req)
    try {
      const res = await createGeneration(req)
      handleGenerationResponse(res, req)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      updateNodeData(nodeId, { status: 'error', error: msg })
      useGenerateStore.getState().patch(nodeId, {
        status: 'error',
        error: msg,
      })
      showNotice(`视频生成失败：${msg}`)
      return
    }
  }

  const handleRetry = async () => {
    if (running) return
    const prompt = resolvedPrompt.trim()
    if (!prompt) {
      const msg = 'Prompt 为空，请输入视频描述或连接上游文本节点'
      updateNodeData(nodeId, { status: 'error', error: msg })
      useGenerateStore.getState().patch(nodeId, { status: 'error', error: msg })
      return
    }
    const last = callState.lastRequest
    const req =
      last && last.mediaType === 'video'
        ? last
        : makeRequest()
    if (!req) return
    applyRunning(req)
    try {
      const res = callState.generationId
        ? await retryGeneration(callState.generationId)
        : await createGeneration(req)
      handleGenerationResponse(res, req)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      updateNodeData(nodeId, {
        status: 'error',
        error: msg,
        updatedAt: new Date().toISOString(),
      })
      useGenerateStore.getState().patch(nodeId, {
        status: 'error',
        error: msg,
      })
      showNotice(`视频生成失败：${msg}`)
      return
    }
  }

  const handleCancel = () => {
    clearGenerationSubscription()
    useGenerateStore.getState().cancelWaiting(nodeId)
    updateNodeData(nodeId, { status: 'idle', updatedAt: new Date().toISOString() })
  }

  return (
    <div
      style={{
        padding: '10px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        height: '100%',
        overflow: 'auto',
        boxSizing: 'border-box',
      }}
    >
      {/* 标题行 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            color: 'var(--text-h)',
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          <Film size={14} strokeWidth={1.6} />
          视频 Composer
        </span>
        <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>
          {activeVideoModelId} · {modeLabel}
        </span>
      </div>

      {/* 控件行 */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
          alignItems: 'flex-start',
        }}
      >
        <Field label="模型">
          <select
            style={selectStyle}
            value={activeVideoModelId}
            onChange={(e) => set({ model: e.target.value })}
            disabled={running}
          >
            {videoModelOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="模式">
          <select
            style={selectStyle}
            value={d.mode}
            onChange={(e) => set({ mode: e.target.value as VideoMode })}
            disabled={running}
          >
            {VIDEO_MODES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="比例">
          <select
            style={selectStyle}
            value={d.aspectRatio}
            onChange={(e) =>
              set({ aspectRatio: e.target.value as VideoAspectRatio })
            }
            disabled={running}
          >
            {VIDEO_ASPECT_RATIOS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </Field>

        <Field label="分辨率">
          <select
            style={selectStyle}
            value={d.resolution}
            onChange={(e) =>
              set({ resolution: e.target.value as VideoResolution })
            }
            disabled={running}
          >
            {VIDEO_RESOLUTIONS.map((r) => (
              <option
                key={r}
                value={r}
                disabled={(r === '1080P' || r === '4K') && !isVipModel}
              >
                {r}
                {(r === '1080P' || r === '4K') && !isVipModel
                  ? '（仅 VIP）'
                  : ''}
              </option>
            ))}
          </select>
        </Field>

        <Field label="秒数">
          <select
            style={selectStyle}
            value={d.durationSeconds}
            onChange={(e) =>
              set({ durationSeconds: Number(e.target.value) })
            }
            disabled={running}
          >
            {VIDEO_DURATIONS.map((s) => (
              <option key={s} value={s}>
                {s}s
              </option>
            ))}
          </select>
        </Field>

        <Field label="数量">
          <div style={{ display: 'flex', gap: 4 }}>
            {VIDEO_COUNTS.map((c) => (
              <button
                key={c}
                type="button"
                style={d.count === c ? activeBtn(inactiveBtn) : inactiveBtn}
                onClick={() => set({ count: c })}
                disabled={running}
              >
                {c}
              </button>
            ))}
          </div>
        </Field>

        <Field label="音频">
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              cursor: 'pointer',
              color: 'var(--text)',
              fontSize: 11,
              padding: '4px 0',
            }}
          >
            <input
              type="checkbox"
              checked={d.generateAudio}
              onChange={(e) => set({ generateAudio: e.target.checked })}
              disabled={running}
              style={{ cursor: running ? 'not-allowed' : 'pointer' }}
            />
            <Volume2 size={12} strokeWidth={1.6} />
            {d.generateAudio ? '开' : '关'}
          </label>
        </Field>
      </div>

      {/* Prompt + 提交 */}
      <div style={{ display: 'flex', gap: 8, flex: 1, minHeight: 48 }}>
        <textarea
          value={d.prompt}
          onChange={(e) => set({ prompt: e.target.value })}
          placeholder={
            upstreamPrompt
              ? '（已使用上游文本，可在此覆盖）'
              : '描述生成画面内容，支持 @ 引用素材…'
          }
          style={{
            flex: 1,
            resize: 'none',
            background: 'var(--bg-base)',
            color: 'var(--text-h)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '6px 8px',
            fontSize: 12,
            fontFamily: 'inherit',
            outline: 'none',
          }}
          disabled={running}
        />
        {running ? (
          <button
            type="button"
            onClick={handleCancel}
            style={{
              alignSelf: 'stretch',
              padding: '0 12px',
              background: 'transparent',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 12,
              fontFamily: 'inherit',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
            title="取消前端等待（不真正中断后端任务）"
          >
            <XCircle size={13} strokeWidth={1.8} />
            取消等待
          </button>
        ) : null}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitDisabled}
          style={{
            alignSelf: 'stretch',
            padding: '0 18px',
            background: submitDisabled ? '#2c2c2c' : 'var(--accent)',
            color: submitDisabled ? 'var(--text-dim)' : '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: submitDisabled ? 'not-allowed' : 'pointer',
            fontSize: 12,
            fontWeight: 500,
            fontFamily: 'inherit',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            transition: 'background 0.15s',
          }}
        >
          {running ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Sparkles size={13} strokeWidth={1.8} />
          )}
          {submitLabel}
        </button>
      </div>

      {callState.error && (
        <div
          style={{
            fontSize: 11,
            color: '#cfcfcf',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <AlertCircle size={13} style={{ flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {callState.error}
          </span>
          <button
            type="button"
            onClick={() => void handleRetry()}
            style={{
              background: 'transparent',
              border: '1px solid #cfcfcf',
              color: '#cfcfcf',
              borderRadius: 5,
              padding: '3px 9px',
              fontSize: 11,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontFamily: 'inherit',
            }}
          >
            <RotateCcw size={11} />
            重试
          </button>
        </div>
      )}

      {activeVideoModelNeedsJimeng && !isJimengConfigured && (
        <div style={{ fontSize: 11, color: '#cfcfcf' }}>
          未配置 dreamina CLI 时无法生成，请前往设置
        </div>
      )}

      {unsupportedModelMessage && (
        <div style={{ fontSize: 11, color: '#cfcfcf' }}>
          {unsupportedModelMessage}
        </div>
      )}

      {notice && (
        <div
          style={{
            fontSize: 11,
            color: 'var(--status-success)',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          {notice}
        </div>
      )}

      <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
        {hasInputImage ? '已读取上游图片，按图生视频提交' : '未连接图片时按文生视频提交'} · {activeVideoModelNeedsJimeng ? '使用本机 dreamina CLI 登录态' : '使用设置中的中转站视频接口'}
      </div>
    </div>
  )
}

export default VideoComposer
