/** Nominated ICE pair candidate type — matches WebRTC stats candidateType values. */
export type ConnectionPath = 'host' | 'srflx' | 'relay'

export interface ConnectionPathDetails {
  path: ConnectionPath
  localType?: string
  remoteType?: string
  pairState?: string
}

function readCandidateType(entry: object): string | undefined {
  const value = (entry as Record<string, unknown>).candidateType
  return typeof value === 'string' ? value : undefined
}

function readString(entry: object, key: string): string | undefined {
  const value = (entry as Record<string, unknown>)[key]
  return typeof value === 'string' ? value : undefined
}

function readBool(entry: object, key: string): boolean | undefined {
  const value = (entry as Record<string, unknown>)[key]
  return typeof value === 'boolean' ? value : undefined
}

function readNumber(entry: object, key: string): number {
  const value = (entry as Record<string, unknown>)[key]
  return typeof value === 'number' ? value : 0
}

function classifyNominatedPair(
  localType: string | undefined,
  remoteType: string | undefined,
): ConnectionPath | null {
  // Local relay is definitive for this device's egress (common on mobile/NAT).
  if (localType === 'relay') return 'relay'
  if (remoteType === 'relay') return 'relay'
  if (localType === 'host' || remoteType === 'host') return 'host'
  if (
    localType === 'srflx' ||
    remoteType === 'srflx' ||
    localType === 'prflx' ||
    remoteType === 'prflx'
  ) {
    return 'srflx'
  }
  if (localType || remoteType) return 'srflx'
  return null
}

interface CandidatePairRow {
  state: string
  localId?: string
  remoteId?: string
  bytes: number
}

function pairStateScore(state: string): number {
  if (state === 'succeeded') return 2
  if (state === 'in-progress') return 1
  return 0
}

/** Pick the active nominated pair — prefer succeeded pairs with traffic over stale in-progress ones. */
function pickActiveCandidatePair(report: RTCStatsReport): CandidatePairRow | null {
  const pairs: CandidatePairRow[] = []

  report.forEach((entry) => {
    if (entry.type !== 'candidate-pair') return
    if (!readBool(entry, 'nominated')) return

    const state = readString(entry, 'state') ?? ''
    if (state !== 'succeeded' && state !== 'in-progress') return

    pairs.push({
      state,
      localId: readString(entry, 'localCandidateId'),
      remoteId: readString(entry, 'remoteCandidateId'),
      bytes: readNumber(entry, 'bytesSent') + readNumber(entry, 'bytesReceived'),
    })
  })

  if (pairs.length === 0) return null

  pairs.sort((a, b) => {
    const byState = pairStateScore(b.state) - pairStateScore(a.state)
    if (byState !== 0) return byState
    return b.bytes - a.bytes
  })

  return pairs[0] ?? null
}

export interface SelectedConnectionPathOptions {
  /** Ignore in-progress pairs — avoids labeling "direct" before relay succeeds. */
  requireSucceeded?: boolean
}

/** Reads the nominated ICE pair from getStats and returns its candidate type. */
export async function getSelectedConnectionPath(
  pc: RTCPeerConnection,
  options: SelectedConnectionPathOptions = {},
): Promise<ConnectionPath | null> {
  const details = await getSelectedConnectionPathDetails(pc, options)
  return details?.path ?? null
}

export async function getSelectedConnectionPathDetails(
  pc: RTCPeerConnection,
  options: SelectedConnectionPathOptions = {},
): Promise<ConnectionPathDetails | null> {
  const report = await pc.getStats()
  const candidates = new Map<string, string | undefined>()

  report.forEach((entry) => {
    if (entry.type === 'local-candidate' || entry.type === 'remote-candidate') {
      candidates.set(entry.id, readCandidateType(entry))
    }
  })

  const pair = pickActiveCandidatePair(report)
  if (!pair) return null
  if (options.requireSucceeded && pair.state !== 'succeeded') return null

  const localType = pair.localId ? candidates.get(pair.localId) : undefined
  const remoteType = pair.remoteId ? candidates.get(pair.remoteId) : undefined
  const path = classifyNominatedPair(localType, remoteType)
  if (!path) return null

  return { path, localType, remoteType, pairState: pair.state }
}

export function connectionPathLabel(path: ConnectionPath): string {
  switch (path) {
    case 'host':
      return 'Local network (LAN)'
    case 'relay':
      return 'TURN relay'
    default:
      return 'Direct (WebRTC)'
  }
}
