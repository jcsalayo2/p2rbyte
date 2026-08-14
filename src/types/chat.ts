export interface ChatMessage {
  id: string
  text: string
  sentAt: number
  isLocal: boolean
}

export interface ChatWireMessage {
  type: 'chat'
  id: string
  text: string
  sentAt: number
}

export type WireMessage = ChatWireMessage
