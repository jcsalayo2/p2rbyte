import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { JoinForm } from '../JoinForm'

function renderJoinForm() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<JoinForm />} />
        <Route path="/join/:roomId" element={<div>Joined room</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('JoinForm', () => {
  it('navigates to join route for valid code', async () => {
    const user = userEvent.setup()
    renderJoinForm()

    await user.type(screen.getByLabelText('Join with code'), 'abc123')
    await user.click(screen.getByRole('button', { name: 'Join' }))

    expect(screen.getByText('Joined room')).toBeInTheDocument()
  })

  it('shows error for invalid code', async () => {
    const user = userEvent.setup()
    renderJoinForm()

    await user.type(screen.getByLabelText('Join with code'), 'BAD')
    await user.click(screen.getByRole('button', { name: 'Join' }))

    expect(screen.getByText('Enter a valid 6-character code')).toBeInTheDocument()
  })

  it('clears error when code changes', async () => {
    const user = userEvent.setup()
    renderJoinForm()

    await user.type(screen.getByLabelText('Join with code'), 'BAD')
    await user.click(screen.getByRole('button', { name: 'Join' }))
    await user.type(screen.getByLabelText('Join with code'), '1')

    expect(screen.queryByText('Enter a valid 6-character code')).not.toBeInTheDocument()
  })
})
