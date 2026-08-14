import { Link } from 'react-router-dom'
import type { ConnectionState, SessionRole } from '../../types/signaling'
import { ConnectionStatus } from './ConnectionStatus'
import { SessionLayout } from './SessionLayout'
import { SessionShare, type ShareMode } from './SessionShare'
import { Card } from '../common/Card'

interface ConnectedSessionProps {
  roomId: string
  role: SessionRole
  connectionState: ConnectionState
  error: string | null
  dataChannel: RTCDataChannel | null
  showShare?: boolean
  joinUrl?: string
  shareMode?: ShareMode
  onShareModeChange?: (mode: ShareMode) => void
}

export function ConnectedSession({
  roomId,
  role,
  connectionState,
  error,
  dataChannel,
  showShare = false,
  joinUrl = '',
  shareMode = 'link',
  onShareModeChange,
}: ConnectedSessionProps) {
  const isConnected = connectionState === 'connected'

  return (
    <div className="page page--create">
      <header className="create-header">
        <Link to="/" className="back-link">
          ← Back
        </Link>
        <div className="create-header__main">
          <h1 className="create-header__title">
            {isConnected ? 'Session active' : role === 'creator' ? 'Share session' : 'Joining session'}
          </h1>
          <p className="create-header__subtitle">
            {isConnected
              ? 'Messages and files travel directly between peers — not stored on a server.'
              : role === 'creator'
                ? 'Send this to the device you want to connect with.'
                : `Connecting to session ${roomId}…`}
          </p>
        </div>
      </header>

      <div className="create-body create-body--session">
        <Card className="create-status-card">
          <ConnectionStatus
            state={connectionState}
            error={error}
            compact={isConnected}
          />
        </Card>

        {showShare && joinUrl && onShareModeChange && (
          <SessionShare
            roomId={roomId}
            joinUrl={joinUrl}
            mode={shareMode}
            onModeChange={onShareModeChange}
          />
        )}

        {(isConnected || connectionState === 'disconnected') && (
          <SessionLayout
            key={dataChannel?.id ?? 'no-channel'}
            dataChannel={dataChannel}
            connected={isConnected}
          />
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
