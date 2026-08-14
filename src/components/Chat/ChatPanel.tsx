import { useChat } from '../../hooks/useChat'
import type { DataChannelBus } from '../../hooks/useDataChannelBus'
import { Card } from '../common/Card'
import { FileSend } from '../FileTransfer/FileSend'
import { ChatInput } from './ChatInput'
import { MessageList } from './MessageList'

interface ChatPanelProps {
  bus: DataChannelBus
  connected: boolean
  onSendFile: (file: File) => void
  fileSendError?: string | null
  canSendFile: boolean
}

export function ChatPanel({
  bus,
  connected,
  onSendFile,
  fileSendError,
  canSendFile,
}: ChatPanelProps) {
  const { messages, sendMessage, sendError, canSend, listEndRef } = useChat({ bus })

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
      <FileSend
        onSend={onSendFile}
        disabled={!canSendFile}
        error={fileSendError}
      />
      {connected && !canSend && (
        <p className="chat-panel__hint">Waiting for data channel…</p>
      )}
    </Card>
  )
}
