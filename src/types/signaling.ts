export type RoomStatus = 'waiting' | 'connecting' | 'connected'

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
