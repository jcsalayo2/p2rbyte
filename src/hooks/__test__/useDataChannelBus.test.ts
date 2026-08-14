import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BUFFER_LOW_WATER_MARK } from '../../config/constants'
import { configureBackpressure, sendWithBackpressure } from '../../services/file/backpressure'
import { useDataChannelBus } from '../useDataChannelBus'

vi.mock('../../services/file/backpressure', () => ({
  configureBackpressure: vi.fn(),
  sendWithBackpressure: vi.fn(async () => {}),
  waitUntilCanSend: vi.fn(async () => {}),
}))

type MockChannel = RTCDataChannel & {
  emitMessage: (data: string | ArrayBuffer) => void
  emitOpen: () => void
}

function createMockChannel(
  overrides: Partial<{
    readyState: RTCDataChannelState
    bufferedAmount: number
    maxMessageSize: number
  }> = {},
): MockChannel {
  const listeners = new Map<string, Set<EventListener>>()

  const channel = {
    readyState: overrides.readyState ?? 'open',
    bufferedAmount: overrides.bufferedAmount ?? 0,
    maxMessageSize: overrides.maxMessageSize ?? 65536,
    send: vi.fn(),
    close: vi.fn(),
    addEventListener(type: string, listener: EventListener, options?: AddEventListenerOptions) {
      if (!listeners.has(type)) listeners.set(type, new Set())
      listeners.get(type)!.add(listener)
      if (options?.once && type === 'open') {
        queueMicrotask(() => {
          if (channel.readyState === 'open') listener(new Event('open'))
        })
      }
    },
    removeEventListener(type: string, listener: EventListener) {
      listeners.get(type)?.delete(listener)
    },
    dispatchEvent(event: Event) {
      listeners.get(event.type)?.forEach((listener) => listener(event))
      return true
    },
    emitMessage(data: string | ArrayBuffer) {
      channel.dispatchEvent(new MessageEvent('message', { data }))
    },
    emitOpen() {
      channel.readyState = 'open'
      channel.dispatchEvent(new Event('open'))
    },
  } as MockChannel

  return channel
}

describe('useDataChannelBus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns null when data channel is null', () => {
    const { result } = renderHook(() => useDataChannelBus(null))
    expect(result.current).toBeNull()
  })

  it('exposes open state and channel limits', () => {
    const channel = createMockChannel({ readyState: 'open', maxMessageSize: 16384 })
    const { result } = renderHook(() => useDataChannelBus(channel))

    expect(result.current?.isOpen).toBe(true)
    expect(result.current?.maxMessageSize).toBe(16384)
    expect(result.current?.bufferedAmount).toBe(0)
  })

  it('returns zero maxMessageSize when channel limit is unknown', () => {
    const channel = createMockChannel({ maxMessageSize: 0 })
    const { result } = renderHook(() => useDataChannelBus(channel))
    expect(result.current?.maxMessageSize).toBe(0)
  })

  it('sends encoded control messages when open', () => {
    const channel = createMockChannel()
    const { result } = renderHook(() => useDataChannelBus(channel))
    const message = {
      type: 'chat' as const,
      id: '1',
      text: 'hello',
      sentAt: 1,
    }

    act(() => {
      result.current?.sendControl(message)
    })

    expect(channel.send).toHaveBeenCalledOnce()
    expect(channel.send).toHaveBeenCalledWith(JSON.stringify(message))
  })

  it('throws when sending control on closed channel', () => {
    const channel = createMockChannel({ readyState: 'closed' })
    const { result } = renderHook(() => useDataChannelBus(channel))

    expect(() =>
      result.current?.sendControl({
        type: 'chat',
        id: '1',
        text: 'hello',
        sentAt: 1,
      }),
    ).toThrow('Data channel not open')
  })

  it('sends binary data with backpressure', async () => {
    const channel = createMockChannel()
    const { result } = renderHook(() => useDataChannelBus(channel))
    const data = new ArrayBuffer(8)

    await act(async () => {
      await result.current?.sendBinary(data)
    })

    expect(sendWithBackpressure).toHaveBeenCalledWith(channel, data, expect.any(Number))
  })

  it('dispatches parsed control messages to subscribers', () => {
    const channel = createMockChannel()
    const { result } = renderHook(() => useDataChannelBus(channel))
    const handler = vi.fn()

    act(() => {
      result.current?.subscribe('chat', handler)
    })

    act(() => {
      channel.emitMessage(
        JSON.stringify({ type: 'chat', id: '1', text: 'hello', sentAt: 100 }),
      )
    })

    expect(handler).toHaveBeenCalledWith({
      type: 'chat',
      id: '1',
      text: 'hello',
      sentAt: 100,
    })
  })

  it('dispatches binary messages to binary subscribers', () => {
    const channel = createMockChannel()
    const { result } = renderHook(() => useDataChannelBus(channel))
    const handler = vi.fn()
    const data = new ArrayBuffer(4)

    act(() => {
      result.current?.subscribe('binary', handler)
    })

    act(() => {
      channel.emitMessage(data)
    })

    expect(handler).toHaveBeenCalledWith(data)
  })

  it('unsubscribes control handlers', () => {
    const channel = createMockChannel()
    const { result } = renderHook(() => useDataChannelBus(channel))
    const handler = vi.fn()

    act(() => {
      const unsubscribe = result.current?.subscribe('chat', handler)
      unsubscribe?.()
      channel.emitMessage(
        JSON.stringify({ type: 'chat', id: '1', text: 'hello', sentAt: 100 }),
      )
    })

    expect(handler).not.toHaveBeenCalled()
  })

  it('configures backpressure when channel is already open', () => {
    const channel = createMockChannel({ readyState: 'open' })
    renderHook(() => useDataChannelBus(channel))

    expect(configureBackpressure).toHaveBeenCalledWith(channel, BUFFER_LOW_WATER_MARK)
  })

  it('configures backpressure after channel opens', () => {
    const channel = createMockChannel({ readyState: 'connecting' })
    renderHook(() => useDataChannelBus(channel))

    expect(configureBackpressure).not.toHaveBeenCalled()

    act(() => {
      channel.emitOpen()
    })

    expect(configureBackpressure).toHaveBeenCalledWith(channel, BUFFER_LOW_WATER_MARK)
  })
})
