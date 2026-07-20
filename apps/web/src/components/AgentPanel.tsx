import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import {
  ArrowUp,
  AtSign,
  Bot,
  Check,
  ChevronDown,
  History,
  Loader2,
  MousePointer2,
  Plus,
  X,
} from 'lucide-react'
import type {
  AgentMessage,
  AgentToolCall,
} from '@jimeng-flow/shared/agentMessage'
import { sendAgentChat } from '../api/agent'
import { startCodexLogin } from '../api/settings'
import { AgentConversationHistory } from './AgentConversationHistory'
import { SecondaryMenuSelect } from './menus/SecondaryMenuSelect'
import { buildAgentChatHistory, useAgentStore } from '../state/agentStore'
import { useCanvasStore } from '../state/canvasStore'
import { useFlowStore } from '../state/flowStore'
import { useSettingsStore } from '../state/settingsStore'
import {
  AGENT_DEFAULT_IMAGE_ASPECT_RATIO,
  executeAgentToolCall,
  summarizeCanvasNodes,
} from '../utils/agentTools'
import {
  AGENT_IMAGE_ASPECT_RATIOS,
  getAgentImageResolutionOptions,
} from '../utils/agentGenerationPlan'
import { getConfiguredChatModels } from '../utils/chatModels'
import {
  getConfiguredDefaultImageModel,
  getConfiguredImageModels,
} from '../utils/imageModels'
import {
  getConfiguredDefaultVideoModel,
  getConfiguredVideoModels,
} from '../utils/videoModels'

const MIN_PANEL_WIDTH = 360
const MAX_PANEL_WIDTH_RATIO = 2 / 3
/** 一轮对话里最多自动来回的次数，防止模型不停调用工具 */
const MAX_AGENT_ROUNDS = 3

interface AgentPanelProps {
  onClose?: () => void
}

