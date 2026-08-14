import type { IcePhase, SessionRole } from '../../types/signaling'
import { listenForIcePhase, updateIcePhase } from '../firebase/signaling'
import { hasTurnServers, restartIceForRelayRetry } from './ice'
import { logWebRtcInfo, logWebRtcWarn } from './webrtcDebug'

/** Wait for ICE to finish trying direct pairs before showing relay-phase UI. */
export const DIRECT_ICE_TIMEOUT_MS = 12_000

export interface IceFallbackContext {
  roomId: string
  role: SessionRole
  onPhaseChange?: (phase: IcePhase) => void
}

export interface IceFallbackController {
  cleanup: () => void
  /** Suppress premature "failed" UI while an ICE restart retry is in progress. */
  shouldDeferFailure: () => boolean
}

export function attachLanFirstIceFallback(
  pc: RTCPeerConnection,
  ctx: IceFallbackContext,
): IceFallbackController {
  let relayPhaseEntered = false
  let iceRestartAttempted = false
  let checkingTimer: number | undefined

  const clearCheckingTimer = () => {
    if (checkingTimer !== undefined) {
      window.clearTimeout(checkingTimer)
      checkingTimer = undefined
    }
  }

  const enterRelayPhase = (reason: string) => {
    if (relayPhaseEntered) return
    relayPhaseEntered = true
    clearCheckingTimer()
    logWebRtcInfo(ctx, reason)
    ctx.onPhaseChange?.('relay')
    void updateIcePhase(ctx.roomId, 'relay').catch(() => {})
  }

  const retryIceAfterDirectFailure = (reason: string) => {
    if (iceRestartAttempted || !hasTurnServers()) return
    iceRestartAttempted = true
    enterRelayPhase(reason)
    try {
      restartIceForRelayRetry(pc)
    } catch (err) {
      logWebRtcWarn(ctx, 'restartIce failed during relay fallback', err)
    }
  }

  const scheduleCheckingTimeout = () => {
    if (relayPhaseEntered) return
    clearCheckingTimer()
    checkingTimer = window.setTimeout(() => {
      if (
        pc.iceConnectionState === 'checking' &&
        pc.connectionState !== 'connected' &&
        !relayPhaseEntered
      ) {
        enterRelayPhase(
          'direct ICE still checking after timeout — relay fallback allowed (TURN candidates already gathering)',
        )
      }
    }, DIRECT_ICE_TIMEOUT_MS)
  }

  const onIceState = () => {
    const state = pc.iceConnectionState
    if (state === 'checking') {
      scheduleCheckingTimeout()
    }
    if (state === 'connected' || state === 'completed') {
      clearCheckingTimer()
    }
    if (state === 'failed') {
      clearCheckingTimer()
      retryIceAfterDirectFailure(
        'direct ICE failed — retrying with relay candidates (restartIce)',
      )
    }
  }

  const onConnState = () => {
    if (pc.connectionState === 'connected') {
      clearCheckingTimer()
    }
    if (pc.connectionState === 'failed') {
      clearCheckingTimer()
      retryIceAfterDirectFailure(
        'connection failed on direct path — retrying with relay candidates (restartIce)',
      )
    }
  }

  pc.addEventListener('iceconnectionstatechange', onIceState)
  pc.addEventListener('connectionstatechange', onConnState)

  const unsubIcePhase = listenForIcePhase(ctx.roomId, (phase) => {
    if (phase === 'relay') {
      enterRelayPhase('peer reported direct path exhausted — relay fallback phase')
    }
  })

  logWebRtcInfo(
    ctx,
    'LAN-first ICE: browser prefers host/srflx; TURN available if direct pairs fail',
  )

  return {
    cleanup: () => {
      clearCheckingTimer()
      pc.removeEventListener('iceconnectionstatechange', onIceState)
      pc.removeEventListener('connectionstatechange', onConnState)
      unsubIcePhase()
    },
    shouldDeferFailure: () => {
      if (!hasTurnServers() || !iceRestartAttempted) return false
      return (
        pc.iceConnectionState === 'checking' ||
        pc.iceConnectionState === 'disconnected' ||
        pc.connectionState === 'connecting'
      )
    },
  }
}
