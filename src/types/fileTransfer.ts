export type FileTransferStatus =
  | 'preparing'
  | 'sending'
  | 'receiving'
  | 'complete'
  | 'error'

export interface FileEntry {
  transferId: string
  name: string
  size: number
  mimeType: string
  direction: 'sent' | 'received'
  status: FileTransferStatus
  blobUrl?: string
  error?: string
  completedAt?: number
}

export interface FileStartMessage {
  type: 'file-start'
  transferId: string
  name: string
  size: number
  mimeType: string
}

export interface FileEndMessage {
  type: 'file-end'
  transferId: string
}

export interface FileAbortMessage {
  type: 'file-abort'
  transferId: string
  reason?: string
}

export type FileControlMessage = FileStartMessage | FileEndMessage | FileAbortMessage
