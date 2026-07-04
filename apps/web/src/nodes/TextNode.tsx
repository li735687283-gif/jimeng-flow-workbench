// 即梦 Flow 前端 - Text/Prompt 节点组件
// 替换 Task 4 的 stub 实现，保留默认导出名 TextNode（registry 依赖此名）。
// 参考 PRD 6.2、7.6、8.9、11.5、13.8（文本节点 UI 参考）、12.2。
// 使用 NodeWrapper 包裹，保持标题在卡片外上方、状态指示等与其它节点一致。

import { useState } from 'react'
import type { CSSProperties } from 'react'
import type { NodeProps } from '@xyflow/react'
import { FileText, Pencil, ImageIcon, Sparkles } from 'lucide-react'
import { NodeWrapper } from './NodeWrapper'
import type { BaseNodeData } from '../types/nodeTypes'
import type { TextNodeData } from '@jimeng-flow/shared/textNode'
import { useCanvasStore } from '../state/canvasStore'

/** 暗色风格调色板（与 TextComposer 保持一致） */
const COLORS = {
  bg: '#1c1c20',
  bgInput: '#26262c',
  border: '#34343c',
  text: '#e4e4e7',
  textMuted: '#8a8a92',
  textDim: '#5a5a62',
  accent: '#4a9eff',
  accentBg: 'rgba(74, 158, 255, 0.12)',
  promptBg: 'rgba(168, 85, 247, 0.14)',
  promptText: '#c084fc',
  jsonBg: '#0f0f12',
  error: '#ef4444',
}

const contentAreaStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '10px 12px',
  overflow: 'hidden',
}

const emptyStateStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 6,
  color: COLORS.textDim,
  fontSize: 11,
}

const summaryStyle = (isJson: boolean): CSSProperties => ({
  width: '100%',
  color: COLORS.text,
  fontSize: 12,
  lineHeight: 1.5,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  overflow: 'hidden',
  display: '-webkit-box',
  WebkitLineClamp: 4,
  WebkitBoxOrient: 'vertical',
  background: isJson ? COLORS.jsonBg : 'transparent',
  border: isJson ? `1px solid ${COLORS.border}` : 'none',
  borderRadius: isJson ? 6 : 0,
  padding: isJson ? '8px 10px' : 0,
  fontFamily: isJson ? 'ui-monospace, "SF Mono", Menlo, monospace' : 'inherit',
})

const tagsRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 4,
  marginTop: 6,
}

const modelTagStyle: CSSProperties = {
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

const promptTagStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 3,
  background: COLORS.promptBg,
  color: COLORS.promptText,
  fontSize: 10,
  padding: '2px 6px',
  borderRadius: 4,
  fontWeight: 500,
}

const quickActionsStyle: CSSProperties = {
  display: 'flex',
  gap: 4,
  marginTop: 8,
  paddingTop: 8,
  borderTop: `1px solid ${COLORS.border}`,
}

const quickBtnStyle = (disabled: boolean): CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  background: 'transparent',
  color: disabled ? COLORS.textDim : COLORS.textMuted,
  border: 'none',
  fontSize: 10,
  padding: '3px 6px',
  borderRadius: 4,
  cursor: disabled ? 'not-allowed' : 'pointer',
  transition: 'color 0.15s',
})

const editAreaStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  flex: 1,
  minHeight: 0,
}

const editTextareaStyle: CSSProperties = {
  flex: 1,
  minHeight: 60,
  background: COLORS.bgInput,
  color: COLORS.text,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 6,
  padding: '6px 8px',
  fontSize: 12,
  fontFamily: 'inherit',
  resize: 'none',
  outline: 'none',
  boxSizing: 'border-box',
}

const editActionsStyle: CSSProperties = {
  display: 'flex',
  gap: 6,
  justifyContent: 'flex-end',
}

const editBtnBase: CSSProperties = {
  border: 'none',
  borderRadius: 4,
  padding: '3px 10px',
  fontSize: 11,
  cursor: 'pointer',
}

const SUMMARY_LIMIT = 80

function truncate(text: string, limit: number): string {
  if (text.length <= limit) return text
  return `${text.slice(0, limit)}…`
}

export function TextNode({ id, data, selected }: NodeProps) {
  const nodeData = data as BaseNodeData & Partial<TextNodeData>
  const updateNodeData = useCanvasStore((s) => s.updateNodeData)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const content = nodeData.content ?? ''
  const contentType = nodeData.contentType ?? 'text'
  const status = nodeData.status ?? 'idle'
  const llmModel = nodeData.llm?.model
  const promptCandidate = nodeData.promptCandidate
  const isJson = contentType === 'json'
  const isEmpty = content.length === 0

  const startEdit = () => {
    setDraft(content)
    setEditing(true)
  }

  const cancelEdit = () => {
    setEditing(false)
    setDraft('')
  }

  const saveEdit = () => {
    updateNodeData(id, {
      content: draft,
      contentType: 'text',
      promptCandidate: undefined,
      status: 'success',
      error: undefined,
      updatedAt: new Date().toISOString(),
    } as Partial<TextNodeData>)
    setEditing(false)
    setDraft('')
  }

  return (
    <NodeWrapper
      icon={FileText}
      title={nodeData.title}
      status={status}
      selected={selected}
    >
      {editing ? (
        <div style={editAreaStyle}>
          <textarea
            style={editTextareaStyle}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="手写文本内容..."
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault()
                saveEdit()
              }
              if (e.key === 'Escape') {
                e.preventDefault()
                cancelEdit()
              }
            }}
          />
          <div style={editActionsStyle}>
            <button
              type="button"
              style={{ ...editBtnBase, background: '#2a2a30', color: COLORS.textMuted }}
              onClick={cancelEdit}
            >
              取消
            </button>
            <button
              type="button"
              style={{ ...editBtnBase, background: COLORS.accent, color: '#fff' }}
              onClick={saveEdit}
              disabled={draft.trim().length === 0}
            >
              保存
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={contentAreaStyle}>
            {isEmpty ? (
              <div style={emptyStateStyle}>
                <FileText size={20} strokeWidth={1.5} />
                <span>点击底部 Composer 输入</span>
              </div>
            ) : (
              <div style={{ width: '100%', overflow: 'hidden' }}>
                <div style={summaryStyle(isJson)} title={content}>
                  {truncate(content, SUMMARY_LIMIT * 4)}
                </div>
                <div style={tagsRowStyle}>
                  {llmModel && (
                    <span style={modelTagStyle}>
                      <Sparkles size={9} />
                      {llmModel}
                    </span>
                  )}
                  {promptCandidate && (
                    <span style={promptTagStyle} title={promptCandidate}>
                      <Sparkles size={9} />
                      用作 Prompt
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          <div style={quickActionsStyle}>
            <button
              type="button"
              style={quickBtnStyle(false)}
              onClick={startEdit}
              title="手写文本内容"
            >
              <Pencil size={10} />
              自己编写内容
            </button>
            <button
              type="button"
              style={quickBtnStyle(true)}
              disabled
              title="未来能力（M2）"
            >
              <ImageIcon size={10} />
              图片反推提示词
            </button>
          </div>
        </div>
      )}
    </NodeWrapper>
  )
}
