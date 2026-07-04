// 即梦 Flow 前端 - 文本 Composer 组件
// 选中文本节点时在底部面板渲染，提供 LLM 模型选择 + 输入 + 提交。
// 参考 PRD 7.6、8.9、13.8（文本节点 UI 参考）、12.2（错误处理）。
// 集成约定：BottomPanel 在选中节点 type==='text' 时渲染 <TextComposer nodeId={...} />。

import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Send, AlertCircle, Loader2, ChevronDown } from 'lucide-react'
import type { LlmModelInfo, TextNodeData } from '@jimeng-flow/shared/textNode'
import { useCanvasStore } from '../state/canvasStore'
import { useTextNodeStore } from '../state/textNodeStore'
import { listLlmModels, runTextNode } from '../api/llm'

interface TextComposerProps {
  /** 选中的文本节点 id */
  nodeId: string
}

/** 暗色风格调色板（专业创作工具气质，参考 PRD 13.1） */
const COLORS = {
  bg: '#1c1c20',
  bgInput: '#26262c',
  border: '#34343c',
  borderFocus: '#4a9eff',
  text: '#e4e4e7',
  textMuted: '#8a8a92',
  accent: '#4a9eff',
  accentHover: '#3a8eef',
  error: '#ef4444',
  errorBg: 'rgba(239, 68, 68, 0.12)',
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

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'stretch',
  gap: 10,
  flex: 1,
  minHeight: 0,
}

const selectWrapperStyle: CSSProperties = {
  position: 'relative',
  flexShrink: 0,
  width: 220,
}

const selectStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  background: COLORS.bgInput,
  color: COLORS.text,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 8,
  padding: '8px 30px 8px 12px',
  fontSize: 13,
  appearance: 'none',
  cursor: 'pointer',
  outline: 'none',
  boxSizing: 'border-box',
}

const chevronStyle: CSSProperties = {
  position: 'absolute',
  right: 10,
  top: '50%',
  transform: 'translateY(-50%)',
  pointerEvents: 'none',
  color: COLORS.textMuted,
}

const textareaStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  background: COLORS.bgInput,
  color: COLORS.text,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 8,
  padding: '10px 12px',
  fontSize: 13,
  fontFamily: 'inherit',
  resize: 'none',
  outline: 'none',
  lineHeight: 1.5,
  boxSizing: 'border-box',
}

const submitBtnStyle = (disabled: boolean, loading: boolean): CSSProperties => ({
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '0 18px',
  background: disabled || loading ? '#2a2a30' : COLORS.accent,
  color: disabled || loading ? COLORS.textMuted : '#fff',
  border: 'none',
  borderRadius: 8,
  cursor: disabled || loading ? 'not-allowed' : 'pointer',
  fontSize: 13,
  fontWeight: 500,
  transition: 'background 0.15s',
})

const errorRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  background: COLORS.errorBg,
  border: `1px solid ${COLORS.error}`,
  borderRadius: 8,
  padding: '8px 12px',
  color: COLORS.error,
  fontSize: 12,
}

const retryBtnStyle: CSSProperties = {
  background: 'transparent',
  border: `1px solid ${COLORS.error}`,
  color: COLORS.error,
  borderRadius: 6,
  padding: '4px 10px',
  fontSize: 12,
  cursor: 'pointer',
  marginLeft: 'auto',
}

const hintStyle: CSSProperties = {
  color: COLORS.textMuted,
  fontSize: 12,
  flexShrink: 0,
}

