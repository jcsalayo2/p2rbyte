import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { ChatMessage } from '../types/chat'
import {
  createChatWireMessage,
  encodeChatMessage,
  parseWireMessage,
  validateOutgoingText,
} from '../services/chat/protocol'

interface UseChatOptions {
  dataChannel: RTCDataChannel | null
}

interface UseChatResult {
  messages: ChatMessage[]
  sendMessage: (text: string) => string | null
  sendError: string | null
  canSend: boolean
  listEndRef: RefObject<HTMLDivElement | null>
}

export function useChat({ dataChannel }: UseChatOptions): UseChatResult {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sendError, setSendError] = useState<string | null>(null)
  const listEndRef = useRef<HTMLDivElement | null>(null)
  const seenIdsRef = useRef(new Set<string>())

  const canSend = dataChannel?.readyState === 'open'

  const appendMessage = useCallback((message: ChatMessage) => {
    if (seenIdsRef.current.has(message.id)) return
    seenIdsRef.current.add(message.id)
    setMessages((prev) => [...prev, message])
  }, [])

  useEffect(() => {
    if (!dataChannel) return

    seenIdsRef.current.clear()

    const handleMessage = (event: MessageEvent) => {
      if (typeof event.data !== 'string') return
      const wire = parseWireMessage(event.data)
      if (!wire) return

      appendMessage({
        id: wire.id,
        text: wire.text,
        sentAt: wire.sentAt,
        isLocal: false,
      })
    }

    dataChannel.addEventListener('message', handleMessage)
    return () => dataChannel.removeEventListener('message', handleMessage)
  }, [dataChannel, appendMessage])

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = useCallback(
    (text: string): string | null => {
      setSendError(null)

      const validationError = validateOutgoingText(text)
      if (validationError) {
        setSendError(validationError)
        return validationError
      }

      if (!dataChannel || dataChannel.readyState !== 'open') {
        const err = 'Cannot send — not connected'
        setSendError(err)
        return err
      }

      const wire = createChatWireMessage(text)
      if (!wire) {
        const err = 'Invalid message'
        setSendError(err)
        return err
      }

      try {
        dataChannel.send(encodeChatMessage(wire))
        appendMessage({
          id: wire.id,
          text: wire.text,
          sentAt: wire.sentAt,
          isLocal: true,
        })
        return null
      } catch {
        const err = 'Failed to send message'
        setSendError(err)
        return err
      }
    },
    [dataChannel, appendMessage],
  )

  return { messages, sendMessage, sendError, canSend, listEndRef }
}
