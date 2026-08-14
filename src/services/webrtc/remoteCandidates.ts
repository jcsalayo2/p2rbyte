import type { IceCandidatePayload } from '../../types/signaling'
import { addRemoteCandidate } from './peerConnection'
import {
  candidateKind,
  logWebRtcInfo,
  logWebRtcWarn,
  noteRemoteReceived,
  type IceExchangeAudit,
  type WebRtcDebugContext,
} from './webrtcDebug'

/** Queues ICE candidates until setRemoteDescription completes, then applies them. */
export function createRemoteCandidateCollector(
  pc: RTCPeerConnection,
  debug?: WebRtcDebugContext,
  audit?: IceExchangeAudit,
) {
  const pending: IceCandidatePayload[] = []
  const seen = new Set<string>()

  async function apply(payload: IceCandidatePayload, via: 'direct' | 'flush'): Promise<void> {
    const key = payload.candidate
    try {
      await addRemoteCandidate(pc, payload)
      if (audit) audit.remoteAdded += 1
      if (debug) {
        logWebRtcInfo(debug, `addIceCandidate OK (${via}, ${candidateKind(key)})`, key)
      }
    } catch (err) {
      if (audit) audit.remoteAddFailed += 1
      if (debug) {
        logWebRtcWarn(debug, `addIceCandidate FAILED (${via}, ${candidateKind(key)})`, {
          candidate: key.slice(0, 120),
          sdpMid: payload.sdpMid,
          sdpMLineIndex: payload.sdpMLineIndex,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }
  }

  async function add(payload: IceCandidatePayload): Promise<void> {
    const key = payload.candidate
    if (!key || seen.has(key)) return
    seen.add(key)

    if (audit) noteRemoteReceived(audit, key)
    if (debug) {
      logWebRtcInfo(debug, `remote candidate received (${candidateKind(key)})`, key)
    }

    if (!pc.remoteDescription) {
      pending.push(payload)
      if (audit) audit.remoteQueued += 1
      if (debug) {
        logWebRtcInfo(debug, `remote candidate queued (remoteDescription not set yet)`, {
          kind: candidateKind(key),
          pendingCount: pending.length,
        })
      }
      return
    }

    await apply(payload, 'direct')
  }

  async function flush(): Promise<void> {
    const queue = pending.splice(0, pending.length)
    if (debug && queue.length > 0) {
      logWebRtcInfo(debug, `flushing ${queue.length} queued remote candidate(s)`)
    }
    if (audit) audit.remoteFlushed += queue.length
    for (const payload of queue) {
      await apply(payload, 'flush')
    }
  }

  return { add, flush }
}
