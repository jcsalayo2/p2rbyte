import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ConnectionStatus } from '../components/Connection/ConnectionStatus'
import { Card } from '../components/common/Card'
import {
  SessionShare,
  type ShareMode,
} from '../components/Connection/SessionShare'
import { usePeerSession } from '../hooks/usePeerSession'
import { getJoinUrl } from '../utils/roomId'

export function CreateSession() {
  const { roomId = '' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialMode = (searchParams.get('mode') as ShareMode) || 'link'
  const [mode, setMode] = useState<ShareMode>(initialMode)

  const { connectionState, error, start } = usePeerSession({
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

  const isConnected = connectionState === 'connected'

  return (
    <div className="page page--create">
      <header className="create-header">
        <Link to="/" className="back-link">
          ← Back
        </Link>
        <div className="create-header__main">
          <h1 className="create-header__title">
            {isConnected ? 'Session active' : 'Share session'}
          </h1>
          <p className="create-header__subtitle">
            {isConnected
              ? 'Direct peer connection established.'
              : 'Send this to the device you want to connect with.'}
          </p>
        </div>
      </header>

      <div className="create-body">
        <Card className="create-status-card">
          <ConnectionStatus
            state={connectionState}
            error={error}
            compact={isConnected}
          />
        </Card>

        {showShare && (
          <SessionShare
            roomId={roomId}
            joinUrl={joinUrl}
            mode={mode}
            onModeChange={handleModeChange}
          />
        )}

        {isConnected && (
          <Card className="connected-card">
            <p className="connected-card__title">Ready for Phase 2</p>
            <p className="connected-card__text">
              Peer is connected. Chat and file transfer will appear here next.
            </p>
          </Card>
        )}

        {showShare && (
          <p className="create-footer-note">
            Session expires after 30 minutes if no one joins.
          </p>
        )}
      </div>
    </div>
  )
}
