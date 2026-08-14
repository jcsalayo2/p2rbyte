export type RoomStatus = 'waiting' | 'connecting' | 'connected'

/** ICE gathering phase — direct defers TURN until LAN/host paths fail. */
export type IcePhase = 'direct' | 'relay'

export type SessionRole = 'creator' | 'joiner'

export type ConnectionState =
  | 'idle'
  | 'waiting'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'failed'
  | 'error'

export interface RoomMeta {
  createdAt: number
  status: RoomStatus
  icePhase?: IcePhase
}

export interface SessionDescription {
  sdp: string
  type: RTCSdpType
}

export interface IceCandidatePayload {
  candidate: string
  sdpMid: string | null
  sdpMLineIndex: number | null
}
