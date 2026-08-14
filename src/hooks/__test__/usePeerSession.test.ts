import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePeerSession } from '../usePeerSession'

const signaling = vi.hoisted(() => ({
  cancelOnDisconnect: vi.fn(async () => {}),
  createRoomMeta: vi.fn(async () => {}),
  deleteRoom: vi.fn(async () => {}),
  getRoomMeta: vi.fn(async () => null),
  hasAnswer: vi.fn(async () => false),
  isRoomExpired: vi.fn(() => false),
  listenForAnswer: vi.fn(() => () => {}),
  listenForCalleeCandidates: vi.fn(() => () => {}),
  listenForCallerCandidates: vi.fn(() => () => {}),
  listenForOffer: vi.fn(() => () => {}),
  listenForRoomStatus: vi.fn(() => () => {}),
  listenForIcePhase: vi.fn(() => () => {}),
  updateIcePhase: vi.fn(async () => {}),
  pushCalleeCandidate: vi.fn(async () => {}),
  pushCallerCandidate: vi.fn(async () => {}),
  readOffer: vi.fn(async () => ({ sdp: 'offer', type: 'offer' as RTCSdpType })),
  registerOnDisconnectRemove: vi.fn(async () => {}),
  resetSignalingExchange: vi.fn(async () => {}),
  roomExists: vi.fn(async () => true),
  updateRoomStatus: vi.fn(async () => {}),
  writeAnswer: vi.fn(async () => {}),
  writeOffer: vi.fn(async () => {}),
}))

const webrtc = vi.hoisted(() => {
  const channelListeners = new Map<string, Set<EventListener>>()
  const mockChannel = {
    readyState: 'connecting' as RTCDataChannelState,
    addEventListener(type: string, listener: EventListener) {
      if (!channelListeners.has(type)) channelListeners.set(type, new Set())
      channelListeners.get(type)!.add(listener)
    },
    removeEventListener(type: string, listener: EventListener) {
      channelListeners.get(type)?.delete(listener)
    },
    close: vi.fn(),
    emitOpen() {
      mockChannel.readyState = 'open'
      channelListeners.get('open')?.forEach((listener) => listener(new Event('open')))
    },
  }

  const mockPc = {
    createOffer: vi.fn(async () => ({ sdp: 'offer', type: 'offer' as RTCSdpType })),
    createAnswer: vi.fn(async () => ({ sdp: 'answer', type: 'answer' as RTCSdpType })),
    setLocalDescription: vi.fn(async () => {}),
    setRemoteDescription: vi.fn(async () => {}),
    close: vi.fn(),
    addEventListener: vi.fn(),
    localDescription: { sdp: 'local-sdp', type: 'offer' as RTCSdpType },
  }

  return {
    mockChannel,
    mockPc,
    createPeerConnection: vi.fn(() => mockPc),
    trackIceCandidates: vi.fn(() => () => {}),
    trackConnectionState: vi.fn(() => () => {}),
    trackIceConnectionState: vi.fn(() => () => {}),
    addRemoteCandidate: vi.fn(async () => {}),
    createDataChannel: vi.fn(() => mockChannel),
    waitForDataChannel: vi.fn(async () => mockChannel),
    waitForChannelOpen: vi.fn(async () => {}),
    createRemoteCandidateCollector: vi.fn(() => ({
      add: vi.fn(async () => {}),
      flush: vi.fn(async () => {}),
    })),
  }
})

vi.mock('../../services/firebase/signaling', () => signaling)
vi.mock('../../services/webrtc/peerConnection', () => ({
  createPeerConnection: webrtc.createPeerConnection,
  trackIceCandidates: webrtc.trackIceCandidates,
  trackConnectionState: webrtc.trackConnectionState,
  trackIceConnectionState: webrtc.trackIceConnectionState,
  addRemoteCandidate: webrtc.addRemoteCandidate,
}))

vi.mock('../../services/webrtc/iceGathering', () => ({
  localSessionDescription: vi.fn(() => ({ sdp: 'local-sdp', type: 'offer' as RTCSdpType })),
}))

vi.mock('../../services/webrtc/webrtcDebug', () => ({
  attachWebRtcDebug: vi.fn(() => () => {}),
  attachDataChannelDebug: vi.fn(),
  candidateKind: vi.fn(() => 'host'),
  countSdpCandidates: vi.fn(() => 0),
  createIceExchangeAudit: vi.fn(() => ({
    localGenerated: 0,
    localPushed: 0,
    localPushFailed: 0,
    endOfCandidatesLocal: false,
    remoteReceived: 0,
    remoteQueued: 0,
    remoteAdded: 0,
    remoteAddFailed: 0,
    remoteFlushed: 0,
    localTypes: {},
    remoteTypes: {},
  })),
  createWebRtcDebugStats: vi.fn(() => ({ sawRelayCandidate: false, turnErrors: 0 })),
  logIceStatsSnapshot: vi.fn(async () => {}),
  logIceExchangeAudit: vi.fn(),
  logWebRtcInfo: vi.fn(),
  logWebRtcWarn: vi.fn(),
  logWebRtcError: vi.fn(),
  noteEndOfCandidates: vi.fn(),
  noteLocalCandidate: vi.fn(),
  noteLocalPushed: vi.fn(),
  summarizeConnectionFailure: vi.fn(() => 'mock failure'),
}))

