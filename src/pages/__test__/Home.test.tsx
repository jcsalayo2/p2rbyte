import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { Home } from '../Home'

const navigate = vi.fn()

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    useNavigate: () => navigate,
  }
})

vi.mock('../../utils/roomId', () => ({
  generateRoomId: () => 'ABC123',
}))

describe('Home', () => {
  it('renders landing content and join form', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    )

    expect(screen.getByText('P2RBYTE')).toBeInTheDocument()
    expect(screen.getByText(/No accounts/)).toBeInTheDocument()
    expect(screen.getByLabelText('Join with code')).toBeInTheDocument()
  })

  it('navigates to create session with link mode', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: 'Generate link' }))
    expect(navigate).toHaveBeenCalledWith('/create/ABC123?mode=link')
  })

  it('navigates to create session with qr mode', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: 'Generate QR' }))
    expect(navigate).toHaveBeenCalledWith('/create/ABC123?mode=qr')
  })
})