export function TextComposer({ nodeId }: TextComposerProps) {
  const node = useCanvasStore((s) => s.nodes.find((n) => n.id === nodeId))
  const updateNodeData = useCanvasStore((s) => s.updateNodeData)

  const setLoading = useTextNodeStore((s) => s.setLoading)
  const setError = useTextNodeStore((s) => s.setError)
  const setLastRequest = useTextNodeStore((s) => s.setLastRequest)
  const callState = useTextNodeStore((s) => s.states[nodeId] ?? { loading: false })

  const [models, setModels] = useState<LlmModelInfo[]>([])
  const [model, setModel] = useState('')
  const [message, setMessage] = useState('')
  const [modelsLoading, setModelsLoading] = useState(true)
  const fetchedRef = useRef(false)

  // 拉取模型列表（仅一次）
  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true
    listLlmModels()
      .then((list) => {
        setModels(list)
        setModelsLoading(false)
      })
      .catch(() => {
        setModelsLoading(false)
      })
  }, [])

  // 初始化选中模型：优先节点已记录的模型，否则取列表第一项
  useEffect(() => {
    if (model) return
    if (modelsLoading) return
    const nodeModel = (node?.data as unknown as TextNodeData | undefined)?.llm?.model
    if (nodeModel) {
      setModel(nodeModel)
      return
    }
    if (models.length > 0) {
      setModel(models[0].id)
    }
  }, [models, modelsLoading, node, model])

  // 节点切换时重置输入
  useEffect(() => {
    setMessage('')
  }, [nodeId])

  const loading = callState.loading

  const submit = async (override?: { model: string; message: string }) => {
    const useModel = override?.model ?? model
    const useMessage = override?.message ?? message
    if (!useModel || !useMessage.trim() || loading) return

    setLoading(nodeId, true)
    setError(nodeId, undefined)
    setLastRequest(nodeId, { model: useModel, message: useMessage, outputFormat: 'auto' })
    updateNodeData(nodeId, { status: 'running', error: undefined } as Partial<TextNodeData>)

    try {
      const res = await runTextNode(nodeId, {
        model: useModel,
        message: useMessage,
        outputFormat: 'auto',
      })
      updateNodeData(nodeId, {
        input: useMessage,
        content: res.content,
        contentType: res.contentType,
        promptCandidate: res.promptCandidate,
        status: 'success',
        error: undefined,
        llm: {
          provider: 'openai-compatible',
          model: res.model,
          baseUrl: '',
        },
        updatedAt: new Date().toISOString(),
      } as Partial<TextNodeData>)
      setLoading(nodeId, false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(nodeId, msg)
      updateNodeData(nodeId, {
        status: 'error',
        error: msg,
        updatedAt: new Date().toISOString(),
      } as Partial<TextNodeData>)
    }
  }

  const retry = () => {
    const last = callState.lastRequest
    if (!last) return
    setMessage(last.message)
    setModel(last.model)
    void submit({ model: last.model, message: last.message })
  }

  const canSubmit = !!model && message.trim().length > 0 && !loading

  return (
    <div style={containerStyle}>
      <div style={rowStyle}>
        {/* 左侧：LLM 模型下拉 */}
        <div style={selectWrapperStyle}>
          <select
            style={selectStyle}
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={loading || modelsLoading}
            title="选择 LLM 模型"
          >
            {modelsLoading && <option value="">加载模型...</option>}
            {!modelsLoading && models.length === 0 && (
              <option value="">无可用模型</option>
            )}
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
                {m.estimatedLatency ? ` · ${m.estimatedLatency}` : ''}
              </option>
            ))}
          </select>
          <ChevronDown size={14} style={chevronStyle} />
        </div>

        {/* 中间：输入框 */}
        <textarea
          style={textareaStyle}
          placeholder="输入自然语言需求，例如：一个女孩在风中飞舞"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault()
              void submit()
            }
          }}
          disabled={loading}
        />

        {/* 右侧：提交按钮 */}
        <button
          type="button"
          style={submitBtnStyle(!canSubmit, loading)}
          disabled={!canSubmit}
          onClick={() => void submit()}
        >
          {loading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Send size={14} />
          )}
          {loading ? '生成中' : '提交'}
        </button>
      </div>

      {/* 错误信息 + 重试 */}
      {callState.error && (
        <div style={errorRowStyle}>
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {callState.error}
          </span>
          <button type="button" style={retryBtnStyle} onClick={retry}>
            重试
          </button>
        </div>
      )}

      <div style={hintStyle}>
        Ctrl/⌘ + Enter 快速提交 · 返回内容支持纯文本和 JSON 展示 · 实际调用需在设置中配置 LLM API key
      </div>
    </div>
  )
}