function uniqueModels(models: string[]): string[] {
  return Array.from(new Set(models.map((model) => model.trim()).filter(Boolean)))
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function nodeTitle(node: { id: string; type?: string; data: unknown }): string {
  const data = node.data as { title?: string } | undefined
  return data?.title ?? `${node.type ?? 'node'} ${node.id.slice(0, 4)}`
}

function getMentionQuery(value: string): string | null {
  const match = value.match(/(?:^|\s)@([一-龥\w-]*)$/)
  return match ? match[1] : null
}

function createMessageId(): string {
  return `agent_msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

/** 登录态失效类错误——这类错误旁边提供「重新登录」按钮 */
function isCodexAuthErrorText(text: string): boolean {
  return /未登录|登录态失效|刷新令牌/.test(text)
}

/** 还没有执行结果的工具调用（手动模式下等待确认的就是这些） */
function pendingActionsOf(message: AgentMessage): AgentToolCall[] {
  const doneIds = new Set((message.actionResults ?? []).map((result) => result.callId))
  return (message.actions ?? []).filter((action) => !doneIds.has(action.id))
}

export function AgentPanel({ onClose = () => undefined }: AgentPanelProps) {
  const nodes = useCanvasStore((s) => s.nodes)
  const selectedNodeId = useCanvasStore((s) => s.selectedNodeId)
  const messages = useAgentStore((s) => s.messages)
  const loading = useAgentStore((s) => s.loading)
  const error = useAgentStore((s) => s.error)
  const setLoading = useAgentStore((s) => s.setLoading)
  const setError = useAgentStore((s) => s.setError)
  const executionMode = useAgentStore((s) => s.executionMode)
  const setExecutionMode = useAgentStore((s) => s.setExecutionMode)
  const activeConversationId = useAgentStore((s) => s.activeConversationId)
  const conversations = useAgentStore((s) => s.conversations)
  const newConversation = useAgentStore((s) => s.newConversation)
  const openConversation = useAgentStore((s) => s.openConversation)
  const deleteConversation = useAgentStore((s) => s.deleteConversation)
  const setActiveProject = useAgentStore((s) => s.setActiveProject)
  const currentFlowId = useFlowStore((s) => s.currentFlowId)
  const settings = useSettingsStore((s) => s.settings)
  const saveSettings = useSettingsStore((s) => s.saveSettings)
  const { screenToFlowPosition } = useReactFlow()

  const [draft, setDraft] = useState('')
  const [panelWidth, setPanelWidth] = useState(420)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [modelOpen, setModelOpen] = useState(false)
  const [modeMenuOpen, setModeMenuOpen] = useState(false)
  const [mentionedNodeIds, setMentionedNodeIds] = useState<string[]>([])
  const [pickingCanvasNode, setPickingCanvasNode] = useState(false)
  const [executingMessageId, setExecutingMessageId] = useState<string | null>(null)
  // 手动模式下，待确认的图片参数覆盖（模型/比例/清晰度），key 为 action id
  const [paramOverrides, setParamOverrides] = useState<
    Record<string, { aspectRatio?: string; resolution?: string; model?: string }>
  >({})
  const [openParamSelect, setOpenParamSelect] = useState<string | null>(null)
  const [codexLoginState, setCodexLoginState] = useState<'idle' | 'starting' | 'opened'>('idle')
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const configuredCurrentModel = settings?.llmModel || ''
  const models = useMemo(() => {
    const configured = getConfiguredChatModels(
      settings?.llmModels,
      configuredCurrentModel,
      settings?.modelConfigs,
    )
    return uniqueModels(configured)
  }, [configuredCurrentModel, settings?.llmModels, settings?.modelConfigs])
  const currentModel = models.includes(configuredCurrentModel)
    ? configuredCurrentModel
    : models[0] ?? ''
  const defaultImageModel = useMemo(
    () =>
      getConfiguredDefaultImageModel(
        settings?.imageModels,
        settings?.defaultModel,
        undefined,
        settings?.modelConfigs,
      ),
    [settings?.defaultModel, settings?.imageModels, settings?.modelConfigs],
  )
  // 图片/视频模型列表来自设置,两套严格分开,绝不混用
  const imageModelOptions = useMemo(
    () =>
      getConfiguredImageModels(
        settings?.imageModels,
        undefined,
        settings?.modelConfigs,
      ).map((option) => ({ value: option.id, label: option.label })),
    [settings?.imageModels, settings?.modelConfigs],
  )
  const videoModelOptions = useMemo(
    () =>
      getConfiguredVideoModels(
        settings?.videoModels,
        settings?.modelConfigs,
      ).map((option) => ({ value: option.id, label: option.label })),
    [settings?.videoModels, settings?.modelConfigs],
  )
  const defaultVideoModel = useMemo(
    () =>
      getConfiguredDefaultVideoModel(
        settings?.videoModels,
        settings?.defaultVideoModel,
        settings?.modelConfigs,
      ),
    [settings?.videoModels, settings?.defaultVideoModel, settings?.modelConfigs],
  )
  const imageModelIds = useMemo(
    () => imageModelOptions.map((option) => option.value),
    [imageModelOptions],
  )
  const videoModelIds = useMemo(
    () => videoModelOptions.map((option) => option.value),
    [videoModelOptions],
  )
  const aspectRatioOptions = useMemo(
    () => AGENT_IMAGE_ASPECT_RATIOS.map((ratio) => ({ value: ratio, label: ratio })),
    [],
  )

  const maxPanelWidth =
    typeof window === 'undefined'
      ? 1120
      : Math.max(MIN_PANEL_WIDTH, Math.floor(window.innerWidth * MAX_PANEL_WIDTH_RATIO))

  useEffect(() => {
    setPanelWidth((value) => clamp(value, MIN_PANEL_WIDTH, maxPanelWidth))
  }, [maxPanelWidth])

  useEffect(() => {
    setActiveProject(currentFlowId)
    setMentionedNodeIds([])
    setPickingCanvasNode(false)
    setHistoryOpen(false)
  }, [currentFlowId, setActiveProject])

  // 新消息或加载状态变化时滚动到底部
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, loading])

  // 点击面板外部时关闭模型菜单与执行模式菜单
  useEffect(() => {
    if (!modelOpen && !modeMenuOpen) return
    const closeMenus = (event: MouseEvent) => {
      const target = event.target as Element | null
      if (target?.closest('.agent-model-picker')) return
      setModelOpen(false)
      setModeMenuOpen(false)
    }
    document.addEventListener('mousedown', closeMenus)
    return () => document.removeEventListener('mousedown', closeMenus)
  }, [modelOpen, modeMenuOpen])

  useEffect(() => {
    if (!historyOpen) return
    const closeHistory = (event: MouseEvent) => {
      const target = event.target as Element | null
      if (target?.closest('.agent-conversation-history')) return
      if (target?.closest('.agent-history-btn')) return
      setHistoryOpen(false)
    }
    document.addEventListener('mousedown', closeHistory)
    return () => document.removeEventListener('mousedown', closeHistory)
  }, [historyOpen])

  const mentionQuery = getMentionQuery(draft)
  const mentionOptions = useMemo(() => {
    const query = (mentionQuery ?? '').toLowerCase()
    return nodes
      .filter((node) => {
        const title = nodeTitle(node).toLowerCase()
        return !query || title.includes(query) || node.id.toLowerCase().includes(query)
      })
      .slice(0, 8)
  }, [mentionQuery, nodes])

  const selectedMentionNodes = useMemo(() => {
    return mentionedNodeIds
      .map((id) => nodes.find((node) => node.id === id))
      .filter((node): node is (typeof nodes)[number] => !!node)
  }, [mentionedNodeIds, nodes])

  const startResize = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    const move = (moveEvent: PointerEvent) => {
      const nextWidth = window.innerWidth - moveEvent.clientX
      setPanelWidth(clamp(nextWidth, MIN_PANEL_WIDTH, maxPanelWidth))
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const chooseMention = (nodeId: string) => {
    const node = nodes.find((item) => item.id === nodeId)
    if (!node) return
    const title = nodeTitle(node)
    setMentionedNodeIds((ids) => (ids.includes(nodeId) ? ids : [...ids, nodeId]))
    setDraft((value) => value.replace(/(?:^|\s)@[一-龥\w-]*$/, (match) => {
      const prefix = match.startsWith(' ') ? ' ' : ''
      return `${prefix}@${title} `
    }))
  }

  const removeMention = (nodeId: string) => {
    setMentionedNodeIds((ids) => ids.filter((id) => id !== nodeId))
  }

  const attachCanvasNode = useCallback((nodeId: string) => {
    const node = useCanvasStore.getState().nodes.find((item) => item.id === nodeId)
    if (!node) return
    setMentionedNodeIds((ids) => (ids.includes(nodeId) ? ids : [...ids, nodeId]))
    setDraft((value) => (value.trim() ? value : '请结合引用的画布节点继续创作：'))
  }, [])

  // 画布点选模式：点击任意节点即加入引用，Esc 退出
  useEffect(() => {
    document.body.classList.toggle('agent-pick-node-active', pickingCanvasNode)
    if (!pickingCanvasNode) {
      return () => {
        document.body.classList.remove('agent-pick-node-active')
      }
    }

    const handlePick = (event: MouseEvent) => {
      const target = event.target as Element | null
      const wrapper = target?.closest('[data-flow-node-id]') as HTMLElement | null
      if (!wrapper) return
      event.preventDefault()
      event.stopPropagation()
      const nodeId = wrapper.dataset.flowNodeId
      if (nodeId) attachCanvasNode(nodeId)
    }
    const handleCancel = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPickingCanvasNode(false)
    }

    document.addEventListener('click', handlePick, true)
    window.addEventListener('keydown', handleCancel)
    return () => {
      document.body.classList.remove('agent-pick-node-active')
      document.removeEventListener('click', handlePick, true)
      window.removeEventListener('keydown', handleCancel)
    }
  }, [attachCanvasNode, pickingCanvasNode])

  const getDropPosition = useCallback(() => {
    const canvasEl = document.querySelector('.react-flow') as HTMLElement | null
    if (!canvasEl) return { x: 260, y: 220 }
    const rect = canvasEl.getBoundingClientRect()
    return screenToFlowPosition({
      x: rect.left + rect.width * 0.5,
      y: rect.top + rect.height * 0.48,
    })
  }, [screenToFlowPosition])

  /**
   * 对话循环：发送历史 → 追加模型回复 → 立即执行无需确认的工具
   * （read_canvas 任何模式都直接执行；全自动模式下所有工具都直接执行），
   * 有结果后带回去继续下一轮，直到模型不再请求工具或达到轮数上限。
   */
  const runAgentLoop = useCallback(async (actionsAlreadyExecuted = false) => {
    setLoading(true)
    setError(undefined)
    // 本轮循环里是否已经有工具真的执行过——若是,后续 LLM 调用失败
    // 不该吓用户(画布操作其实已经生效),提示语要说明这一点
    let executedAnyAction = actionsAlreadyExecuted
    try {
      for (let round = 0; round < MAX_AGENT_ROUNDS; round += 1) {
        const state = useAgentStore.getState()
        const mode = state.executionMode
        const response = await sendAgentChat({
          history: buildAgentChatHistory(state.messages),
          canvas: summarizeCanvasNodes(useCanvasStore.getState().nodes),
          model: currentModel || undefined,
        })

        const assistantMessage: AgentMessage = {
          id: createMessageId(),
          role: 'assistant',
          content: response.message,
          contextNodeIds: [],
          actions: response.actions.length > 0 ? response.actions : undefined,
          createdAt: new Date().toISOString(),
        }
        useAgentStore.getState().addMessage(assistantMessage)

        if (response.actions.length === 0) break

        const immediateActions = mode === 'auto'
          ? response.actions
          : response.actions.filter((action) => action.tool === 'read_canvas')
        if (immediateActions.length === 0) break

        const results = []
        for (const action of immediateActions) {
          results.push(await executeAgentToolCall(action, { getDropPosition }))
        }
        executedAnyAction = true
        useAgentStore.getState().addActionResults(assistantMessage.id, results)

        // 手动模式下还有未确认的写操作：停下来等用户确认
        const hasPendingWrites = response.actions.some(
          (action) => action.tool !== 'read_canvas',
        )
        if (mode !== 'auto' && hasPendingWrites) break
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(executedAnyAction ? `画布操作已执行，但后续回复失败：${message}` : message)
    } finally {
      setLoading(false)
    }
  }, [currentModel, getDropPosition, setError, setLoading])

  const submit = async () => {
    const text = draft.trim()
    if (!text || loading || !currentModel) return
    const contextNodeIds = mentionedNodeIds.length > 0
      ? mentionedNodeIds
      : selectedNodeId
        ? [selectedNodeId]
        : []
    useAgentStore.getState().addMessage({
      id: createMessageId(),
      role: 'user',
      content: text,
      contextNodeIds,
      selectedNodeId: selectedNodeId ?? undefined,
      createdAt: new Date().toISOString(),
    })
    setDraft('')
    setMentionedNodeIds([])
    setPickingCanvasNode(false)
    await runAgentLoop()
  }

  const handleConfirmActions = async (message: AgentMessage) => {
    const pending = pendingActionsOf(message)
    if (pending.length === 0 || loading) return
    setExecutingMessageId(message.id)
    try {
      const results = []
      for (const action of pending) {
        results.push(await executeAgentToolCall(applyParamOverrides(action), { getDropPosition }))
      }
      useAgentStore.getState().addActionResults(message.id, results)
    } finally {
      setExecutingMessageId(null)
    }
    await runAgentLoop(true)
  }

  /** 卡片生效的图片模型：用户覆盖 > 模型指定(须在配置列表内) > 设置默认 */
  const effectiveImageModel = (action: AgentToolCall): string => {
    const override = paramOverrides[action.id]?.model
    if (override && imageModelIds.includes(override)) return override
    const arg = action.args.model
    if (typeof arg === 'string' && imageModelIds.includes(arg.trim())) return arg.trim()
    return defaultImageModel
  }

  /** 卡片生效的视频模型(只从视频模型列表里取,绝不混图片模型) */
  const effectiveVideoModel = (action: AgentToolCall): string => {
    const override = paramOverrides[action.id]?.model
    if (override && videoModelIds.includes(override)) return override
    const arg = action.args.model
    if (typeof arg === 'string' && videoModelIds.includes(arg.trim())) return arg.trim()
    return defaultVideoModel
  }

  /** 待确认的图片参数：用户覆盖 > 模型参数 > 默认（16:9 / 模型默认清晰度） */
  const imageParamValue = (
    action: AgentToolCall,
    key: 'aspectRatio' | 'resolution',
  ): string => {
    const override = paramOverrides[action.id]?.[key]
    if (override) return override
    const arg = action.args[key]
    if (typeof arg === 'string' && arg.trim()) {
      return key === 'resolution' ? arg.trim().toUpperCase() : arg.trim()
    }
    if (key === 'aspectRatio') return AGENT_DEFAULT_IMAGE_ASPECT_RATIO
    return getAgentImageResolutionOptions(effectiveImageModel(action))[0]
  }

  const setImageParam = (
    action: AgentToolCall,
    key: 'aspectRatio' | 'resolution' | 'model',
    value: string,
  ) => {
    setParamOverrides((prev) => {
      const next = { ...prev[action.id], [key]: value }
      // 切换模型后,已选清晰度若不被新模型支持,清掉让该模型的默认值接管
      if (
        key === 'model' &&
        next.resolution &&
        !(getAgentImageResolutionOptions(value) as string[]).includes(next.resolution)
      ) {
        delete next.resolution
      }
      return { ...prev, [action.id]: next }
    })
  }

  function applyParamOverrides(action: AgentToolCall): AgentToolCall {
    const override = paramOverrides[action.id]
    if (!override) return action
    return { ...action, args: { ...action.args, ...override } }
  }

  const handleCancelActions = (message: AgentMessage) => {
    const pending = pendingActionsOf(message)
    if (pending.length === 0) return
    useAgentStore.getState().addActionResults(
      message.id,
      pending.map((action) => ({
        callId: action.id,
        tool: action.tool,
        ok: false,
        summary: '用户取消了该操作。',
      })),
    )
  }

  const changeModel = (model: string) => {
    setModelOpen(false)
    void saveSettings({ llmModel: model }).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : String(err))
    })
  }

  /** 登录态失效时一键重新登录:清坏令牌 + 浏览器 OAuth */
  const handleCodexRelogin = async () => {
    if (codexLoginState === 'starting') return
    setCodexLoginState('starting')
    try {
      const result = await startCodexLogin()
      if (result.ok) {
        setCodexLoginState('opened')
      } else {
        setCodexLoginState('idle')
        setError(result.message)
      }
    } catch (err) {
      setCodexLoginState('idle')
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleNewConversation = () => {
    if (loading) return
    newConversation()
    setMentionedNodeIds([])
    setPickingCanvasNode(false)
    setHistoryOpen(false)
  }

  const handleOpenConversation = (conversationId: string) => {
    if (loading || conversationId === activeConversationId) {
      setHistoryOpen(false)
      return
    }
    openConversation(conversationId)
    setMentionedNodeIds([])
    setPickingCanvasNode(false)
    setHistoryOpen(false)
  }

  const handleDeleteConversation = (conversationId: string) => {
    if (loading && conversationId === activeConversationId) return
    deleteConversation(conversationId)
  }

  return (
    <aside className="agent-chat-panel" style={{ width: panelWidth }}>
      <div
        className="agent-resize-handle"
        onPointerDown={startResize}
        title="拖动调整 Agent 宽度"
      />

      <header className="agent-chat-header">
        <div className="agent-title">
          <Bot size={15} />
          <span>AI创作搭档</span>
        </div>
        <div className="agent-header-actions">
          <button
            type="button"
            className="agent-header-btn"
            title={loading ? '等待当前回复完成后再新建对话' : '新建对话'}
            aria-label="新建对话"
            onClick={handleNewConversation}
            disabled={loading}
          >
            <Plus size={14} />
          </button>
          <button
            type="button"
            className="agent-header-btn agent-history-btn"
            title="历史对话"
            aria-label="历史对话"
            aria-expanded={historyOpen}
            aria-haspopup="dialog"
            onClick={() => setHistoryOpen((open) => !open)}
          >
            <History size={14} />
          </button>
          {historyOpen && (
            <AgentConversationHistory
              activeConversationId={activeConversationId}
              conversations={conversations}
              switchingDisabled={loading}
              onOpen={handleOpenConversation}
              onDelete={handleDeleteConversation}
            />
          )}
          <button
            type="button"
            className="agent-header-btn"
            title="关闭 Agent"
            onClick={onClose}
          >
            <X size={14} />
          </button>
        </div>
      </header>

      <div className="agent-chat-scroll" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="agent-empty-hint">
            <Bot size={22} strokeWidth={1.6} />
            <p>和我聊聊，或直接告诉我你想画什么。</p>
            <p className="agent-empty-hint-sub">
              例如「画一张夏日海边的海报」，我可以在画布上创建节点并生成。
            </p>
          </div>
        )}
        {messages.map((message) => {
          const pending = message.role === 'assistant' ? pendingActionsOf(message) : []
          return (
            <div
              key={message.id}
              className={`agent-bubble ${message.role === 'user' ? 'user' : 'assistant'}`}
            >
              <p>{message.content}</p>
              {message.role === 'assistant' && (message.actions ?? []).length > 0 && (
                <div className="agent-action-list">
                  {(message.actions ?? []).map((action) => {
                    const result = (message.actionResults ?? []).find(
                      (item) => item.callId === action.id,
                    )
                    const pendingImageCard =
                      !result && (action.tool === 'generate_image' || action.tool === 'edit_image')
                    const pendingVideoCard = !result && action.tool === 'generate_video'
                    return (
                      <div
                        key={action.id}
                        className={`agent-action-card${
                          result ? (result.ok ? ' done' : ' failed') : ' pending'
                        }`}
                      >
                        <div className="agent-action-card-title">
                          {result
                            ? result.ok
                              ? <Check size={12} />
                              : <X size={12} />
                            : <Loader2 size={12} className="agent-action-pending-icon" />}
                          <span>{action.label}</span>
                        </div>
                        {pendingImageCard && (
                          <div className="agent-action-params">
                            {imageModelOptions.length > 0 && (
                              <SecondaryMenuSelect
                                label="模型"
                                value={effectiveImageModel(action)}
                                options={imageModelOptions}
                                open={openParamSelect === `${action.id}:model`}
                                onOpenChange={(open) =>
                                  setOpenParamSelect(open ? `${action.id}:model` : null)
                                }
                                onChange={(value) => setImageParam(action, 'model', value)}
                              />
                            )}
                            <SecondaryMenuSelect
                              label="画面比例"
                              value={imageParamValue(action, 'aspectRatio')}
                              options={aspectRatioOptions}
                              open={openParamSelect === `${action.id}:aspectRatio`}
                              onOpenChange={(open) =>
                                setOpenParamSelect(open ? `${action.id}:aspectRatio` : null)
                              }
                              onChange={(value) => setImageParam(action, 'aspectRatio', value)}
                            />
                            <SecondaryMenuSelect
                              label="清晰度"
                              value={imageParamValue(action, 'resolution')}
                              options={getAgentImageResolutionOptions(
                                effectiveImageModel(action),
                              ).map((item) => ({ value: item, label: item }))}
                              open={openParamSelect === `${action.id}:resolution`}
                              onOpenChange={(open) =>
                                setOpenParamSelect(open ? `${action.id}:resolution` : null)
                              }
                              onChange={(value) => setImageParam(action, 'resolution', value)}
                            />
                          </div>
                        )}
                        {pendingVideoCard && videoModelOptions.length > 0 && (
                          <div className="agent-action-params">
                            <SecondaryMenuSelect
                              label="模型"
                              value={effectiveVideoModel(action)}
                              options={videoModelOptions}
                              open={openParamSelect === `${action.id}:model`}
                              onOpenChange={(open) =>
                                setOpenParamSelect(open ? `${action.id}:model` : null)
                              }
                              onChange={(value) => setImageParam(action, 'model', value)}
                            />
                          </div>
                        )}
                        {result && (
                          <div className="agent-action-card-result">{result.summary}</div>
                        )}
                      </div>
                    )
                  })}
                  {pending.length > 0 && (
                    <div className="agent-action-confirm">
                      <span>
                        {executionMode === 'manual'
                          ? `等待确认：${pending.length} 项画布操作`
                          : '待执行'}
                      </span>
                      <div className="agent-action-confirm-btns">
                        <button
                          type="button"
                          className="agent-card-secondary"
                          disabled={loading || executingMessageId === message.id}
                          onClick={() => handleCancelActions(message)}
                        >
                          取消
                        </button>
                        <button
                          type="button"
                          className="agent-card-primary"
                          disabled={loading || executingMessageId === message.id}
                          onClick={() => void handleConfirmActions(message)}
                        >
                          {executingMessageId === message.id ? '执行中...' : '执行'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
        {loading && (
          <div className="agent-bubble assistant agent-loading-bubble">
            <Loader2 size={14} className="agent-action-pending-icon" />
            <span>正在思考...</span>
          </div>
        )}
        {error && (
          <div className="agent-error">
            <span>{error}</span>
            {isCodexAuthErrorText(error) && (
              <div className="agent-error-actions">
                <button
                  type="button"
                  className="agent-error-relogin-btn"
                  disabled={codexLoginState === 'starting'}
                  onClick={() => void handleCodexRelogin()}
                >
                  {codexLoginState === 'starting'
                    ? '正在打开登录...'
                    : codexLoginState === 'opened'
                      ? '已打开登录页，登录后重试'
                      : '重新登录'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <footer className="agent-composer">
        {selectedMentionNodes.length > 0 && (
          <div className="mention-chips">
            {selectedMentionNodes.map((node) => (
              <button
                type="button"
                key={node.id}
                className="mention-chip"
                onClick={() => removeMention(node.id)}
                title="移除引用"
              >
                @{nodeTitle(node)}
                <X size={11} />
              </button>
            ))}
          </div>
        )}

        {mentionQuery !== null && mentionOptions.length > 0 && (
          <div className="mention-popover">
            <div className="mention-popover-title">引用画布节点</div>
            {mentionOptions.map((node) => (
              <button
                key={node.id}
                type="button"
                className="mention-option"
                onClick={() => chooseMention(node.id)}
              >
                <AtSign size={13} />
                <span>{nodeTitle(node)}</span>
                <small>{node.type}</small>
              </button>
            ))}
          </div>
        )}

        <textarea
          className="agent-input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
              event.preventDefault()
              void submit()
            }
          }}
          placeholder="和我聊聊，或描述想要的画面，使用 @ 引用画布节点..."
          disabled={loading}
        />

        <div className="agent-composer-actions">
          <div className="agent-action-picker">
            <button
              type="button"
              className={`agent-round-btn agent-canvas-pick-btn ${pickingCanvasNode ? 'active' : ''}`}
              title={pickingCanvasNode ? '结束选择节点' : '从画布选择节点'}
              aria-label={pickingCanvasNode ? '结束选择节点' : '从画布选择节点'}
              aria-pressed={pickingCanvasNode}
              onClick={() => setPickingCanvasNode((picking) => !picking)}
            >
              <MousePointer2 size={14} />
            </button>
          </div>

          <div className="agent-model-picker agent-mode-picker">
            <button
              type="button"
              className="agent-model-btn"
              onClick={() => {
                setModeMenuOpen((open) => !open)
                setModelOpen(false)
              }}
              title={executionMode === 'auto'
                ? '全自动执行：模型直接操作画布，不再逐一确认'
                : '手动执行：操作画布前先询问，确认后才执行'}
              aria-expanded={modeMenuOpen}
              aria-haspopup="menu"
              aria-label="执行模式"
            >
              {executionMode === 'auto' ? '全自动' : '手动'}
              <ChevronDown size={13} />
            </button>
            {modeMenuOpen && (
              <div className="agent-model-menu" role="menu" aria-label="执行模式选项">
                <button
                  type="button"
                  className="agent-model-option"
                  role="menuitemradio"
                  aria-checked={executionMode === 'manual'}
                  onClick={() => {
                    setExecutionMode('manual')
                    setModeMenuOpen(false)
                  }}
                >
                  <span>手动执行</span>
                  {executionMode === 'manual' && <Check size={13} />}
                </button>
                <button
                  type="button"
                  className="agent-model-option"
                  role="menuitemradio"
                  aria-checked={executionMode === 'auto'}
                  onClick={() => {
                    setExecutionMode('auto')
                    setModeMenuOpen(false)
                  }}
                >
                  <span>全自动执行</span>
                  {executionMode === 'auto' && <Check size={13} />}
                </button>
              </div>
            )}
          </div>

          <div className="agent-model-picker">
            <button
              type="button"
              className="agent-model-btn"
              onClick={() => {
                setModelOpen((open) => !open)
                setModeMenuOpen(false)
              }}
              disabled={models.length === 0}
              title={models.length === 0 ? '请先在设置中添加大语言模型' : '切换 Agent 模型'}
            >
              {currentModel ? `Agent · ${currentModel}` : '未配置 Agent 模型'}
              <ChevronDown size={13} />
            </button>
            {modelOpen && models.length > 0 && (
              <div className="agent-model-menu">
                {models.map((model) => (
                  <button
                    type="button"
                    key={model}
                    className="agent-model-option"
                    onClick={() => changeModel(model)}
                  >
                    <span>{model}</span>
                    {model === currentModel && <Check size={13} />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            className="agent-send-btn"
            onClick={() => void submit()}
            disabled={!draft.trim() || loading || !currentModel}
            title={currentModel ? '发送' : '请先在设置中添加大语言模型'}
          >
            <ArrowUp size={15} />
          </button>
        </div>
      </footer>
    </aside>
  )
}

export default AgentPanel
