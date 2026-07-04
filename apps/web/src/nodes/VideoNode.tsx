import { useState } from 'react'
import type { CSSProperties } from 'react'
import type { NodeProps } from '@xyflow/react'
import { Play, Film, Link2, Image as ImageIcon, AlertCircle } from 'lucide-react'
import { NodeWrapper } from './NodeWrapper'
import { useCanvasStore } from '../state/canvasStore'
import { useGenerateStore, IDLE_CALL_STATE } from '../state/generateStore'
import {
  VIDEO_MODES,
  mergeVideoDefaults,
  type VideoNodeData,
  type VideoMode,
} from '@jimeng-flow/shared/videoNode'
import type { BaseNodeData } from '../types/nodeTypes'

const quickBtnStyle = {
  flex: 1,
  padding: '4px 6px',
  background: 'var(--bg-base)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 10,
  fontFamily: 'inherit' as const,
  display: 'inline-flex' as const,
  alignItems: 'center',
  justifyContent: 'center',
  gap: 3,
  transition: 'background 0.15s, border-color 0.15s',
}

const STATUS_LABEL: Record<string, string> = {
  idle: '待生成',
  queued: '排队中',
  running: '生成中',
  success: '已生成',
  error: '失败',
}

const statusBadgeStyle = (status: string): CSSProperties => {
  if (status === 'success') {
    return {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 3,
      background: 'rgba(34, 197, 94, 0.12)',
      color: '#22c55e',
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
      background: 'rgba(239, 68, 68, 0.12)',
      color: '#ef4444',
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
      background: 'rgba(74, 158, 255, 0.12)',
      color: '#4a9eff',
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
    color: 'var(--text-dim)',
    fontSize: 10,
    padding: '2px 6px',
    borderRadius: 4,
    fontWeight: 500,
  }
}

const errorRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  background: 'rgba(239, 68, 68, 0.12)',
  border: '1px solid #ef4444',
  borderRadius: 4,
  padding: '4px 6px',
  color: '#ef4444',
  fontSize: 10,
}

export function VideoNode({ id, data, selected }: NodeProps) {
  const nodeData = mergeVideoDefaults(data as Partial<VideoNodeData>)
  const updateNodeData = useCanvasStore((s) => s.updateNodeData)
  const edges = useCanvasStore((s) => s.edges)
  const callState = useGenerateStore(
    (s) => s.states[id] ?? IDLE_CALL_STATE,
  )

  const connectedCount = edges.filter((e) => e.target === id).length
  const [hint, setHint] = useState<string | null>(null)

  const setMode = (mode: VideoMode) => {
    const label = VIDEO_MODES.find((m) => m.id === mode)?.label ?? mode
    updateNodeData(id, { mode })
    setHint(`已切换为「${label}」，请在底部 Composer 配置参数`)
    window.setTimeout(() => setHint(null), 2400)
  }

  const firstAssetId = nodeData.assetIds[0]
  const modeLabel =
    VIDEO_MODES.find((m) => m.id === nodeData.mode)?.label ?? nodeData.mode

  // 透传状态到 BaseNodeData（Inspector / NodeWrapper 通过 data.status 读取）
  const baseData = data as BaseNodeData
  const displayStatus =
    callState.status !== 'idle' ? callState.status : baseData.status ?? 'idle'
  const error = callState.error ?? nodeData.error

  return (
    <NodeWrapper
      icon={Film}
      title={nodeData.title}
      status={displayStatus as BaseNodeData['status']}
      selected={selected}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: 200 }}>
        {/* 视频预览区 */}
        <div
          className="node-preview-area"
          style={{
            width: 200,
            height: 112,
            background: '#000',
            borderRadius: 6,
            overflow: 'hidden',
            position: 'relative',
            padding: 0,
            margin: 0,
            minWidth: 0,
            minHeight: 0,
          }}
        >
          {firstAssetId ? (
            <video
              src={`/api/assets/${firstAssetId}/file`}
              controls
              muted
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
            />
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                height: '100%',
              }}
            >
              <Play
                size={24}
                strokeWidth={1.2}
                className="node-placeholder-icon"
              />
              <span className="node-placeholder" style={{ fontSize: 10 }}>
                视频节点（占位）
              </span>
            </div>
          )}
        </div>

        {/* 状态徽章 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 10,
          }}
        >
          <span style={statusBadgeStyle(displayStatus)}>
            {STATUS_LABEL[displayStatus] ?? displayStatus}
          </span>
          <span style={{ color: 'var(--text-dim)', fontSize: 10 }}>
            {modeLabel}
          </span>
        </div>

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
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            type="button"
            style={quickBtnStyle}
            onClick={() => setMode('image_to_video')}
            title="使用首帧图片生成视频"
          >
            <ImageIcon size={11} strokeWidth={1.6} />
            首帧
          </button>
          <button
            type="button"
            style={quickBtnStyle}
            onClick={() => setMode('first_last_frame')}
            title="使用首尾帧图片生成视频"
          >
            <Film size={11} strokeWidth={1.6} />
            首尾帧
          </button>
        </div>

        {/* 已连接输入 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            fontSize: 10,
            color: 'var(--text-dim)',
            gap: 3,
          }}
        >
          <Link2 size={10} strokeWidth={1.6} />
          已连接 {connectedCount} 个输入
        </div>

        {hint && (
          <div style={{ fontSize: 10, color: 'var(--accent)' }}>{hint}</div>
        )}
      </div>
    </NodeWrapper>
  )
}

export default VideoNode
