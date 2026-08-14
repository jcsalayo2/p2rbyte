import { describe, expect, it, vi } from 'vitest'
import {
  connectionPathLabel,
  getSelectedConnectionPath,
  getSelectedConnectionPathDetails,
} from '../selectedCandidate'

function mockStatsReport(entries: object[]): RTCStatsReport {
  const map = new Map<string, object>()
  entries.forEach((entry, index) => {
    map.set(String(index), entry as RTCStats)
  })
  return map as unknown as RTCStatsReport
}

function mockPeerConnection(report: RTCStatsReport): RTCPeerConnection {
  return {
    getStats: vi.fn(async () => report),
  } as unknown as RTCPeerConnection
}

describe('getSelectedConnectionPath', () => {
  it('returns host when nominated pair uses host candidates', async () => {
    const pc = mockPeerConnection(
      mockStatsReport([
        { id: 'local1', type: 'local-candidate', candidateType: 'host' },
        { id: 'remote1', type: 'remote-candidate', candidateType: 'host' },
        {
          id: 'pair1',
          type: 'candidate-pair',
          state: 'succeeded',
          nominated: true,
          localCandidateId: 'local1',
          remoteCandidateId: 'remote1',
          bytesSent: 1000,
          bytesReceived: 1000,
        },
      ]),
    )

    await expect(getSelectedConnectionPath(pc)).resolves.toBe('host')
  })

  it('returns srflx when nominated pair uses server-reflexive candidates', async () => {
    const pc = mockPeerConnection(
      mockStatsReport([
        { id: 'local1', type: 'local-candidate', candidateType: 'srflx' },
        { id: 'remote1', type: 'remote-candidate', candidateType: 'srflx' },
        {
          id: 'pair1',
          type: 'candidate-pair',
          state: 'succeeded',
          nominated: true,
          localCandidateId: 'local1',
          remoteCandidateId: 'remote1',
          bytesSent: 1000,
          bytesReceived: 1000,
        },
      ]),
    )

    await expect(getSelectedConnectionPath(pc)).resolves.toBe('srflx')
  })

  it('returns relay when local nominated candidate is relay', async () => {
    const pc = mockPeerConnection(
      mockStatsReport([
        { id: 'local1', type: 'local-candidate', candidateType: 'relay' },
        { id: 'remote1', type: 'remote-candidate', candidateType: 'srflx' },
        {
          id: 'pair1',
          type: 'candidate-pair',
          state: 'succeeded',
          nominated: true,
          localCandidateId: 'local1',
          remoteCandidateId: 'remote1',
          bytesSent: 1000,
          bytesReceived: 1000,
        },
      ]),
    )

    await expect(getSelectedConnectionPath(pc)).resolves.toBe('relay')
  })

  it('prefers succeeded relay pair over in-progress srflx pair', async () => {
    const pc = mockPeerConnection(
      mockStatsReport([
        { id: 'localSrflx', type: 'local-candidate', candidateType: 'srflx' },
        { id: 'remoteSrflx', type: 'remote-candidate', candidateType: 'srflx' },
        { id: 'localRelay', type: 'local-candidate', candidateType: 'relay' },
        { id: 'remoteRelay', type: 'remote-candidate', candidateType: 'relay' },
        {
          id: 'pairDirect',
          type: 'candidate-pair',
          state: 'in-progress',
          nominated: true,
          localCandidateId: 'localSrflx',
          remoteCandidateId: 'remoteSrflx',
          bytesSent: 0,
          bytesReceived: 0,
        },
        {
          id: 'pairRelay',
          type: 'candidate-pair',
          state: 'succeeded',
          nominated: true,
          localCandidateId: 'localRelay',
          remoteCandidateId: 'remoteRelay',
          bytesSent: 5000,
          bytesReceived: 4800,
        },
      ]),
    )

    await expect(getSelectedConnectionPath(pc)).resolves.toBe('relay')
  })

  it('returns null for in-progress-only pairs when requireSucceeded is set', async () => {
    const pc = mockPeerConnection(
      mockStatsReport([
        { id: 'local1', type: 'local-candidate', candidateType: 'srflx' },
        { id: 'remote1', type: 'remote-candidate', candidateType: 'srflx' },
        {
          id: 'pair1',
          type: 'candidate-pair',
          state: 'in-progress',
          nominated: true,
          localCandidateId: 'local1',
          remoteCandidateId: 'remote1',
        },
      ]),
    )

    await expect(getSelectedConnectionPath(pc, { requireSucceeded: true })).resolves.toBeNull()
    await expect(
      getSelectedConnectionPathDetails(pc, { requireSucceeded: true }),
    ).resolves.toBeNull()
    await expect(getSelectedConnectionPath(pc, { requireSucceeded: false })).resolves.toBe('srflx')
  })
})

describe('connectionPathLabel', () => {
  it('maps candidate types to UI labels', () => {
    expect(connectionPathLabel('host')).toBe('Local network (LAN)')
    expect(connectionPathLabel('srflx')).toBe('Direct (WebRTC)')
    expect(connectionPathLabel('relay')).toBe('TURN relay')
  })
})
