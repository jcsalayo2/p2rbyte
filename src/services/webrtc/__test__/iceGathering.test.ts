import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { localSessionDescription, waitForIceGatheringComplete } from '../iceGathering'

function createMockPeerConnection(
  initialState: RTCIceGatheringState = 'new',
): RTCPeerConnection {
  let state = initialState
  const listeners = new Map<string, Set<EventListener>>()

  return {
    get iceGatheringState() {
      return state
    },
    get localDescription() {
      return { sdp: 'v=0', type: 'offer' as RTCSdpType }
    },
    addEventListener(type: string, listener: EventListener) {
      if (!listeners.has(type)) listeners.set(type, new Set())
      listeners.get(type)!.add(listener)
    },
    removeEventListener(type: string, listener: EventListener) {
      listeners.get(type)?.delete(listener)
    },
    emit(type: string) {
      listeners.get(type)?.forEach((listener) => listener(new Event(type)))
    },
    setGatheringState(next: RTCIceGatheringState) {
      state = next
      this.emit('icegatheringstatechange')
    },
  } as unknown as RTCPeerConnection
}

describe('waitForIceGatheringComplete', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('resolves immediately when gathering is already complete', async () => {
    const pc = createMockPeerConnection('complete')
    await expect(waitForIceGatheringComplete(pc)).resolves.toBeUndefined()
  })

  it('resolves when gathering transitions to complete', async () => {
    const pc = createMockPeerConnection('gathering')
    const promise = waitForIceGatheringComplete(pc)
    ;(pc as unknown as { setGatheringState: (s: RTCIceGatheringState) => void }).setGatheringState(
      'complete',
    )
    await expect(promise).resolves.toBeUndefined()
  })

  it('resolves after timeout even if gathering never completes', async () => {
    const pc = createMockPeerConnection('gathering')
    const promise = waitForIceGatheringComplete(pc)
    vi.advanceTimersByTime(15000)
    await expect(promise).resolves.toBeUndefined()
  })

  it('does not reject when icecandidateerror fires', async () => {
    const pc = createMockPeerConnection('gathering')
    const promise = waitForIceGatheringComplete(pc)
    ;(pc as unknown as { emit: (type: string) => void }).emit('icecandidateerror')
    ;(pc as unknown as { setGatheringState: (s: RTCIceGatheringState) => void }).setGatheringState(
      'complete',
    )
    await expect(promise).resolves.toBeUndefined()
  })
})

describe('localSessionDescription', () => {
  it('returns sdp and type from localDescription', () => {
    const pc = {
      localDescription: { sdp: 'v=0', type: 'answer' as RTCSdpType },
    } as RTCPeerConnection

    expect(localSessionDescription(pc)).toEqual({ sdp: 'v=0', type: 'answer' })
  })

  it('throws when localDescription is missing', () => {
    const pc = { localDescription: null } as RTCPeerConnection
    expect(() => localSessionDescription(pc)).toThrow('Local session description missing')
  })
})
