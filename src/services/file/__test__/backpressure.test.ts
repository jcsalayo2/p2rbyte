import { afterEach, describe, expect, it, vi } from 'vitest'
import { BUFFER_HIGH_WATER_MARK, BUFFER_LOW_WATER_MARK } from '../../../config/constants'
import {
  configureBackpressure,
  isSendQueueFullError,
  sendWithBackpressure,
  waitUntilCanSend,
} from '../backpressure'

type MockChannelState = {
  bufferedAmount: number
  bufferedAmountLowThreshold: number
  readyState: RTCDataChannelState
  send: ReturnType<typeof vi.fn>
  addEventListener: (type: string, listener: EventListener) => void
  removeEventListener: (type: string, listener: EventListener) => void
  emitBufferedAmountLow: () => void
  emitClose: () => void
  emitError: () => void
}

function createMockDataChannel(
  overrides: Partial<{
    bufferedAmount: number
    bufferedAmountLowThreshold: number
    readyState: RTCDataChannelState
  }> = {},
): MockChannelState {
  const listeners = new Map<string, Set<EventListener>>()

  const channel: MockChannelState = {
    bufferedAmount: overrides.bufferedAmount ?? 0,
    bufferedAmountLowThreshold: overrides.bufferedAmountLowThreshold ?? 0,
    readyState: overrides.readyState ?? 'open',
    send: vi.fn(),
    addEventListener(type: string, listener: EventListener) {
      if (!listeners.has(type)) listeners.set(type, new Set())
      listeners.get(type)!.add(listener)
    },
    removeEventListener(type: string, listener: EventListener) {
      listeners.get(type)?.delete(listener)
    },
    emitBufferedAmountLow() {
      listeners.get('bufferedamountlow')?.forEach((fn) => fn(new Event('bufferedamountlow')))
    },
    emitClose() {
      listeners.get('close')?.forEach((fn) => fn(new Event('close')))
    },
    emitError() {
      listeners.get('error')?.forEach((fn) => fn(new Event('error')))
    },
  }

  return channel
}

function asRtcChannel(channel: MockChannelState): RTCDataChannel {
  return channel as unknown as RTCDataChannel
}

describe('isSendQueueFullError', () => {
  it('detects send queue full message', () => {
    expect(
      isSendQueueFullError(
        new Error("Failed to execute 'send' on 'RTCDataChannel': RTCDataChannel send queue is full"),
      ),
    ).toBe(true)
  })

  it('detects queue full from string', () => {
    expect(isSendQueueFullError('OperationError: QueueFull')).toBe(true)
  })

  it('returns false for other errors', () => {
    expect(isSendQueueFullError(new Error('other'))).toBe(false)
    expect(isSendQueueFullError(null)).toBe(false)
  })
})

describe('configureBackpressure', () => {
  it('sets bufferedAmountLowThreshold', () => {
    const channel = createMockDataChannel()
    configureBackpressure(asRtcChannel(channel), BUFFER_LOW_WATER_MARK)
    expect(channel.bufferedAmountLowThreshold).toBe(BUFFER_LOW_WATER_MARK)
  })

  it('throws when low water mark is not below high water mark', () => {
    const channel = createMockDataChannel()
    expect(() =>
      configureBackpressure(asRtcChannel(channel), BUFFER_HIGH_WATER_MARK),
    ).toThrow('Low water mark must be less than high water mark')
  })
})

