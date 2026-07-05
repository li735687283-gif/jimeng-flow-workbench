// 即梦 Flow 前端 - Generate Composer 组件
// 选中 Generate 节点时在底部面板渲染。
// 提供模型、尺寸、数量、seed 输入，提交调用 generations API。
// 成功后自动创建 Image 节点并连线（参考 PRD 7.2、8.3、9.3）。
//
// 集成约定：BottomPanel 在选中节点 type==='generate' 时渲染 <GenerateComposer nodeId={...} />。

import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import type { Node } from '@xyflow/react'
import {
  Sparkles,
  Send,
  AlertCircle,
  Loader2,
  RotateCcw,
  XCircle,
} from 'lucide-react'
import {
  IMAGE_MODELS,
  IMAGE_SIZES,
  IMAGE_COUNTS,
  mergeGenerateDefaults,
  type GenerateNodeData,
  type GenerationRequest,
  type GenerationResult,
} from '@jimeng-flow/shared/generateNode'
import type { TextNodeData } from '@jimeng-flow/shared/textNode'
import { useCanvasStore } from '../state/canvasStore'
import { useGenerateStore, IDLE_CALL_STATE } from '../state/generateStore'
import { useSettingsStore } from '../state/settingsStore'
import { createGeneration, retryGeneration } from '../api/generations'
import type { BaseNodeData } from '../types/nodeTypes'
import {
  getConfiguredDefaultImageModel,
  getConfiguredImageModels,
} from '../utils/imageModels'

interface GenerateComposerProps {
  /** 选中的 Generate 节点 id */
  nodeId: string
}

/** 暗色风格调色板（与 VideoComposer / TextComposer 保持一致） */
const COLORS = {
  bg: '#1d1d1d',
  bgInput: '#282828',
  border: '#373737',
  text: '#e5e5e5',
  textMuted: '#8d8d8d',
  textDim: '#5d5d5d',
  accent: '#d8d8d8',
  error: '#cfcfcf',
  errorBg: 'rgba(255, 255, 255, 0.08)',
}

const containerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  height: '100%',
  background: COLORS.bg,
  padding: '12px 16px',
  boxSizing: 'border-box',
  gap: 10,
}

const fieldLabelStyle: CSSProperties = {
  fontSize: 10,
  color: COLORS.textDim,
  marginBottom: 3,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}

const selectStyle: CSSProperties = {
  background: COLORS.bgInput,
  color: COLORS.text,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 6,
  padding: '6px 8px',
  fontSize: 12,
  fontFamily: 'inherit',
  cursor: 'pointer',
  outline: 'none',
  minWidth: 120,
}

const inputStyle: CSSProperties = {
  background: COLORS.bgInput,
  color: COLORS.text,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 6,
  padding: '6px 8px',
  fontSize: 12,
  fontFamily: 'inherit',
  outline: 'none',
  minWidth: 80,
  boxSizing: 'border-box',
}

const inactiveBtn: CSSProperties = {
  padding: '5px 10px',
  background: COLORS.bgInput,
  color: COLORS.text,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 12,
  fontFamily: 'inherit',
  minWidth: 32,
}

function activeBtn(base: CSSProperties): CSSProperties {
  return {
    ...base,
    background: COLORS.accent,
    color: '#fff',
    borderColor: COLORS.accent,
  }
}

const submitBtnBase: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '0 18px',
  background: COLORS.accent,
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 500,
  fontFamily: 'inherit',
  alignSelf: 'stretch',
  transition: 'background 0.15s',
}

const retryBtnStyle: CSSProperties = {
  background: 'transparent',
  border: `1px solid ${COLORS.error}`,
  color: COLORS.error,
  borderRadius: 6,
  padding: '4px 12px',
  fontSize: 12,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
}

const cancelBtnStyle: CSSProperties = {
  background: 'transparent',
  border: `1px solid ${COLORS.textDim}`,
  color: COLORS.textMuted,
  borderRadius: 6,
  padding: '4px 12px',
  fontSize: 12,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
}

const errorRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  background: COLORS.errorBg,
  border: `1px solid ${COLORS.error}`,
  borderRadius: 6,
  padding: '8px 12px',
  color: COLORS.error,
  fontSize: 12,
}

const hintStyle: CSSProperties = {
  color: COLORS.textMuted,
  fontSize: 11,
  flexShrink: 0,
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <span style={fieldLabelStyle}>{label}</span>
      {children}
    </div>
  )
}

