import { useState } from 'react'
import type { NodeProps } from '@xyflow/react'
import { Play, Film, Link2, Image as ImageIcon } from 'lucide-react'
import { NodeWrapper } from './NodeWrapper'
import { useCanvasStore } from '../state/canvasStore'
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

export function VideoNode({ id, data, selected }: NodeProps) {
  const nodeData = mergeVideoDefaults(data as Partial<VideoNodeData>)
  const updateNodeData = useCanvasStore((s) => s.updateNodeData)
  const edges = useCanvasStore((s) => s.edges)

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

  return (
    <NodeWrapper
      icon={Film}
      title={nodeData.title}
      status={baseData.status}
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

        {/* 已连接输入 + 当前模式 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 10,
            color: 'var(--text-dim)',
          }}
        >
          <span
            style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}
          >
            <Link2 size={10} strokeWidth={1.6} />
            已连接 {connectedCount} 个输入
          </span>
          <span>{modeLabel}</span>
        </div>

        {hint && (
          <div style={{ fontSize: 10, color: 'var(--accent)' }}>{hint}</div>
        )}
      </div>
    </NodeWrapper>
  )
}

export default VideoNode
