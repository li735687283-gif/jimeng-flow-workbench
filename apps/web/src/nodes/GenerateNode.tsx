// 即梦 Flow 前端 - Jimeng Image Generate 节点
// 替换 Task 4 的 stub 实现，保留默认导出名 GenerateNode（registry 依赖此名）。
// 参考 PRD 6.2（节点定义）、7.2（文生图流程）、8.3（生成任务状态）、11.7（数据模型）、13.12（节点状态）。
// 使用 NodeWrapper 包裹，保持标题在卡片外上方、状态指示等与其它节点一致。

import type { CSSProperties } from 'react'
import type { NodeProps } from '@xyflow/react'
import {
  Sparkles,
  Image as ImageIcon,
  Wand2,
  RotateCcw,
  AlertCircle,
} from 'lucide-react'
import { NodeWrapper } from './NodeWrapper'
import {
  IMAGE_MODELS,
  IMAGE_SIZES,
  mergeGenerateDefaults,
  type GenerateNodeData,
} from '@jimeng-flow/shared/generateNode'
import type { BaseNodeData } from '../types/nodeTypes'
import { useCanvasStore } from '../state/canvasStore'
import { useGenerateStore, IDLE_CALL_STATE } from '../state/generateStore'
import { getAssetFileUrl } from '../api/assets'

/** 暗色风格调色板 */
const COLORS = {
  bg: '#1d1d1d',
  bgInput: '#282828',
  border: '#373737',
  text: '#e5e5e5',
  textMuted: '#8d8d8d',
  textDim: '#5d5d5d',
  accent: '#ededed',
  accentBg: 'rgba(255, 255, 255, 0.09)',
  error: '#cfcfcf',
  errorBg: 'rgba(255, 255, 255, 0.08)',
  success: '#ededed',
  successBg: 'rgba(255, 255, 255, 0.12)',
}

const containerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  width: 220,
}

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  fontSize: 10,
  color: COLORS.textMuted,
}

const tagStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 3,
  background: COLORS.accentBg,
  color: COLORS.accent,
  fontSize: 10,
  padding: '2px 6px',
  borderRadius: 4,
  fontWeight: 500,
}

const statusBadgeStyle = (status: string): CSSProperties => {
  if (status === 'success') {
    return {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 3,
      background: COLORS.successBg,
      color: COLORS.success,
      fontSize: 10,
      padding: '2px 6px',
      borderRadius: 4,
      fontWeight: 500,
    }
  }
  if (status === 'error') {
    return {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 3,
      background: COLORS.errorBg,
      color: COLORS.error,
      fontSize: 10,
      padding: '2px 6px',
      borderRadius: 4,
      fontWeight: 500,
    }
  }
  if (status === 'running' || status === 'queued') {
    return {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 3,
      background: COLORS.accentBg,
      color: COLORS.accent,
      fontSize: 10,
      padding: '2px 6px',
      borderRadius: 4,
      fontWeight: 500,
    }
  }
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 3,
    background: 'transparent',
    color: COLORS.textDim,
    fontSize: 10,
    padding: '2px 6px',
    borderRadius: 4,
    fontWeight: 500,
  }
}

const quickActionsStyle: CSSProperties = {
  display: 'flex',
  gap: 4,
  marginTop: 6,
  paddingTop: 6,
  borderTop: `1px solid ${COLORS.border}`,
}

const quickBtnStyle: CSSProperties = {
  flex: 1,
  padding: '4px 6px',
  background: COLORS.bgInput,
  color: COLORS.text,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 10,
  fontFamily: 'inherit',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 3,
  transition: 'background 0.15s, border-color 0.15s',
}

const errorRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  background: COLORS.errorBg,
  border: `1px solid ${COLORS.error}`,
  borderRadius: 4,
  padding: '4px 6px',
  color: COLORS.error,
  fontSize: 10,
}

const STATUS_LABEL: Record<string, string> = {
  idle: '待生成',
  queued: '排队中',
  running: '生成中',
  success: '已生成',
  error: '失败',
}

const SUMMARY_LIMIT = 60

function truncate(text: string, limit: number): string {
  if (text.length <= limit) return text
  return `${text.slice(0, limit)}…`
}

