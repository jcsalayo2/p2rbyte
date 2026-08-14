import type { IceCandidatePayload } from '../../types/signaling'
import { get, onChildAdded, ref, type Unsubscribe } from 'firebase/database'
import { database } from './app'

function listenForCandidates(
  roomId: string,
  side: 'callerCandidates' | 'calleeCandidates',
  onCandidate: (candidate: IceCandidatePayload) => void,
): Unsubscribe {
  const listRef = ref(database, `rooms/${roomId}/${side}`)
  const seen = new Set<string>()

  const deliver = (payload: IceCandidatePayload) => {
    const key = payload.candidate ?? ''
    if (!key || seen.has(key)) return
    seen.add(key)
    onCandidate(payload)
  }

  void get(listRef).then((snap) => {
    if (!snap.exists()) return
    snap.forEach((child) => deliver(child.val()))
  })

  return onChildAdded(listRef, (snap) => deliver(snap.val()))
}

export function listenForCallerCandidates(
  roomId: string,
  onCandidate: (candidate: IceCandidatePayload) => void,
): Unsubscribe {
  return listenForCandidates(roomId, 'callerCandidates', onCandidate)
}

export function listenForCalleeCandidates(
  roomId: string,
  onCandidate: (candidate: IceCandidatePayload) => void,
): Unsubscribe {
  return listenForCandidates(roomId, 'calleeCandidates', onCandidate)
}
