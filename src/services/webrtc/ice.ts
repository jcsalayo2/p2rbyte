const STUN_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

const TURN_SERVERS: RTCIceServer[] = []

export function getIceConfiguration(): RTCConfiguration {
  return {
    iceServers: [...STUN_SERVERS, ...TURN_SERVERS],
  }
}
