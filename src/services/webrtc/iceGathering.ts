const ICE_GATHER_TIMEOUT_MS = 15000

/**
 * Waits until ICE gathering finishes or times out.
 * Individual `icecandidateerror` events are normal (a STUN/TURN URL can fail
 * while others succeed) and must not abort the session.
 */
export function waitForIceGatheringComplete(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === 'complete') {
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => {
      cleanup()
      resolve()
    }, ICE_GATHER_TIMEOUT_MS)

    const onStateChange = () => {
      if (pc.iceGatheringState === 'complete') {
        cleanup()
        resolve()
      }
    }

    const cleanup = () => {
      window.clearTimeout(timeout)
      pc.removeEventListener('icegatheringstatechange', onStateChange)
    }

    pc.addEventListener('icegatheringstatechange', onStateChange)
  })
}

export function localSessionDescription(
  pc: RTCPeerConnection,
): { sdp: string; type: RTCSdpType } {
  const desc = pc.localDescription
  if (!desc?.sdp || !desc.type) {
    throw new Error('Local session description missing')
  }
  return { sdp: desc.sdp, type: desc.type }
}
