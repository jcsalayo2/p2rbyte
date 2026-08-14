import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { JoinSession } from '../JoinSession'

const mockStart = vi.fn()

vi.mock('../../hooks/usePeerSession', () => ({
  usePeerSession: vi.fn(() => ({
    connectionState: 'connecting',
    connectionPath: null,
    icePhase: 'direct',
    error: null,
    start: mockStart,
    dataChannel: null,
  })),
}))

vi.mock('../../components/Connection/ConnectedSession', () => ({
  ConnectedSession: vi.fn(({ roomId, role }: { roomId: string; role: string }) => (
    <div data-testid="connected-session" data-room={roomId} data-role={role} />
  )),
}))

const mockUseParams = vi.fn(() => ({ roomId: 'ABC123' }))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    useParams: () => mockUseParams(),
  }
})

import { usePeerSession } from '../../hooks/usePeerSession'
import { ConnectedSession } from '../../components/Connection/ConnectedSession'

const mockUsePeerSession = vi.mocked(usePeerSession)
const mockConnectedSession = vi.mocked(ConnectedSession)

describe('JoinSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseParams.mockReturnValue({ roomId: 'ABC123' })
  })

  it('shows invalid session message for bad room codes', () => {
    mockUseParams.mockReturnValue({ roomId: 'BAD' })

    render(
      <MemoryRouter>
        <JoinSession />
      </MemoryRouter>,
    )

    expect(screen.getByText('Invalid session code')).toBeInTheDocument()
    expect(mockStart).not.toHaveBeenCalled()
    expect(mockUsePeerSession).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId: 'BAD',
        role: 'joiner',
        enabled: false,
      }),
    )
  })

  it('starts join flow for valid room codes', () => {
    render(
      <MemoryRouter>
        <JoinSession />
      </MemoryRouter>,
    )

    expect(mockStart).toHaveBeenCalledOnce()
    expect(screen.getByTestId('connected-session')).toHaveAttribute('data-room', 'ABC123')
    expect(screen.getByTestId('connected-session')).toHaveAttribute('data-role', 'joiner')
    expect(mockConnectedSession).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId: 'ABC123',
        role: 'joiner',
        connectionState: 'connecting',
      }),
      undefined,
    )
  })
})
