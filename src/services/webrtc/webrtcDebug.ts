import type { SessionRole } from '../../types/signaling'
import { getDirectIceConfiguration, getFullIceConfiguration } from './ice'

const PREFIX = '[P2RBYTE WebRTC]'

export interface WebRtcDebugContext {
  roomId: string
  role: SessionRole
}

function tag(ctx: WebRtcDebugContext): string {
  return `${PREFIX} [${ctx.role} ${ctx.roomId}]`
}

export function candidateKind(candidate: string): string {
  if (candidate.includes(' typ relay ')) return 'relay'
  if (candidate.includes(' typ srflx ')) return 'srflx'
  if (candidate.includes(' typ host ')) return 'host'
  return 'unknown'
}

function candidateKindLabel(candidate: string): string {
  const kind = candidateKind(candidate)
  if (kind === 'relay') return 'relay (TURN)'
  if (kind === 'srflx') return 'srflx (STUN)'
  if (kind === 'host') return 'host (local)'
  return 'unknown'
}

export function countSdpCandidates(sdp: string | undefined): number {
  if (!sdp) return 0
  return (sdp.match(/^a=candidate:/gm) ?? []).length
}

/** Counts local/remote ICE exchange for diagnosis. */
export interface IceExchangeAudit {
  localGenerated: number
  localPushed: number
  localPushFailed: number
  endOfCandidatesLocal: boolean
  remoteReceived: number
  remoteQueued: number
  remoteAdded: number
  remoteAddFailed: number
  remoteFlushed: number
  localTypes: Record<string, number>
  remoteTypes: Record<string, number>
}

export function createIceExchangeAudit(): IceExchangeAudit {
  return {
    localGenerated: 0,
    localPushed: 0,
    localPushFailed: 0,
    endOfCandidatesLocal: false,
    remoteReceived: 0,
    remoteQueued: 0,
    remoteAdded: 0,
    remoteAddFailed: 0,
    remoteFlushed: 0,
    localTypes: {},
    remoteTypes: {},
  }
}

function bumpType(map: Record<string, number>, candidate: string): void {
  const kind = candidateKind(candidate)
  map[kind] = (map[kind] ?? 0) + 1
}

export function noteLocalCandidate(audit: IceExchangeAudit, candidate: string): void {
  audit.localGenerated += 1
  bumpType(audit.localTypes, candidate)
}

export function noteEndOfCandidates(audit: IceExchangeAudit): void {
  audit.endOfCandidatesLocal = true
}

export function noteLocalPushed(audit: IceExchangeAudit, ok: boolean): void {
  if (ok) audit.localPushed += 1
  else audit.localPushFailed += 1
}

export function noteRemoteReceived(audit: IceExchangeAudit, candidate: string): void {
  audit.remoteReceived += 1
  bumpType(audit.remoteTypes, candidate)
}

export function logIceExchangeAudit(ctx: WebRtcDebugContext, audit: IceExchangeAudit): void {
  console.info(`${tag(ctx)} ICE exchange audit`, {
    local: {
      generated: audit.localGenerated,
      pushedToFirebase: audit.localPushed,
      pushFailed: audit.localPushFailed,
      endOfCandidatesSeen: audit.endOfCandidatesLocal,
      endOfCandidatesSent: false,
      types: audit.localTypes,
    },
    remote: {
      receivedFromFirebase: audit.remoteReceived,
      queuedBeforeRemoteDescription: audit.remoteQueued,
      addedViaAddIceCandidate: audit.remoteAdded,
      addFailed: audit.remoteAddFailed,
      flushedFromQueue: audit.remoteFlushed,
      types: audit.remoteTypes,
    },
  })
}

interface ParsedCandidate {
  id: string
  side: 'local' | 'remote'
  candidateType?: string
  address?: string
  port?: number
  protocol?: string
  url?: string
  candidate?: string
}

interface ParsedPair {
  id: string
  state?: string
  nominated?: boolean
  priority?: number
  localCandidateId?: string
  remoteCandidateId?: string
  protocol?: string
  bytesSent?: number
  bytesReceived?: number
  local?: ParsedCandidate
  remote?: ParsedCandidate
}

