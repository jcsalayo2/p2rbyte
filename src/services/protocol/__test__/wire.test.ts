import { describe, expect, it } from 'vitest'
import { MAX_CHAT_MESSAGE_LENGTH } from '../../../config/constants'
import {
  createChatWireMessage,
  encodeControlMessage,
  parseControlMessage,
  validateOutgoingText,
} from '../wire'

describe('parseControlMessage', () => {
  it('parses valid chat message', () => {
    const raw = JSON.stringify({
      type: 'chat',
      id: 'msg-1',
      text: 'Hello',
      sentAt: 1000,
    })
    expect(parseControlMessage(raw)).toEqual({
      type: 'chat',
      id: 'msg-1',
      text: 'Hello',
      sentAt: 1000,
    })
  })

  it('parses file-start', () => {
    const raw = JSON.stringify({
      type: 'file-start',
      transferId: 't1',
      name: 'photo.jpg',
      size: 1024,
      mimeType: 'image/jpeg',
    })
    expect(parseControlMessage(raw)).toEqual({
      type: 'file-start',
      transferId: 't1',
      name: 'photo.jpg',
      size: 1024,
      mimeType: 'image/jpeg',
    })
  })

  it('parses file-end', () => {
    const raw = JSON.stringify({ type: 'file-end', transferId: 't1' })
    expect(parseControlMessage(raw)).toEqual({ type: 'file-end', transferId: 't1' })
  })

  it('parses file-abort with reason', () => {
    const raw = JSON.stringify({
      type: 'file-abort',
      transferId: 't1',
      reason: 'failed',
    })
    expect(parseControlMessage(raw)).toEqual({
      type: 'file-abort',
      transferId: 't1',
      reason: 'failed',
    })
  })

  it('returns null for invalid JSON', () => {
    expect(parseControlMessage('not json')).toBeNull()
  })

  it('returns null for non-object JSON', () => {
    expect(parseControlMessage('"hello"')).toBeNull()
    expect(parseControlMessage('null')).toBeNull()
  })

  it('returns null when type is missing', () => {
    expect(parseControlMessage(JSON.stringify({ id: 'x' }))).toBeNull()
  })

  it('returns null for chat with invalid fields', () => {
    expect(
      parseControlMessage(JSON.stringify({ type: 'chat', id: '', text: 'hi', sentAt: 1 })),
    ).toBeNull()
    expect(
      parseControlMessage(JSON.stringify({ type: 'chat', id: '1', text: 1, sentAt: 1 })),
    ).toBeNull()
    expect(
      parseControlMessage(JSON.stringify({ type: 'chat', id: '1', text: 'hi', sentAt: '1' })),
    ).toBeNull()
  })

  it('returns null for file-start with invalid size or name', () => {
    expect(
      parseControlMessage(
        JSON.stringify({
          type: 'file-start',
          transferId: 't1',
          name: '',
          size: 100,
          mimeType: 'text/plain',
        }),
      ),
    ).toBeNull()
    expect(
      parseControlMessage(
        JSON.stringify({
          type: 'file-start',
          transferId: 't1',
          name: 'a.txt',
          size: 0,
          mimeType: 'text/plain',
        }),
      ),
    ).toBeNull()
  })

  it('returns null for file-start with invalid mimeType', () => {
    expect(
      parseControlMessage(
        JSON.stringify({
          type: 'file-start',
          transferId: 't1',
          name: 'a.txt',
          size: 100,
          mimeType: 1,
        }),
      ),
    ).toBeNull()
  })

  it('returns null for file-abort without transferId', () => {
    expect(parseControlMessage(JSON.stringify({ type: 'file-abort', transferId: '' }))).toBeNull()
  })

  it('parses file-abort without reason', () => {
    expect(parseControlMessage(JSON.stringify({ type: 'file-abort', transferId: 't1' }))).toEqual({
      type: 'file-abort',
      transferId: 't1',
      reason: undefined,
    })
  })

  it('returns null for unknown type', () => {
    expect(parseControlMessage(JSON.stringify({ type: 'unknown' }))).toBeNull()
  })

  it('returns null for chat with empty trimmed text', () => {
    const raw = JSON.stringify({
      type: 'chat',
      id: 'msg-1',
      text: '   ',
      sentAt: 1000,
    })
    expect(parseControlMessage(raw)).toBeNull()
  })

  it('returns null for chat text over max length', () => {
    const raw = JSON.stringify({
      type: 'chat',
      id: 'msg-1',
      text: 'x'.repeat(MAX_CHAT_MESSAGE_LENGTH + 1),
      sentAt: 1000,
    })
    expect(parseControlMessage(raw)).toBeNull()
  })

  it('returns null for file-start with missing fields', () => {
    expect(
      parseControlMessage(JSON.stringify({ type: 'file-start', transferId: 't1' })),
    ).toBeNull()
  })
})

describe('encodeControlMessage round-trip', () => {
  it('round-trips chat message', () => {
    const message = {
      type: 'chat' as const,
      id: 'msg-1',
      text: 'Hi',
      sentAt: 2000,
    }
    expect(parseControlMessage(encodeControlMessage(message))).toEqual(message)
  })
})

describe('validateOutgoingText', () => {
  it('rejects empty message', () => {
    expect(validateOutgoingText('   ')).toBe('Message cannot be empty')
  })

  it('rejects too long message', () => {
    expect(validateOutgoingText('a'.repeat(MAX_CHAT_MESSAGE_LENGTH + 1))).toBe(
      `Message must be ${MAX_CHAT_MESSAGE_LENGTH} characters or less`,
    )
  })

  it('accepts valid message', () => {
    expect(validateOutgoingText('hello')).toBeNull()
  })
})

describe('createChatWireMessage', () => {
  it('creates message for valid text', () => {
    const msg = createChatWireMessage('  hello  ')
    expect(msg).not.toBeNull()
    expect(msg?.type).toBe('chat')
    expect(msg?.text).toBe('hello')
    expect(msg?.id).toBeTruthy()
    expect(typeof msg?.sentAt).toBe('number')
  })

  it('returns null for empty text', () => {
    expect(createChatWireMessage('')).toBeNull()
  })
})
