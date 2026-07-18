import { Search, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { AgentConversation } from '../state/agentStore'

interface AgentConversationHistoryProps {
  activeConversationId: string
  conversations: AgentConversation[]
  switchingDisabled?: boolean
  onOpen: (conversationId: string) => void
  onDelete: (conversationId: string) => void
}

function formatConversationTime(timestamp: string): string {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function conversationPreview(conversation: AgentConversation): string {
  const lastMessage = conversation.messages.at(-1)
  return lastMessage?.content.replace(/\s+/g, ' ').trim() || '还没有消息'
}

export function AgentConversationHistory({
  activeConversationId,
  conversations,
  switchingDisabled = false,
  onOpen,
  onDelete,
}: AgentConversationHistoryProps) {
  const [query, setQuery] = useState('')
  const visibleConversations = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    return [...conversations]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .filter((conversation) => {
        if (!keyword) return true
        return (
          conversation.title.toLowerCase().includes(keyword) ||
          conversationPreview(conversation).toLowerCase().includes(keyword)
        )
      })
  }, [conversations, query])

  return (
    <section
      className="agent-conversation-history"
      role="dialog"
      aria-label="历史对话"
    >
      <div className="agent-conversation-history-title">
        <strong>历史对话</strong>
        <span>{conversations.length} 个对话</span>
      </div>

      <label className="agent-conversation-search">
        <Search size={13} aria-hidden />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索对话"
          aria-label="搜索历史对话"
          autoFocus
        />
      </label>

      <div className="agent-conversation-list">
        {visibleConversations.length === 0 ? (
          <div className="agent-conversation-empty">没有找到相关对话</div>
        ) : (
          visibleConversations.map((conversation) => {
            const active = conversation.id === activeConversationId
            return (
              <div
                key={conversation.id}
                className={'agent-conversation-row' + (active ? ' active' : '')}
              >
                <button
                  type="button"
                  className="agent-conversation-open"
                  onClick={() => onOpen(conversation.id)}
                  disabled={switchingDisabled && !active}
                  aria-current={active ? 'true' : undefined}
                  title={
                    switchingDisabled && !active
                      ? '等待当前回复完成后再切换'
                      : '打开对话'
                  }
                >
                  <span className="agent-conversation-row-head">
                    <strong>{conversation.title}</strong>
                    <time dateTime={conversation.updatedAt}>
                      {formatConversationTime(conversation.updatedAt)}
                    </time>
                  </span>
                  <span className="agent-conversation-preview">
                    {conversationPreview(conversation)}
                  </span>
                </button>
                <button
                  type="button"
                  className="agent-conversation-delete"
                  onClick={() => onDelete(conversation.id)}
                  disabled={switchingDisabled && active}
                  aria-label={'删除对话：' + conversation.title}
                  title={
                    switchingDisabled && active
                      ? '等待当前回复完成后再删除'
                      : '删除对话'
                  }
                >
                  <Trash2 size={13} />
                </button>
              </div>
            )
          })
        )}
      </div>
    </section>
  )
}
