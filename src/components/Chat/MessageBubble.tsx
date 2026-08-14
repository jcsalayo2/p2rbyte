import type { ChatMessage } from '../../types/chat'

interface MessageBubbleProps {
  message: ChatMessage
}

export function MessageBubble({ message }: MessageBubbleProps) {
  return (
    <div
      className={`message-bubble${message.isLocal ? ' message-bubble--local' : ' message-bubble--remote'}`}
    >
      <p className="message-bubble__text">{message.text}</p>
    </div>
  )
}
