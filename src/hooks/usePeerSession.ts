import { useCallback, useEffect, useRef, useState } from 'react'
import type { ConnectionState, IcePhase, SessionRole } from '../types/signaling'
import {
  cancelOnDisconnect,
  createRoomMeta,
  deleteRoom,
  getRoomMeta,
  hasAnswer,
  isRoomExpired,
  listenForAnswer,
  listenForCalleeCandidates,
  listenForCallerCandidates,
  listenForOffer,
  listenForRoomStatus,
  pushCalleeCandidate,
  pushCallerCandidate,
  readOffer,
  registerOnDisconnectRemove,
  resetSignalingExchange,
  roomExists,
  updateRoomStatus,
  writeAnswer,
  writeOffer,
} from '../services/firebase/signaling'
import {
  createPeerConnection,
  trackConnectionState,
  trackIceCandidates,
  trackIceConnectionState,
} from '../services/webrtc/peerConnection'
import { createRemoteCandidateCollector } from '../services/webrtc/remoteCandidates'
import { localSessionDescription } from '../services/webrtc/iceGathering'
import {
  attachDataChannelDebug,
  attachWebRtcDebug,
  candidateKind,
  countSdpCandidates,
  createIceExchangeAudit,
  createWebRtcDebugStats,
  logIceStatsSnapshot,
  logIceExchangeAudit,
  logWebRtcError,
  logWebRtcInfo,
  noteEndOfCandidates,
  noteLocalCandidate,
  noteLocalPushed,
  summarizeConnectionFailure,
  type IceExchangeAudit,
  type WebRtcDebugStats,
} from '../services/webrtc/webrtcDebug'
import {
  createDataChannel,
  waitForChannelOpen,
  waitForDataChannel,
} from '../services/webrtc/dataChannel'
import {
  getSelectedConnectionPathDetails,
  type ConnectionPath,
} from '../services/webrtc/selectedCandidate'
import { attachLanFirstIceFallback } from '../services/webrtc/iceFallback'

interface UsePeerSessionOptions {
  roomId: string
  role: SessionRole
  enabled?: boolean
}

interface UsePeerSessionResult {
  connectionState: ConnectionState
  connectionPath: ConnectionPath | null
  icePhase: IcePhase
  error: string | null
  start: () => void
  dataChannel: RTCDataChannel | null
}

