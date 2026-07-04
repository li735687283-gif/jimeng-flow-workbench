// 即梦 Flow 前端 - Agent 面板组件
// 选中的节点不是 text/video 时，或未选中节点时，在底部面板渲染。
// 支持：输入想法 → 调用 API → 展示结构化结果 → 复制 → 写回 Prompt 节点。
// 参考 PRD 7.4、7.5、8.7、8.8、9.4、10.5、11.4、13.5。
// 集成约定：BottomPanel 在未选中节点或选中非 text/video 节点时渲染 <AgentPanel />。

import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  Sparkles,
  AlertCircle,
  Loader2,
  Copy,
  Check,
  CornerDownRight,
  Wand2,
  FileText,
} from 'lucide-react'
import type {
  PromptOptimizeRequest,
  PromptOptimizeResponse,
} from '@jimeng-flow/shared/agentMessage'
import { useCanvasStore } from '../state/canvasStore'
import { useAgentStore } from '../state/agentStore'
import { optimizePrompt } from '../api/agent'

/** 暗色风格调色板（与 TextComposer 一致，参考 PRD 13.1、13.5） */
const COLORS = {
  bg: '#1c1c20',
  bgInput: '#26262c',
  bgCard: '#232328',
  border: '#34343c',
  borderFocus: '#4a9eff',
  text: '#e4e4e7',
  textMuted: '#8a8a92',
  textDim: '#6a6a72',
  accent: '#4a9eff',
  accentHover: '#3a8eef',
  success: '#22c55e',
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
  overflow: 'hidden',
}

const inputRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'stretch',
  gap: 10,
  flexShrink: 0,
}

const textareaStyle: CSSProperties = {
  flex: 1,
  minHeight: 48,
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

const scrollAreaStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  paddingRight: 4,
}

const cardStyle: CSSProperties = {
  background: COLORS.bgCard,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 8,
  padding: '10px 12px',
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
}

const cardLabelStyle: CSSProperties = {
  fontSize: 10,
  color: COLORS.textMuted,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  display: 'flex',
  alignItems: 'center',
  gap: 4,
}

const cardContentStyle: CSSProperties = {
  fontSize: 12,
  color: COLORS.text,
  lineHeight: 1.6,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
}

const copyBtnStyle: CSSProperties = {
  background: 'transparent',
  border: `1px solid ${COLORS.border}`,
  color: COLORS.textMuted,
  borderRadius: 4,
  padding: '2px 6px',
  cursor: 'pointer',
  fontSize: 11,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  fontFamily: 'inherit',
}

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
  flexShrink: 0,
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
  fontFamily: 'inherit',
}

const footerRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexShrink: 0,
  flexWrap: 'wrap',
}

const selectWrapperStyle: CSSProperties = {
  position: 'relative',
  flex: 1,
  minWidth: 200,
}

const selectStyle: CSSProperties = {
  width: '100%',
  background: COLORS.bgInput,
  color: COLORS.text,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 6,
  padding: '6px 10px',
  fontSize: 12,
  fontFamily: 'inherit',
  cursor: 'pointer',
  outline: 'none',
  boxSizing: 'border-box',
  appearance: 'none',
}

const writeBackBtnStyle = (disabled: boolean): CSSProperties => ({
  flexShrink: 0,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 14px',
  background: disabled ? '#2a2a30' : COLORS.accent,
  color: disabled ? COLORS.textMuted : '#fff',
  border: 'none',
  borderRadius: 6,
  cursor: disabled ? 'not-allowed' : 'pointer',
  fontSize: 12,
  fontWeight: 500,
  fontFamily: 'inherit',
  transition: 'background 0.15s',
})

const hintStyle: CSSProperties = {
  color: COLORS.textDim,
  fontSize: 11,
  flexShrink: 0,
}

const titleRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  color: COLORS.text,
  fontSize: 12,
  fontWeight: 500,
  flexShrink: 0,
}

/** 复制按钮（带已复制状态反馈） */
function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const onClick = async () => {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setCopied(false), 1500)
    } catch {
      // 剪贴板不可用时静默失败
    }
  }

  return (
    <button type="button" style={copyBtnStyle} onClick={onClick} title="复制到剪贴板">
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {copied ? '已复制' : label ?? '复制'}
    </button>
  )
}