describe('waitUntilCanSend', () => {
  it('resolves immediately when room available', async () => {
    const channel = createMockDataChannel({ bufferedAmount: 0 })
    await expect(
      waitUntilCanSend(asRtcChannel(channel), BUFFER_HIGH_WATER_MARK, 1024),
    ).resolves.toBeUndefined()
  })

  it('waits for bufferedamountlow when at high water', async () => {
    const channel = createMockDataChannel({
      bufferedAmount: BUFFER_HIGH_WATER_MARK,
      bufferedAmountLowThreshold: 8 * 1024 * 1024,
    })

    const promise = waitUntilCanSend(asRtcChannel(channel), BUFFER_HIGH_WATER_MARK, 0)
    channel.bufferedAmount = 4 * 1024 * 1024
    channel.emitBufferedAmountLow()
    await expect(promise).resolves.toBeUndefined()
  })

  it('waits when buffered plus pending reaches high water', async () => {
    const high = 1024
    const channel = createMockDataChannel({
      bufferedAmount: 900,
      bufferedAmountLowThreshold: 100,
    })

    const promise = waitUntilCanSend(asRtcChannel(channel), high, 200)
    channel.bufferedAmount = 50
    channel.emitBufferedAmountLow()
    await expect(promise).resolves.toBeUndefined()
  })

  it('resolves immediately when buffer is already below threshold', async () => {
    const channel = createMockDataChannel({
      bufferedAmount: 50,
      bufferedAmountLowThreshold: 100,
    })

    await expect(
      waitUntilCanSend(asRtcChannel(channel), 1024, 900),
    ).resolves.toBeUndefined()
  })

  it('rejects when channel is closed', async () => {
    const channel = createMockDataChannel({
      bufferedAmount: BUFFER_HIGH_WATER_MARK,
      readyState: 'closed',
    })
    await expect(waitUntilCanSend(asRtcChannel(channel), BUFFER_HIGH_WATER_MARK, 0)).rejects.toThrow(
      'Data channel closed',
    )
  })

  it('rejects when channel emits error while waiting', async () => {
    const channel = createMockDataChannel({
      bufferedAmount: BUFFER_HIGH_WATER_MARK,
      bufferedAmountLowThreshold: 8 * 1024 * 1024,
    })

    const promise = waitUntilCanSend(asRtcChannel(channel), BUFFER_HIGH_WATER_MARK, 0)
    channel.emitError()
    await expect(promise).rejects.toThrow('Data channel error')
  })

  it('resolves immediately if buffer drops during listener setup', async () => {
    const channel = createMockDataChannel({
      bufferedAmount: 200,
      bufferedAmountLowThreshold: 100,
    })
    const originalAdd = channel.addEventListener.bind(channel)
    channel.addEventListener = (type, listener) => {
      originalAdd(type, listener)
      if (type === 'bufferedamountlow') {
        channel.bufferedAmount = 50
      }
    }

    await expect(
      waitUntilCanSend(asRtcChannel(channel), 1024, 900),
    ).resolves.toBeUndefined()
  })

  it('rejects when channel closes while waiting for low buffer', async () => {
    const channel = createMockDataChannel({
      bufferedAmount: BUFFER_HIGH_WATER_MARK,
      bufferedAmountLowThreshold: 8 * 1024 * 1024,
    })

    const promise = waitUntilCanSend(asRtcChannel(channel), BUFFER_HIGH_WATER_MARK, 0)
    channel.emitClose()
    await expect(promise).rejects.toThrow('Data channel closed')
  })
})

describe('sendWithBackpressure', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('sends once when buffer has room', async () => {
    const channel = createMockDataChannel({ bufferedAmount: 0 })
    const data = new ArrayBuffer(64)

    await sendWithBackpressure(asRtcChannel(channel), data, BUFFER_HIGH_WATER_MARK)

    expect(channel.send).toHaveBeenCalledOnce()
    expect(channel.send).toHaveBeenCalledWith(data)
  })

  it('retries after send queue is full', async () => {
    const channel = createMockDataChannel({
      bufferedAmount: 100,
      bufferedAmountLowThreshold: 50,
    })
    const data = new ArrayBuffer(64)

    channel.send
      .mockImplementationOnce(() => {
        throw new Error('RTCDataChannel send queue is full')
      })
      .mockImplementationOnce(() => undefined)

    const promise = sendWithBackpressure(asRtcChannel(channel), data, BUFFER_HIGH_WATER_MARK)
    channel.bufferedAmount = 0
    channel.emitBufferedAmountLow()
    await promise

    expect(channel.send).toHaveBeenCalledTimes(2)
  })

  it('waits briefly when queue is full and buffered amount is zero', async () => {
    vi.useFakeTimers()
    const channel = createMockDataChannel({ bufferedAmount: 0 })
    const data = new ArrayBuffer(64)

    channel.send
      .mockImplementationOnce(() => {
        throw new Error('QueueFull')
      })
      .mockImplementationOnce(() => undefined)

    const promise = sendWithBackpressure(asRtcChannel(channel), data, BUFFER_HIGH_WATER_MARK)
    await vi.advanceTimersByTimeAsync(16)
    await promise

    expect(channel.send).toHaveBeenCalledTimes(2)
  })

  it('rethrows non queue-full send errors', async () => {
    const channel = createMockDataChannel({ bufferedAmount: 0 })
    channel.send.mockImplementation(() => {
      throw new Error('channel broken')
    })

    await expect(
      sendWithBackpressure(asRtcChannel(channel), new ArrayBuffer(8), BUFFER_HIGH_WATER_MARK),
    ).rejects.toThrow('channel broken')
  })

  it('rejects when channel is closed', async () => {
    const channel = createMockDataChannel({ readyState: 'closed' })
    await expect(
      sendWithBackpressure(asRtcChannel(channel), new ArrayBuffer(8), BUFFER_HIGH_WATER_MARK),
    ).rejects.toThrow('Data channel not open')
  })
})
