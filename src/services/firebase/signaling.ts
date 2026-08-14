import type { IceCandidatePayload, SessionDescription } from '../../types/signaling'
import { ROOM_EXPIRY_MS } from '../../config/constants'
import {
  ref,
  set,
  get,
  push,
  remove,
  onValue,
  onDisconnect,
  serverTimestamp,
  type DatabaseReference,
  type Unsubscribe,
} from 'firebase/database'
import { database } from './app'

function roomRef(roomId: string): DatabaseReference {
  return ref(database, `rooms/${roomId}`)
}

export function isRoomExpired(createdAt: number | null): boolean {
  if (!createdAt) return true
  return Date.now() - createdAt > ROOM_EXPIRY_MS
}

export async function registerOnDisconnectRemove(roomId: string): Promise<void> {
  await onDisconnect(roomRef(roomId)).remove()
}

export async function cancelOnDisconnect(roomId: string): Promise<void> {
  await onDisconnect(roomRef(roomId)).cancel()
}

export async function deleteRoom(roomId: string): Promise<void> {
  await remove(roomRef(roomId))
}

export async function createRoomMeta(roomId: string): Promise<void> {
  await set(ref(database, `rooms/${roomId}/meta`), {
    createdAt: serverTimestamp(),
    status: 'waiting',
  })
}

export async function getRoomMeta(
  roomId: string,
): Promise<{ createdAt: number; status: string } | null> {
  const snap = await get(ref(database, `rooms/${roomId}/meta`))
  if (!snap.exists()) return null
  return snap.val()
}

export async function roomExists(roomId: string): Promise<boolean> {
  const snap = await get(roomRef(roomId))
  return snap.exists()
}

export async function hasAnswer(roomId: string): Promise<boolean> {
  const snap = await get(ref(database, `rooms/${roomId}/answer`))
  return snap.exists()
}

export async function writeOffer(
  roomId: string,
  offer: SessionDescription,
): Promise<void> {
  await set(ref(database, `rooms/${roomId}/offer`), offer)
}

export async function writeAnswer(
  roomId: string,
  answer: SessionDescription,
): Promise<void> {
  await set(ref(database, `rooms/${roomId}/answer`), answer)
}

export async function readOffer(roomId: string): Promise<SessionDescription | null> {
  const snap = await get(ref(database, `rooms/${roomId}/offer`))
  if (!snap.exists()) return null
  return snap.val()
}

export async function pushCallerCandidate(
  roomId: string,
  candidate: IceCandidatePayload,
): Promise<void> {
  await push(ref(database, `rooms/${roomId}/callerCandidates`), candidate)
}

export async function pushCalleeCandidate(
  roomId: string,
  candidate: IceCandidatePayload,
): Promise<void> {
  await push(ref(database, `rooms/${roomId}/calleeCandidates`), candidate)
}

export function listenForAnswer(
  roomId: string,
  onAnswer: (answer: SessionDescription) => void,
): Unsubscribe {
  return onValue(ref(database, `rooms/${roomId}/answer`), (snap) => {
    if (snap.exists()) onAnswer(snap.val())
  })
}

export function listenForOffer(
  roomId: string,
  onOffer: (offer: SessionDescription) => void,
): Unsubscribe {
  return onValue(ref(database, `rooms/${roomId}/offer`), (snap) => {
    if (snap.exists()) onOffer(snap.val())
  })
}

export function listenForCallerCandidates(
  roomId: string,
  onCandidate: (candidate: IceCandidatePayload) => void,
): Unsubscribe {
  return onValue(ref(database, `rooms/${roomId}/callerCandidates`), (snap) => {
    if (!snap.exists()) return
    snap.forEach((child) => {
      onCandidate(child.val())
    })
  })
}

export function listenForCalleeCandidates(
  roomId: string,
  onCandidate: (candidate: IceCandidatePayload) => void,
): Unsubscribe {
  return onValue(ref(database, `rooms/${roomId}/calleeCandidates`), (snap) => {
    if (!snap.exists()) return
    snap.forEach((child) => {
      onCandidate(child.val())
    })
  })
}

export async function updateRoomStatus(
  roomId: string,
  status: 'waiting' | 'connecting' | 'connected',
): Promise<void> {
  await set(ref(database, `rooms/${roomId}/meta/status`), status)
}