function readString(entry: object, key: string): string | undefined {
  const value = (entry as Record<string, unknown>)[key]
  return typeof value === 'string' ? value : undefined
}

function readNumber(entry: object, key: string): number | undefined {
  const value = (entry as Record<string, unknown>)[key]
  return typeof value === 'number' ? value : undefined
}

function readBool(entry: object, key: string): boolean | undefined {
  const value = (entry as Record<string, unknown>)[key]
  return typeof value === 'boolean' ? value : undefined
}

/** Two-pass getStats parse — pairs may appear before candidate entries in the report. */
export function parseIceStats(report: RTCStatsReport): {
  typeCounts: Record<string, number>
  localCandidates: ParsedCandidate[]
  remoteCandidates: ParsedCandidate[]
  pairs: ParsedPair[]
} {
  const typeCounts: Record<string, number> = {}
  const candidateById = new Map<string, ParsedCandidate>()
  const pairEntries: RTCStats[] = []

  report.forEach((entry) => {
    typeCounts[entry.type] = (typeCounts[entry.type] ?? 0) + 1

    if (entry.type === 'local-candidate' || entry.type === 'remote-candidate') {
      candidateById.set(entry.id, {
        id: entry.id,
        side: entry.type === 'local-candidate' ? 'local' : 'remote',
        candidateType: readString(entry, 'candidateType'),
        address: readString(entry, 'address') ?? readString(entry, 'ip'),
        port: readNumber(entry, 'port'),
        protocol: readString(entry, 'protocol'),
        url: readString(entry, 'url'),
        candidate: readString(entry, 'candidate'),
      })
    }

    if (entry.type === 'candidate-pair') {
      pairEntries.push(entry)
    }
  })

  const localCandidates: ParsedCandidate[] = []
  const remoteCandidates: ParsedCandidate[] = []
  candidateById.forEach((candidate) => {
    if (candidate.side === 'local') localCandidates.push(candidate)
    else remoteCandidates.push(candidate)
  })

  const pairs: ParsedPair[] = pairEntries.map((entry) => {
    const localId = readString(entry, 'localCandidateId')
    const remoteId = readString(entry, 'remoteCandidateId')
    return {
      id: entry.id,
      state: readString(entry, 'state'),
      nominated: readBool(entry, 'nominated'),
      priority: readNumber(entry, 'priority'),
      localCandidateId: localId,
      remoteCandidateId: remoteId,
      protocol: readString(entry, 'protocol'),
      bytesSent: readNumber(entry, 'bytesSent'),
      bytesReceived: readNumber(entry, 'bytesReceived'),
      local: localId ? candidateById.get(localId) : undefined,
      remote: remoteId ? candidateById.get(remoteId) : undefined,
    }
  })

  return { typeCounts, localCandidates, remoteCandidates, pairs }
}

export async function logIceStatsSnapshot(
  pc: RTCPeerConnection,
  ctx: WebRtcDebugContext,
  phase: string,
  audit?: IceExchangeAudit,
): Promise<void> {
  try {
    const report = await pc.getStats()
    const parsed = parseIceStats(report)

    console.info(`${tag(ctx)} ICE stats @ ${phase}`, {
      iceConnectionState: pc.iceConnectionState,
      connectionState: pc.connectionState,
      iceGatheringState: pc.iceGatheringState,
      signalingState: pc.signalingState,
      sdpCandidates: {
        local: countSdpCandidates(pc.localDescription?.sdp),
        remote: countSdpCandidates(pc.remoteDescription?.sdp),
      },
      statsTypeCounts: parsed.typeCounts,
      statsLocalCandidates: parsed.localCandidates,
      statsRemoteCandidates: parsed.remoteCandidates,
      statsCandidatePairs: parsed.pairs,
      appExchangeAudit: audit
        ? {
            remoteAdded: audit.remoteAdded,
            remoteReceived: audit.remoteReceived,
            remoteTypes: audit.remoteTypes,
            localTypes: audit.localTypes,
          }
        : undefined,
    })

    if (parsed.pairs.length === 0) {
      logWebRtcWarn(ctx, `0 candidate-pair stats @ ${phase}`, {
        hint:
          parsed.remoteCandidates.length === 0
            ? 'WebRTC has no remote-candidate stats — remote ICE may not be installed yet (check trickle timing / ICE exchange audit).'
            : parsed.localCandidates.length === 0
              ? 'WebRTC has no local-candidate stats.'
              : 'Candidates exist but no pairs formed yet — ICE may have failed before pairing or browser has not created pairs.',
        reportTypes: Object.keys(parsed.typeCounts),
      })
    }
  } catch (err) {
    logWebRtcWarn(ctx, `could not read getStats() @ ${phase}`, err)
  }
}