export function usePeerSession({
  roomId,
  role,
  enabled = true,
}: UsePeerSessionOptions): UsePeerSessionResult {
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle')
  const [connectionPath, setConnectionPath] = useState<ConnectionPath | null>(null)
  const [icePhase, setIcePhase] = useState<IcePhase>('direct')
  const [error, setError] = useState<string | null>(null)
  const [dataChannel, setDataChannel] = useState<RTCDataChannel | null>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const channelRef = useRef<RTCDataChannel | null>(null)
  const startedRef = useRef(false)
  const unsubRef = useRef<(() => void)[]>([])

  const debugStatsRef = useRef<WebRtcDebugStats | null>(null)
  const exchangeAuditRef = useRef<IceExchangeAudit | null>(null)

  const logFailureDiagnostics = useCallback(
    (debugCtx: { roomId: string; role: SessionRole }, pc: RTCPeerConnection) => {
      const audit = exchangeAuditRef.current ?? undefined
      if (audit) {
        logIceExchangeAudit(debugCtx, audit)
      }
      void logIceStatsSnapshot(pc, debugCtx, 'failure', audit)
    },
    [],
  )

  const bindPeerConnection = useCallback(
    (pc: RTCPeerConnection, debugCtx: { roomId: string; role: SessionRole }) => {
      const stats = createWebRtcDebugStats()
      debugStatsRef.current = stats
      const audit = exchangeAuditRef.current ?? createIceExchangeAudit()
      exchangeAuditRef.current = audit
      const stopDebug = attachWebRtcDebug(pc, debugCtx, stats, audit)

      const stopIce = trackIceCandidates(
        pc,
        (candidate) => {
          const audit = exchangeAuditRef.current
          if (audit) {
            noteLocalCandidate(audit, candidate.candidate)
          }
          logWebRtcInfo(
            debugCtx,
            `local candidate → Firebase (${candidateKind(candidate.candidate)})`,
            candidate.candidate,
          )
          const push =
            debugCtx.role === 'creator' ? pushCallerCandidate : pushCalleeCandidate
          void push(debugCtx.roomId, candidate)
            .then(() => {
              if (audit) noteLocalPushed(audit, true)
            })
            .catch((err) => {
              if (audit) noteLocalPushed(audit, false)
              logWebRtcError(debugCtx, 'failed to push ICE candidate to Firebase', err)
            })
        },
        () => {
          if (exchangeAuditRef.current) noteEndOfCandidates(exchangeAuditRef.current)
          logWebRtcInfo(
            debugCtx,
            'local end-of-candidates (not sent to Firebase — normal for trickle ICE)',
          )
        },
      )
      unsubRef.current.push(stopIce)
      unsubRef.current.push(stopDebug)

      const iceFallback = attachLanFirstIceFallback(pc, {
        roomId: debugCtx.roomId,
        role: debugCtx.role,
        onPhaseChange: setIcePhase,
      })
      unsubRef.current.push(iceFallback.cleanup)

      const stopConn = trackConnectionState(pc, (state) => {
        if (state === 'connecting') setConnectionState('connecting')
        if (state === 'failed') {
          if (iceFallback.shouldDeferFailure()) return
          logFailureDiagnostics(debugCtx, pc)
          const reason = summarizeConnectionFailure(pc, exchangeAuditRef.current ?? undefined)
          logWebRtcError(debugCtx, reason)
          setConnectionState('failed')
          setError(reason)
          if (debugCtx.role === 'creator') void resetSignalingExchange(debugCtx.roomId)
        }
        if (state === 'disconnected') setConnectionState('disconnected')
      })
      unsubRef.current.push(stopConn)

      const stopIceConn = trackIceConnectionState(pc, (state) => {
        if (state === 'checking') setConnectionState('connecting')
        if (state === 'failed') {
          if (iceFallback.shouldDeferFailure()) return
          logFailureDiagnostics(debugCtx, pc)
          const reason = summarizeConnectionFailure(pc, exchangeAuditRef.current ?? undefined)
          logWebRtcError(debugCtx, reason)
          setConnectionState('failed')
          setError(reason)
          if (debugCtx.role === 'creator') void resetSignalingExchange(debugCtx.roomId)
        }
      })
      unsubRef.current.push(stopIceConn)
    },
    [logFailureDiagnostics],
  )

  const detectConnectionPath = useCallback(async () => {
    const pc = pcRef.current
    if (!pc) return

    const polls: Array<{ delayMs: number; requireSucceeded: boolean }> = [
      { delayMs: 0, requireSucceeded: false },
      { delayMs: 500, requireSucceeded: false },
      { delayMs: 1500, requireSucceeded: true },
      { delayMs: 3000, requireSucceeded: true },
      { delayMs: 6000, requireSucceeded: true },
      { delayMs: 10_000, requireSucceeded: true },
    ]

    let lastPath: ConnectionPath | null = null

    for (const { delayMs, requireSucceeded } of polls) {
      if (delayMs > 0) {
        await new Promise((resolve) => window.setTimeout(resolve, delayMs))
      }
      if (!pcRef.current) return

      const details = await getSelectedConnectionPathDetails(pcRef.current, {
        requireSucceeded,
      })
      if (!details) continue

      if (details.path !== lastPath) {
        lastPath = details.path
        setConnectionPath(details.path)
        logWebRtcInfo(
          { roomId, role },
          `connection route → ${details.path} (local=${details.localType ?? '?'}, remote=${details.remoteType ?? '?'}, pair=${details.pairState ?? '?'})`,
        )
      }

      // Relay is final — no need to keep polling once both sides would agree.
      if (details.path === 'relay' && details.pairState === 'succeeded') return
    }
  }, [roomId, role])

  const cleanup = useCallback(async () => {
    unsubRef.current.forEach((fn) => fn())
    unsubRef.current = []
    channelRef.current?.close()
    channelRef.current = null
    setDataChannel(null)
    setConnectionPath(null)
    setIcePhase('direct')
    pcRef.current?.close()
    pcRef.current = null
  }, [])

  const onConnected = useCallback(async () => {
    setConnectionState('connected')
    void detectConnectionPath()
    try {
      await deleteRoom(roomId)
      await cancelOnDisconnect(roomId)
    } catch {
      // room may already be gone
    }
  }, [roomId, detectConnectionPath])

  const startCreator = useCallback(async () => {
    const debugCtx = { roomId, role: 'creator' as const }
    setConnectionState('waiting')
    setConnectionPath(null)
    setIcePhase('direct')
    setError(null)
    logWebRtcInfo(debugCtx, 'starting creator session')

    const meta = await getRoomMeta(roomId)
    if (meta && isRoomExpired(meta.createdAt)) {
      await deleteRoom(roomId)
      setConnectionState('error')
      setError('Session expired')
      logWebRtcError(debugCtx, 'session expired')
      return
    }

    if (!meta) {
      await registerOnDisconnectRemove(roomId)
      await createRoomMeta(roomId)
    } else {
      await registerOnDisconnectRemove(roomId)
      await resetSignalingExchange(roomId)
      await updateRoomStatus(roomId, 'waiting')
    }

    const pc = createPeerConnection()
    pcRef.current = pc
    exchangeAuditRef.current = createIceExchangeAudit()
    const remoteCandidates = createRemoteCandidateCollector(pc, debugCtx, exchangeAuditRef.current)
    bindPeerConnection(pc, debugCtx)

    const channel = createDataChannel(pc)
    channelRef.current = channel
    attachDataChannelDebug(channel, debugCtx, 'outbound data channel')

    channel.addEventListener('open', () => {
      logWebRtcInfo(debugCtx, 'connected — data channel open')
      setDataChannel(channel)
      void onConnected()
    })

    channel.addEventListener('close', () => {
      setDataChannel(null)
      setConnectionPath(null)
      setConnectionState('disconnected')
    })

    const unsubStatus = listenForRoomStatus(roomId, (status) => {
      if (status === 'connecting') {
        logWebRtcInfo(debugCtx, 'joiner reported connecting via room status')
        setConnectionState('connecting')
      }
    })
    unsubRef.current.push(unsubStatus)

    const seenAnswer = new Set<string>()
    const unsubAnswer = listenForAnswer(roomId, async (answer) => {
      const key = answer.sdp.slice(0, 32)
      if (seenAnswer.has(key)) return
      seenAnswer.add(key)

      logWebRtcInfo(debugCtx, 'received answer from joiner')
      setConnectionState('connecting')
      try {
        await updateRoomStatus(roomId, 'connecting')
        await pc.setRemoteDescription(new RTCSessionDescription(answer))
        await remoteCandidates.flush()
        logWebRtcInfo(debugCtx, 'applied remote answer', {
          sdpCandidatesInAnswer: countSdpCandidates(answer.sdp),
          sdpCandidatesInRemoteDescription: countSdpCandidates(pc.remoteDescription?.sdp),
          remoteAddedSoFar: exchangeAuditRef.current?.remoteAdded ?? 0,
          remoteReceivedSoFar: exchangeAuditRef.current?.remoteReceived ?? 0,
          remoteTypes: exchangeAuditRef.current?.remoteTypes ?? {},
        })
      } catch (err) {
        logWebRtcError(debugCtx, 'failed to apply answer', err)
        setConnectionState('error')
        setError(err instanceof Error ? err.message : 'Failed to apply answer')
      }
    })
    unsubRef.current.push(unsubAnswer)

    const unsubCallee = listenForCalleeCandidates(roomId, (candidate) => {
      logWebRtcInfo(
        debugCtx,
        `creator received joiner candidate from Firebase (${candidateKind(candidate.candidate)})`,
        candidate.candidate,
      )
      void remoteCandidates.add(candidate)
    })
    unsubRef.current.push(unsubCallee)

    try {
      await pc.createOffer()
      await pc.setLocalDescription()
      await writeOffer(roomId, localSessionDescription(pc))
      logWebRtcInfo(debugCtx, 'offer written to Firebase')
    } catch (err) {
      logWebRtcError(debugCtx, 'failed to create/write offer', err)
      throw err
    }
  }, [roomId, onConnected, bindPeerConnection])

  const startJoiner = useCallback(async () => {
    const debugCtx = { roomId, role: 'joiner' as const }
    setConnectionState('connecting')
    setConnectionPath(null)
    setIcePhase('direct')
    setError(null)
    logWebRtcInfo(debugCtx, 'starting joiner session')

    const exists = await roomExists(roomId)
    if (!exists) {
      setConnectionState('error')
      setError('Invalid session')
      logWebRtcError(debugCtx, 'room does not exist')
      return
    }

    const meta = await getRoomMeta(roomId)
    if (!meta || isRoomExpired(meta.createdAt)) {
      await deleteRoom(roomId)
      setConnectionState('error')
      setError('Session expired')
      logWebRtcError(debugCtx, 'session expired')
      return
    }

    if (await hasAnswer(roomId)) {
      setConnectionState('error')
      setError('Session already in use')
      logWebRtcError(debugCtx, 'answer already exists — host must start a new session')
      return
    }

    await updateRoomStatus(roomId, 'connecting')

    let offer = await readOffer(roomId)
    if (!offer) {
      logWebRtcInfo(debugCtx, 'waiting for host offer…')
      offer = await new Promise((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          unsub()
          reject(new Error('Host not ready — try again'))
        }, 30000)
        const unsub = listenForOffer(roomId, (incoming) => {
          window.clearTimeout(timeout)
          unsub()
          resolve(incoming)
        })
      })
    }
    logWebRtcInfo(debugCtx, 'offer received')

    const pc = createPeerConnection()
    pcRef.current = pc
    exchangeAuditRef.current = createIceExchangeAudit()
    const remoteCandidates = createRemoteCandidateCollector(pc, debugCtx, exchangeAuditRef.current)
    bindPeerConnection(pc, debugCtx)

    const channelPromise = waitForDataChannel(pc)
    channelPromise.then((channel) => {
      channelRef.current = channel
      attachDataChannelDebug(channel, debugCtx, 'inbound data channel')
      channel.addEventListener('open', () => {
        logWebRtcInfo(debugCtx, 'connected — data channel open')
        setDataChannel(channel)
        void onConnected()
      })
      channel.addEventListener('close', () => {
        setDataChannel(null)
        setConnectionState('disconnected')
      })
    })

    const unsubCaller = listenForCallerCandidates(roomId, (candidate) => {
      void remoteCandidates.add(candidate)
    })
    unsubRef.current.push(unsubCaller)

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer!))
      await remoteCandidates.flush()
      logWebRtcInfo(debugCtx, 'applied remote offer', {
        sdpCandidatesInOffer: countSdpCandidates(offer!.sdp),
        sdpCandidatesInRemoteDescription: countSdpCandidates(pc.remoteDescription?.sdp),
        remoteAddedSoFar: exchangeAuditRef.current?.remoteAdded ?? 0,
        remoteReceivedSoFar: exchangeAuditRef.current?.remoteReceived ?? 0,
        remoteTypes: exchangeAuditRef.current?.remoteTypes ?? {},
      })

      await pc.createAnswer()
      await pc.setLocalDescription()
      await writeAnswer(roomId, localSessionDescription(pc))
      logWebRtcInfo(debugCtx, 'answer written to Firebase')
    } catch (err) {
      logWebRtcError(debugCtx, 'signaling failed', err)
      setConnectionState('error')
      setError(err instanceof Error ? err.message : 'Signaling failed')
      return
    }

    try {
      const channel = await channelPromise
      await waitForChannelOpen(channel)
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Connection failed'
      if (pcRef.current) {
        logFailureDiagnostics(debugCtx, pcRef.current)
      }
      logWebRtcError(debugCtx, reason, pcRef.current ? summarizeConnectionFailure(pcRef.current, exchangeAuditRef.current ?? undefined) : undefined)
      setConnectionState('failed')
      setError(reason)
    }
  }, [roomId, onConnected, bindPeerConnection])

  const start = useCallback(() => {
    if (startedRef.current || !enabled) return
    startedRef.current = true

    const run = role === 'creator' ? startCreator : startJoiner
    void run().catch((err) => {
      const debugCtx = { roomId, role }
      logWebRtcError(debugCtx, 'session start failed', err)
      setConnectionState('error')
      setError(err instanceof Error ? err.message : 'Something went wrong')
    })
  }, [role, startCreator, startJoiner, enabled])

  useEffect(() => {
    return () => {
      void cleanup()
    }
  }, [cleanup])

  useEffect(() => {
    if (!enabled) return

    const expiryTimer = window.setInterval(async () => {
      if (connectionState !== 'waiting' && connectionState !== 'connecting') return
      const meta = await getRoomMeta(roomId)
      if (meta && isRoomExpired(meta.createdAt)) {
        await deleteRoom(roomId)
        setConnectionState('error')
        setError('Session expired')
        void cleanup()
      }
    }, 30000)

    return () => window.clearInterval(expiryTimer)
  }, [enabled, roomId, connectionState, cleanup])

  return { connectionState, connectionPath, icePhase, error, start, dataChannel }
}
