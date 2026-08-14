import type { IceCandidatePayload } from '../../types/signaling'
import { getInitialIceConfiguration } from './ice'

export function createPeerConnection(): RTCPeerConnection {
  if (typeof RTCPeerConnection === 'undefined') {
    throw new Error('WebRTC is not supported in this browser')
  }
  return new RTCPeerConnection(getInitialIceConfiguration())
}

export function serializeCandidate(
  candidate: RTCIceCandidate,
): IceCandidatePayload {
  return {
    candidate: candidate.candidate,
    sdpMid: candidate.sdpMid,
    sdpMLineIndex: candidate.sdpMLineIndex,
  }
}

export async function addRemoteCandidate(
  pc: RTCPeerConnection,
  payload: IceCandidatePayload,
): Promise<void> {
  if (!payload.candidate) return
  await pc.addIceCandidate(
    new RTCIceCandidate({
      candidate: payload.candidate,
      sdpMid: payload.sdpMid,
      sdpMLineIndex: payload.sdpMLineIndex,
    }),
  )
}

export function trackIceCandidates(
  pc: RTCPeerConnection,
  onCandidate: (payload: IceCandidatePayload) => void,
  onEndOfCandidates?: () => void,
): () => void {
  const handler = (event: RTCPeerConnectionIceEvent) => {
    if (event.candidate) {
      onCandidate(serializeCandidate(event.candidate))
    } else {
      onEndOfCandidates?.()
    }
  }
  pc.addEventListener('icecandidate', handler)
  return () => pc.removeEventListener('icecandidate', handler)
}

export function trackConnectionState(
  pc: RTCPeerConnection,
  onStateChange: (state: RTCPeerConnectionState) => void,
): () => void {
  const handler = () => onStateChange(pc.connectionState)
  pc.addEventListener('connectionstatechange', handler)
  return () => pc.removeEventListener('connectionstatechange', handler)
}

export function trackIceConnectionState(
  pc: RTCPeerConnection,
  onStateChange: (state: RTCIceConnectionState) => void,
): () => void {
  const handler = () => onStateChange(pc.iceConnectionState)
  pc.addEventListener('iceconnectionstatechange', handler)
  return () => pc.removeEventListener('iceconnectionstatechange', handler)
}
