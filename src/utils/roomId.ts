import { ROOM_ID_LENGTH } from '../config/constants'

const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

export function generateRoomId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(ROOM_ID_LENGTH))
  return Array.from(bytes, (b) => CHARSET[b % CHARSET.length]).join('')
}

export function isValidRoomId(id: string): boolean {
  return new RegExp(`^[A-Z0-9]{${ROOM_ID_LENGTH}}$`).test(id)
}

export function getJoinUrl(roomId: string): string {
  const base =
    import.meta.env.VITE_APP_URL?.replace(/\/$/, '') ||
    window.location.origin
  return `${base}/join/${roomId}`
}
