import {
  connectionPathLabel,
  type ConnectionPath,
} from '../../services/webrtc/selectedCandidate'
import type { ConnectionState, IcePhase } from '../../types/signaling'
import { Badge } from '../common/Badge'

interface ConnectionStatusProps {
  state: ConnectionState
  connectionPath?: ConnectionPath | null
  icePhase?: IcePhase
  error?: string | null
  compact?: boolean
}

const LABELS: Record<ConnectionState, string> = {
  idle: 'Starting…',
  waiting: 'Waiting for peer',
  connecting: 'Connecting…',
  connected: 'Connected',
  disconnected: 'Disconnected',
  failed: 'Connection failed',
  error: 'Error',
}

const VARIANT: Record<
  ConnectionState,
  'muted' | 'connecting' | 'success' | 'error'
> = {
  idle: 'connecting',
  waiting: 'connecting',
  connecting: 'connecting',
  connected: 'success',
  disconnected: 'error',
  failed: 'error',
  error: 'error',
}

const DOT: Record<ConnectionState, string> = {
  idle: 'connecting',
  waiting: 'connecting',
  connecting: 'connecting',
  connected: 'success',
  disconnected: 'error',
  failed: 'error',
  error: 'error',
}

export function ConnectionStatus({
  state,
  connectionPath,
  icePhase = 'direct',
  error,
  compact,
}: ConnectionStatusProps) {
  return (
    <div className={`connection-status${compact ? ' connection-status--compact' : ''}`}>
      <div className="connection-status__row">
        <span className={`status-dot status-dot--${DOT[state]}`} aria-hidden />
        <Badge variant={VARIANT[state]}>{LABELS[state]}</Badge>
      </div>
      {state === 'connected' && connectionPath && (
        <p
          className={`connection-status__route connection-status__route--${connectionPath}`}
        >
          Connection: {connectionPathLabel(connectionPath)}
        </p>
      )}
      {state === 'connected' && connectionPath === null && (
        <p className="connection-status__hint">Detecting connection route…</p>
      )}
      {!compact && state === 'waiting' && (
        <p className="connection-status__hint">
          Share the link or QR below. Peer joins from another device.
        </p>
      )}
      {!compact && state === 'connecting' && icePhase === 'direct' && (
        <p className="connection-status__hint">
          Trying direct connection on your local network…
        </p>
      )}
      {!compact && state === 'connecting' && icePhase === 'relay' && (
        <p className="connection-status__hint">
          Direct path unavailable — connecting via relay…
        </p>
      )}
      {error && <p className="connection-status__error">{error}</p>}
    </div>
  )
}