export function logIceSetup(ctx: WebRtcDebugContext): void {
  const preferred = getDirectIceConfiguration()
  const initial = getFullIceConfiguration()
  console.info(`${tag(ctx)} ICE (LAN-first)`, {
    preferredPath: {
      servers: preferred.iceServers?.length ?? 0,
      note: 'host/srflx tried first by browser ICE priority',
    },
    pcConfig: {
      servers: initial.iceServers?.length ?? 0,
      turn: (initial.iceServers ?? []).filter((s) => /turn/i.test(String(s.urls))).length,
      poolSize: initial.iceCandidatePoolSize,
      note: 'TURN included at PC creation — required by Chrome',
    },
  })
}

export function logWebRtcInfo(ctx: WebRtcDebugContext, message: string, detail?: unknown): void {
  if (detail !== undefined) {
    console.info(`${tag(ctx)} ${message}`, detail)
  } else {
    console.info(`${tag(ctx)} ${message}`)
  }
}

export function logWebRtcWarn(ctx: WebRtcDebugContext, message: string, detail?: unknown): void {
  if (detail !== undefined) {
    console.warn(`${tag(ctx)} ${message}`, detail)
  } else {
    console.warn(`${tag(ctx)} ${message}`)
  }
}

export function logWebRtcError(ctx: WebRtcDebugContext, message: string, detail?: unknown): void {
  if (detail !== undefined) {
    console.error(`${tag(ctx)} ${message}`, detail)
  } else {
    console.error(`${tag(ctx)} ${message}`)
  }
}

export interface WebRtcDebugStats {
  sawRelayCandidate: boolean
  turnErrors: number
}

export function createWebRtcDebugStats(): WebRtcDebugStats {
  return { sawRelayCandidate: false, turnErrors: 0 }
}

export function summarizeConnectionFailure(
  pc: RTCPeerConnection,
  audit?: IceExchangeAudit,
): string {
  const ice = pc.iceConnectionState
  const conn = pc.connectionState
  const gathering = pc.iceGatheringState
  const signaling = pc.signalingState

  if (audit && audit.remoteAdded === 0 && pc.remoteDescription) {
    return (
      `ICE failed with no remote addIceCandidate calls (ice=${ice}, connection=${conn}). ` +
      'Remote trickle candidates may not have reached this peer before failure — check ICE exchange audit on both sides.'
    )
  }

  if (audit && audit.remoteAddFailed > 0) {
    return (
      `ICE failed — ${audit.remoteAddFailed} remote addIceCandidate error(s) (ice=${ice}, connection=${conn}). ` +
      'See addIceCandidate FAILED logs in console.'
    )
  }

  if (ice === 'failed' || conn === 'failed') {
    return (
      `ICE connectivity failed (ice=${ice}, connection=${conn}, gathering=${gathering}, signaling=${signaling}). ` +
      'See ICE stats snapshots and exchange audit in console (filter "P2RBYTE WebRTC").'
    )
  }

  return `WebRTC state ice=${ice}, connection=${conn}, gathering=${gathering}, signaling=${signaling}`
}