/** 从上游连线查找 Prompt 文本（取第一个 text 节点的内容） */
function findUpstreamPrompt(
  currentId: string,
  nodes: Node[],
  edges: { source: string; target: string }[],
): { prompt: string; sourceNodeId?: string } {
  const upstreamIds = edges
    .filter((e) => e.target === currentId)
    .map((e) => e.source)
  for (const sid of upstreamIds) {
    const n = nodes.find((x) => x.id === sid)
    if (!n || n.type !== 'text') continue
    const d = n.data as Partial<TextNodeData>
    const text = d.promptCandidate || d.content || d.input || ''
    if (text && text.trim()) {
      return { prompt: text, sourceNodeId: sid }
    }
  }
  return { prompt: '' }
}

/** 从上游 Image 节点收集参考图 Asset id */
function findUpstreamImageAssetIds(
  currentId: string,
  nodes: Node[],
  edges: { source: string; target: string }[],
): string[] {
  const upstreamIds = edges
    .filter((e) => e.target === currentId)
    .map((e) => e.source)
  const assetIds: string[] = []
  for (const sid of upstreamIds) {
    const n = nodes.find((x) => x.id === sid)
    if (!n || n.type !== 'image') continue
    const d = n.data as { assetId?: string }
    if (typeof d.assetId === 'string' && d.assetId) {
      assetIds.push(d.assetId)
    }
  }
  return assetIds
}

