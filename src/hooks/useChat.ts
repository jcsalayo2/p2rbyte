import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { ChatMessage } from '../types/chat'
import type { DataChannelBus } from './useDataChannelBus'
import {
  createChatWireMessage,
  validateOutgoingText,
} from '../services/protocol/wire'

interface UseChatOptions {
  bus: DataChannelBus | null
}

interface UseChatResult {
  messages: ChatMessage[]
  sendMessage: (text: string) => string | null
  sendError: string | null
  canSend: boolean
  listEndRef: RefObject<HTMLDivElement | null>
}

export function useChat({ bus }: UseChatOptions): UseChatResult {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sendError, setSendError] = useState<string | null>(null)
  const listEndRef = useRef<HTMLDivElement | null>(null)
  const seenIdsRef = useRef(new Set<string>())

  const canSend = bus?.isOpen ?? false

  const appendMessage = useCallback((message: ChatMessage) => {
    if (seenIdsRef.current.has(message.id)) return
    seenIdsRef.current.add(message.id)
    setMessages((prev) => [...prev, message])
  }, [])

  useEffect(() => {
    if (!bus) return

    seenIdsRef.current.clear()

    return bus.subscribe('chat', (message) => {
      if (message.type !== 'chat') return
      appendMessage({
        id: message.id,
        text: message.text,
        sentAt: message.sentAt,
        isLocal: false,
      })
    })
  }, [bus, appendMessage])

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

      if (!bus?.isOpen) {
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
        bus.sendControl(wire)
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
    [bus, appendMessage],
  )

  return { messages, sendMessage, sendError, canSend, listEndRef }
}
