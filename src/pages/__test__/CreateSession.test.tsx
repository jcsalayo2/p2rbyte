import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CreateSession } from '../CreateSession'

const mockStart = vi.fn()
const mockSetSearchParams = vi.fn()

vi.mock('../../hooks/usePeerSession', () => ({
  usePeerSession: vi.fn(() => ({
    connectionState: 'waiting',
    connectionPath: null,
    icePhase: 'direct',
    error: null,
    start: mockStart,
    dataChannel: null,
  })),
}))

vi.mock('../../components/Connection/ConnectedSession', () => ({
  ConnectedSession: vi.fn(
    ({
      roomId,
      shareMode,
      onShareModeChange,
    }: {
      roomId: string
      shareMode: string
      onShareModeChange?: (mode: 'link' | 'qr') => void
    }) => (
      <div data-testid="connected-session">
        <span>{roomId}</span>
        <span>{shareMode}</span>
        <button type="button" onClick={() => onShareModeChange?.('qr')}>
          Switch to QR
        </button>
      </div>
    ),
  ),
}))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    useParams: () => ({ roomId: 'ABC123' }),
    useSearchParams: () => [new URLSearchParams('mode=link'), mockSetSearchParams],
  }
})

vi.mock('../../utils/roomId', () => ({
  getJoinUrl: (roomId: string) => `https://example.com/join/${roomId}`,
}))

import { ConnectedSession } from '../../components/Connection/ConnectedSession'

const mockConnectedSession = vi.mocked(ConnectedSession)

describe('CreateSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('starts peer session on mount', () => {
    render(<CreateSession />)
    expect(mockStart).toHaveBeenCalledOnce()
  })

  it('renders connected session for creator', () => {
    render(<CreateSession />)

    expect(screen.getByTestId('connected-session')).toBeInTheDocument()
    expect(screen.getByText('ABC123')).toBeInTheDocument()
    expect(mockConnectedSession).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId: 'ABC123',
        role: 'creator',
        joinUrl: 'https://example.com/join/ABC123',
        showShare: true,
      }),
      undefined,
    )
  })

  it('updates share mode in the URL', async () => {
    const user = userEvent.setup()
    render(<CreateSession />)

    await user.click(screen.getByRole('button', { name: 'Switch to QR' }))

    expect(mockSetSearchParams).toHaveBeenCalledWith({ mode: 'qr' }, { replace: true })
  })
})
