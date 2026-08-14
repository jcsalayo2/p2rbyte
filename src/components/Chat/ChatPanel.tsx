import { useChat } from '../../hooks/useChat'
import { Card } from '../common/Card'
import { ChatInput } from './ChatInput'
import { MessageList } from './MessageList'

interface ChatPanelProps {
  dataChannel: RTCDataChannel | null
  connected: boolean
}

export function ChatPanel({ dataChannel, connected }: ChatPanelProps) {
  const { messages, sendMessage, sendError, canSend, listEndRef } = useChat({
    dataChannel,
  })

  const inputDisabled = !connected || !canSend

  return (
    <Card className="chat-panel">
      <p className="chat-panel__title">Chat</p>
      <MessageList messages={messages} listEndRef={listEndRef} />
      <ChatInput
        onSend={(text) => sendMessage(text)}
        disabled={inputDisabled}
        error={sendError}
      />
      {connected && !canSend && (
        <p className="chat-panel__hint">Waiting for data channel…</p>
      )}
    </Card>
  )
}
