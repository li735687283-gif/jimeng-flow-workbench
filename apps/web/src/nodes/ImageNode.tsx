// 即梦 Flow 前端 - Image 节点
// 参考 PRD 6.2、7.3、13.9。
//
// MVP 能力：
// - 大面积图片预览（基于 data.assetId 通过 /api/assets/<id>/file 加载）
// - 空图片或加载失败显示居中图片占位图标
// - quick actions：图生图（右侧新建 Generate 节点并连线）、作为参考图（切换标记）、图片高清（disabled 未来能力）
// - data 字段：title, status, assetId?, assetPath?, asReference?

import { useEffect, useState } from 'react'
import type { CSSProperties, ReactElement } from 'react'
import type { NodeProps } from '@xyflow/react'
import {
  Image as ImageIcon,
  Wand2,
  Bookmark,
  Sparkles,
} from 'lucide-react'
import { NodeWrapper } from './NodeWrapper'
import type { BaseNodeData } from '../types/nodeTypes'
import { getAssetFileUrl } from '../api/assets'
import { useCanvasStore } from '../state/canvasStore'

interface ImageNodeData extends BaseNodeData {
  assetId?: string
  assetPath?: string
  asReference?: boolean
}

const CONTAINER_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  width: 200,
}

const PREVIEW_STYLE: CSSProperties = {
  minHeight: 120,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--bg-base)',
  borderRadius: 6,
  overflow: 'hidden',
}

const IMG_STYLE: CSSProperties = {
  display: 'block',
  width: '100%',
  height: 'auto',
  maxHeight: 200,
  objectFit: 'contain',
}

const PLACEHOLDER_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  minHeight: 120,
  color: 'var(--text-dim)',
}

const ACTIONS_STYLE: CSSProperties = {
  display: 'flex',
  gap: 4,
  justifyContent: 'center',
  flexWrap: 'wrap',
}

const BTN_BASE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '3px 8px',
  background: 'transparent',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: 5,
  cursor: 'pointer',
  fontSize: 11,
  fontFamily: 'inherit',
  lineHeight: 1.4,
  transition: 'background 0.12s, color 0.12s, border-color 0.12s',
}

const BTN_ACTIVE: CSSProperties = {
  ...BTN_BASE,
  background: 'var(--accent)',
  color: '#fff',
  borderColor: 'var(--accent)',
}

const BTN_DISABLED: CSSProperties = {
  ...BTN_BASE,
  opacity: 0.5,
  cursor: 'not-allowed',
}

function QuickAction({
  icon,
  label,
  onClick,
  disabled,
  active,
  title,
}: {
  icon: ReactElement
  label: string
  onClick?: () => void
  disabled?: boolean
  active?: boolean
  title: string
}) {
  const style = disabled ? BTN_DISABLED : active ? BTN_ACTIVE : BTN_BASE
  return (
    <button
      type="button"
      className="image-node-qa-btn"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={title}
      style={style}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}

export function ImageNode({ id, data, selected }: NodeProps) {
  const nodeData = data as ImageNodeData
  const [imgError, setImgError] = useState(false)

  // assetId 变化时重置加载错误状态，便于重新尝试加载新图片
  useEffect(() => {
    setImgError(false)
  }, [nodeData.assetId])

  const hasImage = !!nodeData.assetId && !imgError

  // 图生图：在当前节点右侧创建新的 Generate 节点，并把 Image → Generate 连线
  // position 不在 NodeProps 上，改在点击时从 store 读取当前节点位置。
  const handleImageToImage = () => {
    const store = useCanvasStore.getState()
    const current = store.nodes.find((n) => n.id === id)
    const pos = current?.position ?? { x: 0, y: 0 }
    const targetId = store.addNode('generate', {
      x: pos.x + 280,
      y: pos.y,
    })
    if (!targetId) return
    store.onConnect({
      source: id,
      target: targetId,
      sourceHandle: null,
      targetHandle: null,
    })
  }

  // 作为参考图：切换 asReference 标记
  const handleToggleReference = () => {
    useCanvasStore
      .getState()
      .updateNodeData(id, { asReference: !nodeData.asReference })
  }

  return (
    <NodeWrapper
      icon={ImageIcon}
      title={nodeData.title}
      status={nodeData.status}
      selected={selected}
    >
      <div className="image-node-container" style={CONTAINER_STYLE}>
        <div className="node-preview-area image-node-preview" style={PREVIEW_STYLE}>
          {hasImage && nodeData.assetId ? (
            <img
              src={getAssetFileUrl(nodeData.assetId)}
              alt={nodeData.title}
              onError={() => setImgError(true)}
              style={IMG_STYLE}
              draggable={false}
            />
          ) : (
            <div className="image-node-placeholder" style={PLACEHOLDER_STYLE}>
              <ImageIcon
                size={32}
                strokeWidth={1.2}
                className="node-placeholder-icon"
              />
              <span className="node-placeholder">
                {imgError ? '图片加载失败' : '图片节点（占位）'}
              </span>
            </div>
          )}
        </div>
        <div className="image-node-actions" style={ACTIONS_STYLE}>
          <QuickAction
            icon={<Wand2 size={12} strokeWidth={1.8} />}
            label="图生图"
            onClick={handleImageToImage}
            title="基于此图创建即梦生成节点"
          />
          <QuickAction
            icon={<Bookmark size={12} strokeWidth={1.8} />}
            label={nodeData.asReference ? '已参考' : '参考图'}
            onClick={handleToggleReference}
            active={nodeData.asReference === true}
            title="标记为参考图"
          />
          <QuickAction
            icon={<Sparkles size={12} strokeWidth={1.8} />}
            label="高清"
            disabled
            title="图片高清（即将支持）"
          />
        </div>
      </div>
    </NodeWrapper>
  )
}
