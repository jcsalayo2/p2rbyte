import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ConnectionStatus } from '../components/Connection/ConnectionStatus'
import { usePeerSession } from '../hooks/usePeerSession'
import { isValidRoomId } from '../utils/roomId'

export function JoinSession() {
  const { roomId = '' } = useParams()

  const { connectionState, error, start } = usePeerSession({
    roomId,
    role: 'joiner',
    enabled: isValidRoomId(roomId),
  })

  useEffect(() => {
    if (isValidRoomId(roomId)) start()
  }, [roomId, start])

  if (!isValidRoomId(roomId)) {
    return (
      <div className="page">
        <header className="page__header">
          <Link to="/" className="back-link">
            ← Back
          </Link>
          <h1 className="wordmark">P2RBYTE</h1>
        </header>
        <ConnectionStatus state="error" error="Invalid session code" />
      </div>
    )
  }

  return (
    <div className="page">
      <header className="page__header">
        <Link to="/" className="back-link">
          ← Back
        </Link>
        <h1 className="wordmark">P2RBYTE</h1>
        <p className="tagline mono">Joining {roomId}</p>
      </header>

      <ConnectionStatus state={connectionState} error={error} />

      {connectionState === 'connected' && (
        <p className="connected-note">
          Connected. Chat and file transfer coming next.
        </p>
      )}
    </div>
  )
}
