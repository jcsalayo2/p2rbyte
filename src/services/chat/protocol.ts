import { MAX_CHAT_MESSAGE_LENGTH } from '../../config/constants'
import type { ChatWireMessage, WireMessage } from '../../types/chat'

export function encodeChatMessage(message: ChatWireMessage): string {
  return JSON.stringify(message)
}

export function parseWireMessage(raw: string): WireMessage | null {
  try {
    const data: unknown = JSON.parse(raw)
    if (!data || typeof data !== 'object') return null
    const msg = data as Record<string, unknown>
    if (msg.type !== 'chat') return null
    if (typeof msg.id !== 'string' || !msg.id) return null
    if (typeof msg.text !== 'string') return null
    if (typeof msg.sentAt !== 'number') return null

    const text = msg.text.trim()
    if (!text || text.length > MAX_CHAT_MESSAGE_LENGTH) return null

    return {
      type: 'chat',
      id: msg.id,
      text,
      sentAt: msg.sentAt,
    }
  } catch {
    return null
  }
}

export function createChatWireMessage(text: string): ChatWireMessage | null {
  const trimmed = text.trim()
  if (!trimmed || trimmed.length > MAX_CHAT_MESSAGE_LENGTH) return null

  return {
    type: 'chat',
    id: crypto.randomUUID(),
    text: trimmed,
    sentAt: Date.now(),
  }
}

export function validateOutgoingText(text: string): string | null {
  const trimmed = text.trim()
  if (!trimmed) return 'Message cannot be empty'
  if (trimmed.length > MAX_CHAT_MESSAGE_LENGTH) {
    return `Message must be ${MAX_CHAT_MESSAGE_LENGTH} characters or less`
  }
  return null
}
