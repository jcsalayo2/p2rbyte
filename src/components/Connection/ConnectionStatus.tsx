import type { ConnectionState } from '../../types/signaling'
import { Badge } from '../common/Badge'

interface ConnectionStatusProps {
  state: ConnectionState
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

export function ConnectionStatus({ state, error, compact }: ConnectionStatusProps) {
  return (
    <div className={`connection-status${compact ? ' connection-status--compact' : ''}`}>
      <div className="connection-status__row">
        <span className={`status-dot status-dot--${DOT[state]}`} aria-hidden />
        <Badge variant={VARIANT[state]}>{LABELS[state]}</Badge>
      </div>
      {!compact && state === 'waiting' && (
        <p className="connection-status__hint">
          Share the link or QR below. Peer joins from another device.
        </p>
      )}
      {!compact && state === 'connecting' && (
        <p className="connection-status__hint">Peer found. Establishing secure connection…</p>
      )}
      {error && <p className="connection-status__error">{error}</p>}
    </div>
  )
}