vi.mock('../../services/webrtc/iceFallback', () => ({
  attachLanFirstIceFallback: vi.fn(() => ({
    cleanup: vi.fn(),
    shouldDeferFailure: vi.fn(() => false),
  })),
  DIRECT_ICE_TIMEOUT_MS: 12_000,
}))
  createRemoteCandidateCollector: webrtc.createRemoteCandidateCollector,
}))
vi.mock('../../services/webrtc/dataChannel', () => ({
  createDataChannel: webrtc.createDataChannel,
  waitForDataChannel: webrtc.waitForDataChannel,
  waitForChannelOpen: webrtc.waitForChannelOpen,
}))

describe('usePeerSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    signaling.getRoomMeta.mockResolvedValue(null)
    signaling.roomExists.mockResolvedValue(true)
    signaling.isRoomExpired.mockReturnValue(false)
    signaling.hasAnswer.mockResolvedValue(false)
    signaling.readOffer.mockResolvedValue({ sdp: 'offer', type: 'offer' })
    webrtc.mockChannel.readyState = 'connecting'
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts in idle state', () => {
    const { result } = renderHook(() =>
      usePeerSession({ roomId: 'ABC123', role: 'creator' }),
    )

    expect(result.current.connectionState).toBe('idle')
    expect(result.current.error).toBeNull()
    expect(result.current.dataChannel).toBeNull()
  })

  it('does not start when disabled', () => {
    const { result } = renderHook(() =>
      usePeerSession({ roomId: 'ABC123', role: 'joiner', enabled: false }),
    )

    act(() => {
      result.current.start()
    })

    expect(signaling.roomExists).not.toHaveBeenCalled()
    expect(result.current.connectionState).toBe('idle')
  })

  it('starts creator flow and enters waiting state', async () => {
    const { result } = renderHook(() =>
      usePeerSession({ roomId: 'ABC123', role: 'creator' }),
    )

    act(() => {
      result.current.start()
    })

    await waitFor(() => {
      expect(result.current.connectionState).toBe('waiting')
    })

    expect(signaling.createRoomMeta).toHaveBeenCalledWith('ABC123')
    expect(signaling.writeOffer).toHaveBeenCalled()
    expect(webrtc.createDataChannel).toHaveBeenCalled()
  })

  it('connects creator when data channel opens', async () => {
    const { result } = renderHook(() =>
      usePeerSession({ roomId: 'ABC123', role: 'creator' }),
    )

    act(() => {
      result.current.start()
    })

    await waitFor(() => {
      expect(result.current.connectionState).toBe('waiting')
    })

    act(() => {
      webrtc.mockChannel.emitOpen()
    })

    await waitFor(() => {
      expect(result.current.connectionState).toBe('connected')
      expect(result.current.dataChannel).toBe(webrtc.mockChannel)
    })

    expect(signaling.deleteRoom).toHaveBeenCalledWith('ABC123')
  })

  it('only runs start once', async () => {
    const { result } = renderHook(() =>
      usePeerSession({ roomId: 'ABC123', role: 'creator' }),
    )

    act(() => {
      result.current.start()
      result.current.start()
    })

    await waitFor(() => {
      expect(signaling.createRoomMeta).toHaveBeenCalledTimes(1)
    })
  })

  it('shows error when joiner room does not exist', async () => {
    signaling.roomExists.mockResolvedValue(false)

    const { result } = renderHook(() =>
      usePeerSession({ roomId: 'ABC123', role: 'joiner' }),
    )

    act(() => {
      result.current.start()
    })

    await waitFor(() => {
      expect(result.current.connectionState).toBe('error')
      expect(result.current.error).toBe('Invalid session')
    })
  })

  it('shows error when joiner session is expired', async () => {
    signaling.getRoomMeta.mockResolvedValue({ createdAt: 1, status: 'waiting' })
    signaling.isRoomExpired.mockReturnValue(true)

    const { result } = renderHook(() =>
      usePeerSession({ roomId: 'ABC123', role: 'joiner' }),
    )

    act(() => {
      result.current.start()
    })

    await waitFor(() => {
      expect(result.current.connectionState).toBe('error')
      expect(result.current.error).toBe('Session expired')
    })
  })

  it('shows error when session already has an answer', async () => {
    signaling.getRoomMeta.mockResolvedValue({ createdAt: Date.now(), status: 'waiting' })
    signaling.isRoomExpired.mockReturnValue(false)
    signaling.hasAnswer.mockResolvedValue(true)

    const { result } = renderHook(() =>
      usePeerSession({ roomId: 'ABC123', role: 'joiner' }),
    )

    act(() => {
      result.current.start()
    })

    await waitFor(() => {
      expect(result.current.connectionState).toBe('error')
      expect(result.current.error).toBe('Session already in use')
    })
  })
})
