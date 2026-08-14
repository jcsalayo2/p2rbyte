import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ChatWireMessage } from '../../types/chat'
import { useChat } from '../useChat'
import type { DataChannelBus } from '../useDataChannelBus'

vi.mock('../../services/protocol/wire', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/protocol/wire')>()
  return {
    ...actual,
    createChatWireMessage: vi.fn(actual.createChatWireMessage),
  }
})

import { createChatWireMessage } from '../../services/protocol/wire'

const mockCreateChatWireMessage = vi.mocked(createChatWireMessage)

type MockBus = DataChannelBus & {
  emitChat: (message: ChatWireMessage) => void
}

function createMockBus(overrides: Partial<DataChannelBus> = {}): MockBus {
  const chatHandlers = new Set<(message: ChatWireMessage) => void>()

  const bus: MockBus = {
    isOpen: true,
    subscribe: vi.fn((type, handler) => {
      if (type === 'chat') {
        chatHandlers.add(handler as (message: ChatWireMessage) => void)
      }
      return () => chatHandlers.delete(handler as (message: ChatWireMessage) => void)
    }),
    sendControl: vi.fn(),
    sendBinary: vi.fn(async () => {}),
    waitUntilCanSend: vi.fn(async () => {}),
    maxMessageSize: 65536,
    bufferedAmount: 0,
    emitChat(message) {
      chatHandlers.forEach((handler) => handler(message))
    },
    ...overrides,
  }

  return bus
}

describe('useChat', () => {
  afterEach(() => {
    mockCreateChatWireMessage.mockReset()
    mockCreateChatWireMessage.mockImplementation((text) => {
      const trimmed = text.trim()
      if (!trimmed) return null
      return {
        type: 'chat',
        id: 'mock-id',
        text: trimmed,
        sentAt: 1,
      }
    })
  })

  it('reports canSend false when bus is null', () => {
    const { result } = renderHook(() => useChat({ bus: null }))
    expect(result.current.canSend).toBe(false)
  })

  it('sends a valid message and appends locally', () => {
    const bus = createMockBus()
    const { result } = renderHook(() => useChat({ bus }))

    act(() => {
      expect(result.current.sendMessage('  hello  ')).toBeNull()
    })

    expect(bus.sendControl).toHaveBeenCalledOnce()
    expect(result.current.messages).toHaveLength(1)
    expect(result.current.messages[0]).toMatchObject({
      text: 'hello',
      isLocal: true,
    })
  })

  it('receives remote chat messages', () => {
    const bus = createMockBus()
    const { result } = renderHook(() => useChat({ bus }))

    act(() => {
      bus.emitChat({ type: 'chat', id: 'r1', text: 'remote', sentAt: 100 })
    })

    expect(result.current.messages).toHaveLength(1)
    expect(result.current.messages[0]).toMatchObject({
      text: 'remote',
      isLocal: false,
    })
  })

  it('dedupes messages by id', () => {
    const bus = createMockBus()
    const { result } = renderHook(() => useChat({ bus }))
    const message = { type: 'chat' as const, id: 'dup', text: 'once', sentAt: 1 }

    act(() => {
      bus.emitChat(message)
      bus.emitChat(message)
    })

    expect(result.current.messages).toHaveLength(1)
  })

  it('sets sendError for empty message', () => {
    const bus = createMockBus()
    const { result } = renderHook(() => useChat({ bus }))

    act(() => {
      expect(result.current.sendMessage('   ')).toBe('Message cannot be empty')
    })

    expect(result.current.sendError).toBe('Message cannot be empty')
    expect(bus.sendControl).not.toHaveBeenCalled()
  })

  it('sets sendError when channel is not open', () => {
    const bus = createMockBus({ isOpen: false })
    const { result } = renderHook(() => useChat({ bus }))

    act(() => {
      expect(result.current.sendMessage('hello')).toBe('Cannot send — not connected')
    })

    expect(result.current.sendError).toBe('Cannot send — not connected')
  })

  it('sets sendError when sendControl throws', () => {
    const bus = createMockBus({
      sendControl: vi.fn(() => {
        throw new Error('boom')
      }),
    })
    const { result } = renderHook(() => useChat({ bus }))

    act(() => {
      expect(result.current.sendMessage('hello')).toBe('Failed to send message')
    })

    expect(result.current.sendError).toBe('Failed to send message')
  })

  it('clears sendError before each send attempt', () => {
    const bus = createMockBus({ isOpen: false })
    const { result } = renderHook(() => useChat({ bus }))

    act(() => {
      result.current.sendMessage('hello')
    })
    expect(result.current.sendError).toBeTruthy()

    act(() => {
      bus.isOpen = true
      result.current.sendMessage('hello again')
    })

    expect(result.current.sendError).toBeNull()
  })

  it('sets sendError when wire message cannot be created', () => {
    const bus = createMockBus()
    mockCreateChatWireMessage.mockReturnValue(null)
    const { result } = renderHook(() => useChat({ bus }))

    act(() => {
      expect(result.current.sendMessage('hello')).toBe('Invalid message')
    })

    expect(result.current.sendError).toBe('Invalid message')
    expect(bus.sendControl).not.toHaveBeenCalled()
  })
})
