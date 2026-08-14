import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { ConnectedSession } from '../components/Connection/ConnectedSession'
import type { ShareMode } from '../components/Connection/SessionShare'
import { usePeerSession } from '../hooks/usePeerSession'
import { getJoinUrl } from '../utils/roomId'

export function CreateSession() {
  const { roomId = '' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialMode = (searchParams.get('mode') as ShareMode) || 'link'
  const [mode, setMode] = useState<ShareMode>(initialMode)

  const { connectionState, connectionPath, icePhase, error, start, dataChannel } = usePeerSession({
    roomId,
    role: 'creator',
  })

  useEffect(() => {
    start()
  }, [start])

  function handleModeChange(next: ShareMode) {
    setMode(next)
    setSearchParams({ mode: next }, { replace: true })
  }

  const joinUrl = getJoinUrl(roomId)
  const showShare =
    connectionState === 'idle' ||
    connectionState === 'waiting' ||
    connectionState === 'connecting'

  return (
    <ConnectedSession
      roomId={roomId}
      role="creator"
      connectionState={connectionState}
      connectionPath={connectionPath}
      icePhase={icePhase}
      error={error}
      dataChannel={dataChannel}
      showShare={showShare}
      joinUrl={joinUrl}
      shareMode={mode}
      onShareModeChange={handleModeChange}
    />
  )
}
