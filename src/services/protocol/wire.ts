import { MAX_CHAT_MESSAGE_LENGTH } from '../../config/constants'
import type { ChatWireMessage } from '../../types/chat'
import type { FileControlMessage } from '../../types/fileTransfer'

export type ControlMessage = ChatWireMessage | FileControlMessage

export function encodeControlMessage(message: ControlMessage): string {
  return JSON.stringify(message)
}

export function parseControlMessage(raw: string): ControlMessage | null {
  try {
    const data: unknown = JSON.parse(raw)
    if (!data || typeof data !== 'object') return null
    const msg = data as Record<string, unknown>
    if (typeof msg.type !== 'string') return null

    switch (msg.type) {
      case 'chat':
        return parseChatMessage(msg)
      case 'file-start':
        return parseFileStart(msg)
      case 'file-end':
        return parseFileEnd(msg)
      case 'file-abort':
        return parseFileAbort(msg)
      default:
        return null
    }
  } catch {
    return null
  }
}

function parseChatMessage(msg: Record<string, unknown>): ChatWireMessage | null {
  if (typeof msg.id !== 'string' || !msg.id) return null
  if (typeof msg.text !== 'string') return null
  if (typeof msg.sentAt !== 'number') return null

  const text = msg.text.trim()
  if (!text || text.length > MAX_CHAT_MESSAGE_LENGTH) return null

  return { type: 'chat', id: msg.id, text, sentAt: msg.sentAt }
}

function parseFileStart(msg: Record<string, unknown>): FileControlMessage | null {
  if (typeof msg.transferId !== 'string' || !msg.transferId) return null
  if (typeof msg.name !== 'string' || !msg.name) return null
  if (typeof msg.size !== 'number' || msg.size <= 0) return null
  if (typeof msg.mimeType !== 'string') return null

  return {
    type: 'file-start',
    transferId: msg.transferId,
    name: msg.name,
    size: msg.size,
    mimeType: msg.mimeType,
  }
}

function parseFileEnd(msg: Record<string, unknown>): FileControlMessage | null {
  if (typeof msg.transferId !== 'string' || !msg.transferId) return null
  return { type: 'file-end', transferId: msg.transferId }
}

function parseFileAbort(msg: Record<string, unknown>): FileControlMessage | null {
  if (typeof msg.transferId !== 'string' || !msg.transferId) return null
  return {
    type: 'file-abort',
    transferId: msg.transferId,
    reason: typeof msg.reason === 'string' ? msg.reason : undefined,
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
