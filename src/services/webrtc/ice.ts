/** Public TURN relay — used when direct LAN/host paths fail. */
const OPEN_RELAY_USER = 'openrelayproject'
const OPEN_RELAY_CRED = 'openrelayproject'

function openRelayServer(url: string): RTCIceServer {
  return { urls: url, username: OPEN_RELAY_USER, credential: OPEN_RELAY_CRED }
}

const OPEN_RELAY_TURNS: RTCIceServer[] = [
  openRelayServer('turn:openrelay.metered.ca:80'),
  openRelayServer('turn:openrelay.metered.ca:443'),
  openRelayServer('turn:openrelay.metered.ca:443?transport=tcp'),
  openRelayServer('turns:openrelay.metered.ca:443'),
]

const STUN_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

function getConfiguredTurnServers(): RTCIceServer[] {
  const urls = import.meta.env.VITE_TURN_URLS
  const username = import.meta.env.VITE_TURN_USERNAME
  const credential = import.meta.env.VITE_TURN_CREDENTIAL

  if (!urls?.trim() || !username?.trim() || !credential?.trim()) {
    return []
  }

  return urls.split(',').map((url) => ({
    urls: url.trim(),
    username,
    credential,
  }))
}

function getTurnServers(): RTCIceServer[] {
  const customTurn = getConfiguredTurnServers()
  return customTurn.length > 0 ? customTurn : OPEN_RELAY_TURNS
}

/** STUN-only — used in debug logs to describe the preferred direct path. */
export function getDirectIceConfiguration(): RTCConfiguration {
  return {
    iceServers: [...STUN_SERVERS],
    iceCandidatePoolSize: 0,
  }
}

/**
 * Initial PeerConnection config. TURN must be included at creation — Chrome
 * rejects adding iceServers later via setConfiguration. The ICE agent still
 * prefers host/srflx pairs; relay is used only when direct paths fail.
 */
export function getInitialIceConfiguration(): RTCConfiguration {
  return {
    iceServers: [...STUN_SERVERS, ...getTurnServers()],
    iceCandidatePoolSize: 0,
  }
}

/** @alias getInitialIceConfiguration */
export function getFullIceConfiguration(): RTCConfiguration {
  return getInitialIceConfiguration()
}

export function getIceConfiguration(): RTCConfiguration {
  return getInitialIceConfiguration()
}

export function hasTurnServers(): boolean {
  return getTurnServers().length > 0
}

/** Retry ICE with existing servers (incl. TURN). Cannot add TURN after PC creation. */
export function restartIceForRelayRetry(pc: RTCPeerConnection): void {
  pc.restartIce()
}
