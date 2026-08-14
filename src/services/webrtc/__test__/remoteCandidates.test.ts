import { describe, expect, it, vi } from 'vitest'
import * as peerConnection from '../peerConnection'
import { createRemoteCandidateCollector } from '../remoteCandidates'

function createMockPc(remoteDescription: RTCSessionDescription | null = null) {
  return {
    remoteDescription,
  } as unknown as RTCPeerConnection
}

describe('createRemoteCandidateCollector', () => {
  it('queues candidates until remote description is set', async () => {
    const addRemoteCandidate = vi
      .spyOn(peerConnection, 'addRemoteCandidate')
      .mockResolvedValue(undefined)

    const pc = createMockPc(null)
    const collector = createRemoteCandidateCollector(pc)
    const payload = { candidate: 'candidate:1', sdpMid: '0', sdpMLineIndex: 0 }

    await collector.add(payload)
    expect(addRemoteCandidate).not.toHaveBeenCalled()

    Object.defineProperty(pc, 'remoteDescription', {
      value: { type: 'offer', sdp: 'v=0' },
    })
    await collector.flush()

    expect(addRemoteCandidate).toHaveBeenCalledOnce()
    addRemoteCandidate.mockRestore()
  })

  it('applies candidates immediately when remote description exists', async () => {
    const addRemoteCandidate = vi
      .spyOn(peerConnection, 'addRemoteCandidate')
      .mockResolvedValue(undefined)

    const pc = createMockPc({ type: 'offer', sdp: 'v=0' } as RTCSessionDescription)
    const collector = createRemoteCandidateCollector(pc)

    await collector.add({ candidate: 'candidate:2', sdpMid: '0', sdpMLineIndex: 0 })

    expect(addRemoteCandidate).toHaveBeenCalledOnce()
    addRemoteCandidate.mockRestore()
  })

  it('dedupes candidates by candidate string', async () => {
    const addRemoteCandidate = vi
      .spyOn(peerConnection, 'addRemoteCandidate')
      .mockResolvedValue(undefined)

    const pc = createMockPc({ type: 'offer', sdp: 'v=0' } as RTCSessionDescription)
    const collector = createRemoteCandidateCollector(pc)
    const payload = { candidate: 'candidate:dup', sdpMid: '0', sdpMLineIndex: 0 }

    await collector.add(payload)
    await collector.add(payload)

    expect(addRemoteCandidate).toHaveBeenCalledOnce()
    addRemoteCandidate.mockRestore()
  })
})
