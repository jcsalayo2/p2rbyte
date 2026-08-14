import type { RefObject } from 'react'
import type { ChatMessage } from '../../types/chat'
import { MessageBubble } from './MessageBubble'

interface MessageListProps {
  messages: ChatMessage[]
  listEndRef: RefObject<HTMLDivElement | null>
}

export function MessageList({ messages, listEndRef }: MessageListProps) {
  if (messages.length === 0) {
    return (
      <div className="message-list message-list--empty">
        <p className="message-list__empty">No messages yet. Say hello.</p>
        <div ref={listEndRef} />
      </div>
    )
  }

  return (
    <div className="message-list">
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
      <div ref={listEndRef} />
    </div>
  )
}