/** Attaches console listeners for ICE/connection failures. Returns cleanup. */
export function attachWebRtcDebug(
  pc: RTCPeerConnection,
  ctx: WebRtcDebugContext,
  stats: WebRtcDebugStats = createWebRtcDebugStats(),
  audit?: IceExchangeAudit,
): () => void {
  logIceSetup(ctx)

  const snapshot = (phase: string) => {
    void logIceStatsSnapshot(pc, ctx, phase, audit)
  }

  const onIceCandidate = (event: Event) => {
    const e = event as RTCPeerConnectionIceEvent
    if (e.candidate?.candidate) {
      if (e.candidate.candidate.includes(' typ relay ')) stats.sawRelayCandidate = true
      logWebRtcInfo(ctx, `local candidate (${candidateKindLabel(e.candidate.candidate)})`, e.candidate.candidate)
    } else {
      logWebRtcInfo(ctx, 'local ICE gathering finished (end-of-candidates — not sent to Firebase)', {
        sawRelayCandidate: stats.sawRelayCandidate,
        turnErrors: stats.turnErrors,
      })
    }
  }

  const onIceCandidateError = (event: Event) => {
    const e = event as RTCPeerConnectionIceErrorEvent
    if (/turn/i.test(e.url ?? '')) stats.turnErrors += 1
    logWebRtcWarn(ctx, 'ICE server error (one URL failed; others may still work)', {
      url: e.url,
      errorCode: e.errorCode,
      errorText: e.errorText,
      address: e.address,
      port: e.port,
    })
  }

  const onIceGatheringStateChange = () => {
    logWebRtcInfo(ctx, `iceGatheringState → ${pc.iceGatheringState}`)
    if (pc.iceGatheringState === 'complete') snapshot('gathering-complete')
  }

  const onIceConnectionStateChange = () => {
    const state = pc.iceConnectionState
    logWebRtcInfo(ctx, `iceConnectionState → ${state}`)
    if (state === 'checking' || state === 'disconnected' || state === 'failed') {
      snapshot(`ice-${state}`)
    }
  }

  const onConnectionStateChange = () => {
    const state = pc.connectionState
    logWebRtcInfo(ctx, `connectionState → ${state}`)
    if (state === 'connecting' || state === 'failed') {
      snapshot(`connection-${state}`)
    }
  }

  const onSignalingStateChange = () => {
    logWebRtcInfo(ctx, `signalingState → ${pc.signalingState}`)
  }

  pc.addEventListener('icecandidate', onIceCandidate)
  pc.addEventListener('icecandidateerror', onIceCandidateError)
  pc.addEventListener('icegatheringstatechange', onIceGatheringStateChange)
  pc.addEventListener('iceconnectionstatechange', onIceConnectionStateChange)
  pc.addEventListener('connectionstatechange', onConnectionStateChange)
  pc.addEventListener('signalingstatechange', onSignalingStateChange)

  logWebRtcInfo(ctx, 'debug logging enabled — filter console by "P2RBYTE WebRTC"')

  return () => {
    pc.removeEventListener('icecandidate', onIceCandidate)
    pc.removeEventListener('icecandidateerror', onIceCandidateError)
    pc.removeEventListener('icegatheringstatechange', onIceGatheringStateChange)
    pc.removeEventListener('iceconnectionstatechange', onIceConnectionStateChange)
    pc.removeEventListener('connectionstatechange', onConnectionStateChange)
    pc.removeEventListener('signalingstatechange', onSignalingStateChange)
  }
}

export function attachDataChannelDebug(
  channel: RTCDataChannel,
  ctx: WebRtcDebugContext,
  label = 'data channel',
): void {
  channel.addEventListener('open', () => logWebRtcInfo(ctx, `${label} open`))
  channel.addEventListener('close', () => logWebRtcInfo(ctx, `${label} closed`))
  channel.addEventListener('error', () => logWebRtcError(ctx, `${label} error`))
}

/** @deprecated use logIceStatsSnapshot */
export async function logIceCandidatePairsAtFailure(
  pc: RTCPeerConnection,
  ctx: WebRtcDebugContext,
  audit?: IceExchangeAudit,
): Promise<void> {
  await logIceStatsSnapshot(pc, ctx, 'failure', audit)
}
