import { useCallback, useEffect, useRef, useState } from 'react'
import type { ConnectionState, SessionRole } from '../types/signaling'
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
  pushCalleeCandidate,
  pushCallerCandidate,
  readOffer,
  registerOnDisconnectRemove,
  roomExists,
  updateRoomStatus,
  writeAnswer,
  writeOffer,
} from '../services/firebase/signaling'
import {
  addRemoteCandidate,
  createPeerConnection,
  trackConnectionState,
  trackIceCandidates,
} from '../services/webrtc/peerConnection'
import {
  createDataChannel,
  waitForChannelOpen,
  waitForDataChannel,
} from '../services/webrtc/dataChannel'

interface UsePeerSessionOptions {
  roomId: string
  role: SessionRole
  enabled?: boolean
}

interface UsePeerSessionResult {
  connectionState: ConnectionState
  error: string | null
  start: () => void
}

export function usePeerSession({
  roomId,
  role,
  enabled = true,
}: UsePeerSessionOptions): UsePeerSessionResult {
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle')
  const [error, setError] = useState<string | null>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const channelRef = useRef<RTCDataChannel | null>(null)
  const startedRef = useRef(false)
  const unsubRef = useRef<(() => void)[]>([])
  const seenCandidatesRef = useRef(new Set<string>())

  const cleanup = useCallback(async () => {
    unsubRef.current.forEach((fn) => fn())
    unsubRef.current = []
    seenCandidatesRef.current.clear()
    channelRef.current?.close()
    channelRef.current = null
    pcRef.current?.close()
    pcRef.current = null
  }, [])

  const onConnected = useCallback(async () => {
    setConnectionState('connected')
    try {
      await deleteRoom(roomId)
      await cancelOnDisconnect(roomId)
    } catch {
      // room may already be gone
    }
  }, [roomId])

  const startCreator = useCallback(async () => {
    setConnectionState('waiting')
    setError(null)

    const meta = await getRoomMeta(roomId)
    if (meta && isRoomExpired(meta.createdAt)) {
      await deleteRoom(roomId)
      setConnectionState('error')
      setError('Session expired')
      return
    }

    if (!meta) {
      await registerOnDisconnectRemove(roomId)
      await createRoomMeta(roomId)
    }

    const pc = createPeerConnection()
    pcRef.current = pc

    const channel = createDataChannel(pc)
    channelRef.current = channel

    channel.addEventListener('open', () => {
      void onConnected()
    })

    channel.addEventListener('close', () => {
      setConnectionState('disconnected')
    })

    const stopIce = trackIceCandidates(pc, (candidate) => {
      void pushCallerCandidate(roomId, candidate)
    })
    unsubRef.current.push(stopIce)

    const stopConn = trackConnectionState(pc, (state) => {
      if (state === 'connecting') setConnectionState('connecting')
      if (state === 'failed') {
        setConnectionState('failed')
        setError('Connection failed')
      }
      if (state === 'disconnected') setConnectionState('disconnected')
    })
    unsubRef.current.push(stopConn)

    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    await writeOffer(roomId, {
      sdp: offer.sdp ?? '',
      type: offer.type,
    })

    const seenAnswer = new Set<string>()
    const unsubAnswer = listenForAnswer(roomId, async (answer) => {
      const key = answer.sdp.slice(0, 32)
      if (seenAnswer.has(key)) return
      seenAnswer.add(key)

      setConnectionState('connecting')
      await updateRoomStatus(roomId, 'connecting')
      await pc.setRemoteDescription(new RTCSessionDescription(answer))
    })
    unsubRef.current.push(unsubAnswer)

    const unsubCallee = listenForCalleeCandidates(roomId, async (candidate) => {
      const key = candidate.candidate
      if (!key || seenCandidatesRef.current.has(key)) return
      seenCandidatesRef.current.add(key)
      try {
        await addRemoteCandidate(pc, candidate)
      } catch {
        // ignore duplicate/stale candidates
      }
    })
    unsubRef.current.push(unsubCallee)
  }, [roomId, onConnected])

  const startJoiner = useCallback(async () => {
    setConnectionState('connecting')
    setError(null)

    const exists = await roomExists(roomId)
    if (!exists) {
      setConnectionState('error')
      setError('Invalid session')
      return
    }

    const meta = await getRoomMeta(roomId)
    if (!meta || isRoomExpired(meta.createdAt)) {
      await deleteRoom(roomId)
      setConnectionState('error')
      setError('Session expired')
      return
    }

    if (await hasAnswer(roomId)) {
      setConnectionState('error')
      setError('Session already in use')
      return
    }

    await registerOnDisconnectRemove(roomId)

    let offer = await readOffer(roomId)
    if (!offer) {
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

    const pc = createPeerConnection()
    pcRef.current = pc

    const stopConn = trackConnectionState(pc, (state) => {
      if (state === 'connecting') setConnectionState('connecting')
      if (state === 'failed') {
        setConnectionState('failed')
        setError('Connection failed')
      }
      if (state === 'disconnected') setConnectionState('disconnected')
    })
    unsubRef.current.push(stopConn)

    const stopIce = trackIceCandidates(pc, (candidate) => {
      void pushCalleeCandidate(roomId, candidate)
    })
    unsubRef.current.push(stopIce)

    const channelPromise = waitForDataChannel(pc)
    channelPromise.then((channel) => {
      channelRef.current = channel
      channel.addEventListener('open', () => {
        void onConnected()
      })
      channel.addEventListener('close', () => {
        setConnectionState('disconnected')
      })
    })

    await pc.setRemoteDescription(new RTCSessionDescription(offer!))

    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    await writeAnswer(roomId, {
      sdp: answer.sdp ?? '',
      type: answer.type,
    })

    const unsubCaller = listenForCallerCandidates(roomId, async (candidate) => {
      const key = candidate.candidate
      if (!key || seenCandidatesRef.current.has(key)) return
      seenCandidatesRef.current.add(key)
      try {
        await addRemoteCandidate(pc, candidate)
      } catch {
        // ignore duplicate/stale candidates
      }
    })
    unsubRef.current.push(unsubCaller)

    try {
      const channel = await channelPromise
      await waitForChannelOpen(channel)
    } catch (err) {
      setConnectionState('failed')
      setError(err instanceof Error ? err.message : 'Connection failed')
    }
  }, [roomId, onConnected])

  const start = useCallback(() => {
    if (startedRef.current || !enabled) return
    startedRef.current = true

    const run = role === 'creator' ? startCreator : startJoiner
    void run().catch((err) => {
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

  return { connectionState, error, start }
}