/** 单个结果卡片 */
function ResultCard({
  label,
  icon,
  content,
  copyable,
}: {
  label: string
  icon: React.ReactNode
  content: React.ReactNode
  copyable?: string
}) {
  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={cardLabelStyle}>
          {icon}
          {label}
        </span>
        {copyable && <CopyButton text={copyable} />}
      </div>
      <div style={cardContentStyle}>{content}</div>
    </div>
  )
}

export function AgentPanel() {
  const nodes = useCanvasStore((s) => s.nodes)
  const selectedNodeId = useCanvasStore((s) => s.selectedNodeId)
  const updateNodeData = useCanvasStore((s) => s.updateNodeData)
  const addNode = useCanvasStore((s) => s.addNode)
  const onConnect = useCanvasStore((s) => s.onConnect)

  const messages = useAgentStore((s) => s.messages)
  const loading = useAgentStore((s) => s.loading)
  const error = useAgentStore((s) => s.error)
  const lastResponse = useAgentStore((s) => s.lastResponse)
  const lastRequest = useAgentStore((s) => s.lastRequest)
  const submitPrompt = useAgentStore((s) => s.submitPrompt)
  const appendAssistant = useAgentStore((s) => s.appendAssistant)
  const setLoading = useAgentStore((s) => s.setLoading)
  const setError = useAgentStore((s) => s.setError)

  const [userIdea, setUserIdea] = useState('')
  const [targetPromptNodeId, setTargetPromptNodeId] = useState('')
  const [writeBackNotice, setWriteBackNotice] = useState<string | null>(null)
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current)
    }
  }, [])

  /** 可写回的 Prompt 节点（type==='agentPrompt' 或 'text'） */
  const promptNodes = useMemo(() => {
    return nodes.filter((n) => n.type === 'agentPrompt' || n.type === 'text')
  }, [nodes])

  /** 默认目标 Prompt 节点：优先当前选中节点，其次第一个可用节点 */
  useEffect(() => {
    if (targetPromptNodeId) return
    if (selectedNodeId) {
      const sel = nodes.find((n) => n.id === selectedNodeId)
      if (sel && (sel.type === 'agentPrompt' || sel.type === 'text')) {
        setTargetPromptNodeId(selectedNodeId)
        return
      }
    }
    if (promptNodes.length > 0) {
      setTargetPromptNodeId(promptNodes[0].id)
    }
  }, [selectedNodeId, nodes, promptNodes, targetPromptNodeId])

  /** 提交 Prompt 优化 */
  const submit = async () => {
    const idea = userIdea.trim()
    if (!idea || loading) return

    const contextNodeIds = promptNodes.map((n) => n.id)
    submitPrompt({
      userIdea: idea,
      contextNodeIds,
      selectedNodeId: selectedNodeId ?? undefined,
      targetPromptNodeId: targetPromptNodeId || undefined,
    })

    try {
      const req: PromptOptimizeRequest = {
        userIdea: idea,
        contextNodeIds,
        selectedNodeId: selectedNodeId ?? undefined,
        targetPromptNodeId: targetPromptNodeId || undefined,
      }
      const res: PromptOptimizeResponse = await optimizePrompt(req)
      appendAssistant(res)
      setUserIdea('')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
    }
  }

  /** 重试上次请求 */
  const retry = async () => {
    if (!lastRequest || loading) return
    setLoading(true)
    setError(undefined)
    try {
      const req: PromptOptimizeRequest = {
        userIdea: lastRequest.userIdea,
        contextNodeIds: lastRequest.contextNodeIds,
        selectedNodeId: lastRequest.selectedNodeId,
        targetPromptNodeId: lastRequest.targetPromptNodeId,
      }
      const res: PromptOptimizeResponse = await optimizePrompt(req)
      appendAssistant(res)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
    }
  }

  /** 写回 Prompt 节点 */
  const writeBack = () => {
    if (!lastResponse || !targetPromptNodeId) return
    const optimizedPrompt = lastResponse.optimizedPrompt
    updateNodeData(targetPromptNodeId, {
      input: optimizedPrompt,
      content: optimizedPrompt,
      promptCandidate: optimizedPrompt,
      status: 'success',
      updatedAt: new Date().toISOString(),
    } as Record<string, unknown>)
    setWriteBackNotice(`已写回节点 ${targetPromptNodeId}`)
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current)
    noticeTimerRef.current = setTimeout(() => setWriteBackNotice(null), 2500)
  }

  /** 创建 Prompt + Generate 改图分支，用户仍需手动点击生成 */
  const createEditBranch = () => {
    if (!lastResponse) return

    const selected = selectedNodeId
      ? nodes.find((n) => n.id === selectedNodeId)
      : undefined
    const basePosition = selected?.position ?? { x: 120, y: 120 }
    const promptNodeId = addNode('text', {
      x: basePosition.x + 280,
      y: basePosition.y + 10,
    })
    const generateNodeId = addNode('generate', {
      x: basePosition.x + 560,
      y: basePosition.y + 10,
    })
    if (!promptNodeId || !generateNodeId) return

    updateNodeData(promptNodeId, {
      title: '改图 Prompt',
      input: lastResponse.optimizedPrompt,
      content: lastResponse.optimizedPrompt,
      promptCandidate: lastResponse.optimizedPrompt,
      status: 'success',
      updatedAt: new Date().toISOString(),
    } as Record<string, unknown>)

    const selectedImageAssetId =
      selected?.type === 'image'
        ? (selected.data as { assetId?: string }).assetId
        : undefined

    updateNodeData(generateNodeId, {
      prompt: lastResponse.optimizedPrompt,
      promptSourceNodeId: promptNodeId,
      inputImageAssetIds: selectedImageAssetId ? [selectedImageAssetId] : [],
      status: 'idle',
      updatedAt: new Date().toISOString(),
    } as Record<string, unknown>)

    onConnect({
      source: promptNodeId,
      target: generateNodeId,
      sourceHandle: null,
      targetHandle: null,
    })
    if (selected?.type === 'image') {
      onConnect({
        source: selected.id,
        target: generateNodeId,
        sourceHandle: null,
        targetHandle: null,
      })
    }

    setWriteBackNotice(
      selected?.type === 'image'
        ? '已创建改图分支，检查参数后可点击生成'
        : '已创建 Prompt + Generate 分支',
    )
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current)
    noticeTimerRef.current = setTimeout(() => setWriteBackNotice(null), 2500)
  }

  const canSubmit = userIdea.trim().length > 0 && !loading
  const canWriteBack = !!lastResponse && !!targetPromptNodeId && !loading
  const canCreateBranch = !!lastResponse && !loading

  return (
    <div style={containerStyle}>
      {/* 标题行 */}
      <div style={titleRowStyle}>
        <Wand2 size={14} strokeWidth={1.6} />
        Agent 面板
        <span style={{ color: COLORS.textDim, fontSize: 11, fontWeight: 400 }}>
          · 把粗略想法整理成可执行的生图 Prompt
        </span>
      </div>

      {/* 输入区 */}
      <div style={inputRowStyle}>
        <textarea
          style={textareaStyle}
          placeholder="输入粗略想法，例如：保留人物姿势，把背景改成霓虹雨夜，服装更高级一点"
          value={userIdea}
          onChange={(e) => setUserIdea(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault()
              void submit()
            }
          }}
          disabled={loading}
        />
        <button
          type="button"
          style={submitBtnStyle(!canSubmit, loading)}
          disabled={!canSubmit}
          onClick={() => void submit()}
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {loading ? '优化中' : '优化 Prompt'}
        </button>
      </div>

      {/* 错误信息 + 重试 */}
      {error && (
        <div style={errorRowStyle}>
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{error}</span>
          <button type="button" style={retryBtnStyle} onClick={() => void retry()}>
            重试
          </button>
        </div>
      )}

      {/* 结果展示区（滚动） */}
      <div style={scrollAreaStyle}>
        {lastResponse ? (
          <>
            <ResultCard
              label="思考说明"
              icon={<Sparkles size={11} />}
              content={lastResponse.reasoning || '（无）'}
            />
            <ResultCard
              label="优化后的 Prompt"
              icon={<FileText size={11} />}
              content={lastResponse.optimizedPrompt}
              copyable={lastResponse.optimizedPrompt}
            />
            <ResultCard
              label="负面约束"
              icon={<AlertCircle size={11} />}
              content={lastResponse.negativePrompt || '（无）'}
              copyable={lastResponse.negativePrompt}
            />
            <ResultCard
              label="建议参数"
              icon={<Sparkles size={11} />}
              content={
                <SuggestedParamsView params={lastResponse.suggestedParams} />
              }
            />
            <ResultCard
              label="建议动作"
              icon={<CornerDownRight size={11} />}
              content={
                lastResponse.proposedActions.length > 0 ? (
                  <ul style={{ margin: 0, paddingLeft: 16 }}>
                    {lastResponse.proposedActions.map((a) => (
                      <li key={a.id} style={{ marginBottom: 2 }}>
                        <strong>{a.label}</strong>
                        <span style={{ color: COLORS.textMuted }}> · {a.type}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  '（无）'
                )
              }
            />
            {lastResponse.usedContextNodeIds.length > 0 && (
              <div style={{ ...cardContentStyle, color: COLORS.textMuted, fontSize: 11 }}>
                Agent 使用了以下节点上下文：{lastResponse.usedContextNodeIds.join(', ')}
              </div>
            )}
          </>
        ) : (
          !loading && (
            <div style={{ ...cardContentStyle, color: COLORS.textDim, textAlign: 'center', paddingTop: 20 }}>
              输入想法后点击"优化 Prompt"，Agent 会返回结构化的提示词建议。
            </div>
          )
        )}

        {/* 历史对话（简略展示） */}
        {messages.length > 0 && (
          <div style={{ ...cardContentStyle, color: COLORS.textDim, fontSize: 11, borderTop: `1px solid ${COLORS.border}`, paddingTop: 8 }}>
            对话历史（{messages.length} 条）
          </div>
        )}
      </div>

      {/* 底部：目标节点选择 + 写回 */}
      <div style={footerRowStyle}>
        <div style={selectWrapperStyle}>
          <select
            style={selectStyle}
            value={targetPromptNodeId}
            onChange={(e) => setTargetPromptNodeId(e.target.value)}
            disabled={loading || promptNodes.length === 0}
            title="选择要写回的 Prompt 节点"
          >
            {promptNodes.length === 0 && <option value="">无可用 Prompt 节点</option>}
            {promptNodes.map((n) => {
              const title =
                (n.data as unknown as { title?: string } | undefined)?.title ??
                n.id
              return (
                <option key={n.id} value={n.id}>
                  {title}（{n.type}）
                </option>
              )
            })}
          </select>
        </div>
        <button
          type="button"
          style={writeBackBtnStyle(!canWriteBack)}
          disabled={!canWriteBack}
          onClick={writeBack}
          title="把优化后的 Prompt 写回目标节点"
        >
          <CornerDownRight size={12} />
          写回 Prompt 节点
        </button>
        <button
          type="button"
          style={writeBackBtnStyle(!canCreateBranch)}
          disabled={!canCreateBranch}
          onClick={createEditBranch}
          title="创建新的 Prompt + 即梦生成分支"
        >
          <Sparkles size={12} />
          创建改图分支
        </button>
        {writeBackNotice && (
          <span style={{ color: COLORS.success, fontSize: 11 }}>{writeBackNotice}</span>
        )}
      </div>

      <div style={hintStyle}>
        Ctrl/⌘ + Enter 快速提交 · Agent 仅做 Prompt 优化，不会自动生成图片 · 实际调用需在设置中配置 LLM API key
      </div>
    </div>
  )
}

/** 建议参数展示 */
function SuggestedParamsView({
  params,
}: {
  params: PromptOptimizeResponse['suggestedParams']
}) {
  const entries = Object.entries(params ?? {}).filter(
    ([, v]) => v !== undefined && v !== null,
  )
  if (entries.length === 0) return <span>（无）</span>
  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      {entries.map(([k, v]) => (
        <span key={k}>
          <strong style={{ color: COLORS.textMuted }}>{k}:</strong> {String(v)}
        </span>
      ))}
    </div>
  )
}

export default AgentPanel