export function GenerateNode({ id, data, selected }: NodeProps) {
  const nodeData = mergeGenerateDefaults(
    data as unknown as Partial<GenerateNodeData>,
  )
  const baseData = data as BaseNodeData
  const updateNodeData = useCanvasStore((s) => s.updateNodeData)
  const addNode = useCanvasStore((s) => s.addNode)
  const onConnect = useCanvasStore((s) => s.onConnect)
  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)
  const callState = useGenerateStore(
    (s) => s.states[id] ?? IDLE_CALL_STATE,
  )

  // 节点显示状态：优先使用 generateStore 的状态（更细粒度），否则用节点 data 上的
  const displayStatus =
    callState.status !== 'idle' ? callState.status : baseData.status ?? 'idle'
  const error = callState.error ?? nodeData.error
  const outputCount = nodeData.outputAssetIds.length
  const firstAssetId = nodeData.outputAssetIds[0]

  // 模型/尺寸/数量 label
  const modelLabel =
    IMAGE_MODELS.find((m) => m.id === nodeData.model)?.label ?? nodeData.model
  const sizeLabel =
    IMAGE_SIZES.find((s) => s.id === `${nodeData.width}x${nodeData.height}`)
      ?.label ?? `${nodeData.width}×${nodeData.height}`

  // 图生图：在当前节点右侧创建 Image 节点并连线（作为参考图输入）
  const handleImageToImage = () => {
    const current = useCanvasStore.getState().nodes.find((n) => n.id === id)
    const pos = current?.position ?? { x: 0, y: 0 }
    const imgNodeId = addNode('image', {
      x: pos.x - 280,
      y: pos.y,
    })
    if (!imgNodeId) return
    onConnect({
      source: imgNodeId,
      target: id,
      sourceHandle: null,
      targetHandle: null,
    })
  }

  // 重试：把节点状态切换为 idle，让用户重新提交
  const handleRetry = () => {
    useGenerateStore.getState().reset(id)
    updateNodeData(id, {
      status: 'idle',
      error: undefined,
    } as Partial<BaseNodeData>)
  }

  // 选中时显示预览（若有结果）
  const hasResult = !!firstAssetId

  // 已连接输入数
  const connectedCount = edges.filter((e) => e.target === id).length
  const hasUpstreamImage = nodes.some((n) => {
    if (n.type !== 'image') return false
    return edges.some((e) => e.source === n.id && e.target === id)
  })

  return (
    <NodeWrapper
      icon={Sparkles}
      title={nodeData.title}
      status={displayStatus as BaseNodeData['status']}
      selected={selected}
      nodeId={id}
    >
      <div style={containerStyle}>
        {/* 预览区：成功后展示第一张图 */}
        <div
          style={{
            width: '100%',
            minHeight: 80,
            background: COLORS.bg,
            borderRadius: 6,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: `1px solid ${COLORS.border}`,
          }}
        >
          {hasResult ? (
            <img
              src={getAssetFileUrl(firstAssetId)}
              alt={nodeData.title}
              style={{
                display: 'block',
                width: '100%',
                height: 'auto',
                maxHeight: 140,
                objectFit: 'contain',
              }}
              draggable={false}
            />
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                color: COLORS.textDim,
                padding: '12px 8px',
              }}
            >
              <Sparkles
                size={24}
                strokeWidth={1.2}
                className="node-placeholder-icon"
              />
              <span style={{ fontSize: 10 }}>
                {displayStatus === 'running' || displayStatus === 'queued'
                  ? '生成中…'
                  : '即梦生成（占位）'}
              </span>
            </div>
          )}
        </div>

        {/* 参数概览 */}
        <div style={rowStyle}>
          <span style={tagStyle}>{modelLabel}</span>
          <span style={statusBadgeStyle(displayStatus)}>
            {STATUS_LABEL[displayStatus] ?? displayStatus}
          </span>
        </div>
        <div style={{ ...rowStyle, fontSize: 10 }}>
          <span>{sizeLabel}</span>
          <span>×{nodeData.count}</span>
        </div>
        {typeof nodeData.seed === 'number' ? (
          <div style={{ ...rowStyle, fontSize: 10 }}>
            <span>seed: {nodeData.seed}</span>
            <span>{hasUpstreamImage ? '图生图' : '文生图'}</span>
          </div>
        ) : (
          <div style={{ ...rowStyle, fontSize: 10 }}>
            <span>seed: 随机</span>
            <span>{hasUpstreamImage ? '图生图' : '文生图'}</span>
          </div>
        )}

        {/* 已连接输入与输出 */}
        <div style={{ ...rowStyle, fontSize: 10, color: COLORS.textDim }}>
          <span>输入 {connectedCount}</span>
          <span>输出 {outputCount}</span>
        </div>

        {/* Prompt 摘要 */}
        {nodeData.prompt ? (
          <div
            style={{
              fontSize: 10,
              color: COLORS.textMuted,
              lineHeight: 1.4,
              background: COLORS.bgInput,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 4,
              padding: '4px 6px',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
            title={nodeData.prompt}
          >
            {truncate(nodeData.prompt, SUMMARY_LIMIT)}
          </div>
        ) : null}

        {/* 错误信息 */}
        {error ? (
          <div style={errorRowStyle}>
            <AlertCircle size={11} style={{ flexShrink: 0 }} />
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={error}
            >
              {error}
            </span>
          </div>
        ) : null}

        {/* Quick actions */}
        <div style={quickActionsStyle}>
          <button
            type="button"
            style={quickBtnStyle}
            onClick={handleImageToImage}
            title="在左侧创建 Image 节点作为参考图输入"
          >
            <ImageIcon size={11} strokeWidth={1.6} />
            图生图
          </button>
          <button
            type="button"
            style={quickBtnStyle}
            onClick={handleRetry}
            title="重置节点为 idle，重新提交请在底部 Composer"
            disabled={displayStatus === 'idle'}
          >
            <RotateCcw size={11} strokeWidth={1.6} />
            重试
          </button>
          <button
            type="button"
            style={{ ...quickBtnStyle, opacity: 0.5, cursor: 'not-allowed' }}
            disabled
            title="未来能力（M2）"
          >
            <Wand2 size={11} strokeWidth={1.6} />
            高清
          </button>
        </div>
      </div>
    </NodeWrapper>
  )
}

export default GenerateNode