export function GenerateComposer({ nodeId }: GenerateComposerProps) {
  const node = useCanvasStore((s) => s.nodes.find((n) => n.id === nodeId))
  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)
  const updateNodeData = useCanvasStore((s) => s.updateNodeData)
  const addNode = useCanvasStore((s) => s.addNode)
  const onConnect = useCanvasStore((s) => s.onConnect)

  const setStatus = useGenerateStore((s) => s.setStatus)
  const setError = useGenerateStore((s) => s.setError)
  const setLastRequest = useGenerateStore((s) => s.setLastRequest)
  const setGenerationId = useGenerateStore((s) => s.setGenerationId)
  const callState = useGenerateStore(
    (s) => s.states[nodeId] ?? IDLE_CALL_STATE,
  )
  const cancelWaiting = useGenerateStore((s) => s.cancelWaiting)

  // dreamina CLI 是否已配置，未配置时禁用生成
  const settings = useSettingsStore((s) => s.settings)
  const isJimengConfigured = useSettingsStore((s) => s.isJimengConfigured)
  const imageModelOptions = useMemo(
    () => getConfiguredImageModels(settings?.imageModels, settings?.llmModels),
    [settings?.imageModels, settings?.llmModels],
  )
  const defaultImageModelId = useMemo(
    () =>
      getConfiguredDefaultImageModel(
        settings?.imageModels,
        settings?.defaultModel,
        settings?.llmModels,
      ),
    [settings?.defaultModel, settings?.imageModels, settings?.llmModels],
  )

  // 本地 seed 输入（字符串，空表示随机）
  const [seedInput, setSeedInput] = useState('')

  // 同步节点 data 上的 seed 到输入框（首次或外部修改时）
  const seedValue = (node?.data as { seed?: number | null } | undefined)?.seed
  useEffect(() => {
    if (typeof seedValue === 'number') {
      setSeedInput(String(seedValue))
    } else {
      setSeedInput('')
    }
    // 仅依赖 nodeId 与 seedValue，避免反复触发
  }, [nodeId, seedValue])

  // 内存上游查询结果，避免每次渲染都 O(n*m) 遍历
  const upstreamPromptResult = useMemo(() => findUpstreamPrompt(nodeId, nodes, edges), [nodeId, nodes, edges])
  const upstreamImageAssetIdsList = useMemo(() => findUpstreamImageAssetIds(nodeId, nodes, edges), [nodeId, nodes, edges])

  if (!node) {
    return (
      <div className="bottom-panel-content">
        <span className="bottom-placeholder">未选中生成节点</span>
      </div>
    )
  }

  const d = mergeGenerateDefaults(
    node.data as unknown as Partial<GenerateNodeData>,
  )
  const activeImageModelId = imageModelOptions.some((model) => model.id === d.model)
    ? d.model
    : defaultImageModelId

  /** 把节点 data 部分更新写入 canvasStore */
  const set = (partial: Partial<GenerateNodeData>) =>
    updateNodeData(nodeId, partial as unknown as Partial<BaseNodeData>)

  const running = callState.status === 'queued' || callState.status === 'running'
  // 生成按钮禁用：运行中或未配置 dreamina CLI
  const submitDisabled = running || !isJimengConfigured

  /** 自动创建 Image 节点并连线（每张结果一个节点，水平排列） */
  const createImageNodesForResults = (results: GenerationResult[]) => {
    const current = useCanvasStore.getState().nodes.find((n) => n.id === nodeId)
    const baseX = (current?.position?.x ?? 0) + 280
    const baseY = current?.position?.y ?? 0
    const assetIds: string[] = []
    results.forEach((r, idx) => {
      if (!r.assetId) return
      assetIds.push(r.assetId)
      const imgNodeId = addNode('image', {
        x: baseX + idx * 240,
        y: baseY,
      })
      if (!imgNodeId) return
      updateNodeData(imgNodeId, { assetId: r.assetId } as Partial<BaseNodeData>)
      onConnect({
        source: nodeId,
        target: imgNodeId,
        sourceHandle: null,
        targetHandle: null,
      })
    })
    return assetIds
  }

  const submit = async () => {
    if (running) return

    // 解析上游 Prompt（若节点自身 prompt 为空，从上游 text 节点取）
    let prompt = d.prompt
    let promptSourceNodeId = d.promptSourceNodeId
    if (!prompt.trim()) {
      prompt = upstreamPromptResult.prompt
      promptSourceNodeId = upstreamPromptResult.sourceNodeId
    }
    if (!prompt.trim()) {
      setError(nodeId, 'Prompt 为空，请先在节点输入或连接上游文本节点')
      return
    }

    // 上游参考图
    const inputImageAssetIds =
      d.inputImageAssetIds.length > 0
        ? d.inputImageAssetIds
        : upstreamImageAssetIdsList

    // seed：空字符串 → null（随机）
    const trimmedSeed = seedInput.trim()
    const seedNum = trimmedSeed === '' ? null : Number(trimmedSeed)
    const seed =
      seedNum !== null && Number.isFinite(seedNum) ? seedNum : null

    const req: GenerationRequest = {
      flowId: 'local',
      nodeId,
      mediaType: 'image',
      prompt,
      inputImages: inputImageAssetIds,
      model: activeImageModelId,
      width: d.width,
      height: d.height,
      count: d.count,
      seed,
    }

    setLastRequest(nodeId, req)
    setStatus(nodeId, 'queued')
    setError(nodeId, undefined)
    set({
      prompt,
      promptSourceNodeId,
      inputImageAssetIds,
      seed,
      status: 'queued',
      error: undefined,
    })

    try {
      const res = await createGeneration(req)
      setGenerationId(nodeId, res.id)
      const results = res.results ?? []
      const savedAssetIds = createImageNodesForResults(results)
      const outputAssetIds =
        savedAssetIds.length > 0
          ? savedAssetIds
          : results
              .map((r) => r.assetId)
              .filter((x): x is string => typeof x === 'string' && !!x)

      setStatus(nodeId, res.status)
      if (res.error) setError(nodeId, res.error)
      set({
        status: res.status,
        error: res.error,
        outputAssetIds,
        generationId: res.id,
        updatedAt: new Date().toISOString(),
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(nodeId, msg)
      set({
        status: 'error',
        error: msg,
        updatedAt: new Date().toISOString(),
      })
    }
  }

  const retry = async () => {
    if (running) return
    // 优先用后端 generation id 重试；否则用 lastRequest 重新提交
    if (callState.generationId) {
      setStatus(nodeId, 'queued')
      setError(nodeId, undefined)
      set({ status: 'queued', error: undefined })
      try {
        const res = await retryGeneration(callState.generationId)
        setGenerationId(nodeId, res.id)
        const results = res.results ?? []
        const savedAssetIds = createImageNodesForResults(results)
        const outputAssetIds =
          savedAssetIds.length > 0
            ? savedAssetIds
            : results
                .map((r) => r.assetId)
                .filter((x): x is string => typeof x === 'string' && !!x)
        setStatus(nodeId, res.status)
        if (res.error) setError(nodeId, res.error)
        set({
          status: res.status,
          error: res.error,
          outputAssetIds,
          generationId: res.id,
          updatedAt: new Date().toISOString(),
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        setError(nodeId, msg)
        set({
          status: 'error',
          error: msg,
          updatedAt: new Date().toISOString(),
        })
      }
      return
    }
    // 没有后端 id，直接重走 submit
    void submit()
  }

  const cancel = () => {
    cancelWaiting(nodeId)
    set({ status: 'idle' })
  }

  const selectedSizeId = `${d.width}x${d.height}`
  const sizeLabel =
    IMAGE_SIZES.find((s) => s.id === selectedSizeId)?.label ?? selectedSizeId
  const modelLabel =
    IMAGE_MODELS.find((m) => m.id === activeImageModelId)?.label ?? activeImageModelId
  const hasUpstreamPrompt = !!upstreamPromptResult.prompt
  const hasInputImage =
    d.inputImageAssetIds.length > 0 ||
    upstreamImageAssetIdsList.length > 0

  return (
    <div style={containerStyle}>
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
            color: COLORS.text,
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          <Sparkles size={14} strokeWidth={1.6} />
          生成 Composer
        </span>
        <span style={{ color: COLORS.textDim, fontSize: 11 }}>
          {modelLabel} · {sizeLabel} · ×{d.count}
          {hasInputImage ? ' · 图生图' : ' · 文生图'}
        </span>
      </div>

      {/* 控件行 */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
          alignItems: 'flex-end',
        }}
      >
        <Field label="模型">
          <select
            style={selectStyle}
            value={activeImageModelId}
            onChange={(e) => set({ model: e.target.value })}
            disabled={running}
          >
            {imageModelOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="尺寸（宽×高）">
          <select
            style={selectStyle}
            value={selectedSizeId}
            onChange={(e) => {
              const found = IMAGE_SIZES.find((s) => s.id === e.target.value)
              if (found) {
                set({ width: found.width, height: found.height })
              }
            }}
            disabled={running}
          >
            {IMAGE_SIZES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="数量">
          <div style={{ display: 'flex', gap: 4 }}>
            {IMAGE_COUNTS.map((c) => (
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

        <Field label="Seed（空=随机）">
          <input
            type="number"
            style={inputStyle}
            value={seedInput}
            onChange={(e) => setSeedInput(e.target.value)}
            placeholder="随机"
            disabled={running}
          />
        </Field>
      </div>

      {/* Prompt + 提交 */}
      <div style={{ display: 'flex', gap: 8, flex: 1, minHeight: 48 }}>
        <textarea
          value={d.prompt}
          onChange={(e) => set({ prompt: e.target.value })}
          placeholder={
            hasUpstreamPrompt
              ? '（已使用上游 Prompt，可在此覆盖）'
              : '输入 Prompt，或先连接一个文本节点…'
          }
          style={{
            flex: 1,
            resize: 'none',
            background: COLORS.bgInput,
            color: COLORS.text,
            border: `1px solid ${COLORS.border}`,
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
            style={cancelBtnStyle}
            onClick={cancel}
            title="取消前端等待（不真正中断后端任务）"
          >
            <XCircle size={13} strokeWidth={1.8} />
            取消等待
          </button>
        ) : null}
        <button
          type="button"
          style={{
            ...submitBtnBase,
            background: submitDisabled ? '#2c2c2c' : COLORS.accent,
            color: submitDisabled ? COLORS.textMuted : '#fff',
            cursor: submitDisabled ? 'not-allowed' : 'pointer',
          }}
          disabled={submitDisabled}
          onClick={() => void submit()}
        >
          {running ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Send size={13} />
          )}
          {running ? '生成中' : '生成'}
        </button>
      </div>

      {/* 错误信息 + 重试 */}
      {callState.error && (
        <div style={errorRowStyle}>
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {callState.error}
          </span>
          <button
            type="button"
            style={retryBtnStyle}
            onClick={() => void retry()}
          >
            <RotateCcw size={12} />
            重试
          </button>
        </div>
      )}

      {!isJimengConfigured && (
        <div style={{ ...hintStyle, color: COLORS.error }}>
          未配置 dreamina CLI 时无法生成，请前往设置
        </div>
      )}

      <div style={hintStyle}>
        Ctrl/⌘ + Enter 快速提交 · 文生图：仅 Prompt · 图生图：连接 Image 节点 · 使用本机 dreamina CLI 登录态
      </div>
    </div>
  )
}

export default GenerateComposer
