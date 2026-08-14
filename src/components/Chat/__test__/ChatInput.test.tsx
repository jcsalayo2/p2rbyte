import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ChatInput } from '../ChatInput'

describe('ChatInput', () => {
  it('calls onSend and clears input on submit', async () => {
    const user = userEvent.setup()
    const onSend = vi.fn()

    render(<ChatInput onSend={onSend} disabled={false} />)

    const field = screen.getByPlaceholderText('Type a message…')
    await user.type(field, 'Hello')
    await user.click(screen.getByRole('button', { name: 'Send' }))

    expect(onSend).toHaveBeenCalledWith('Hello')
    expect(field).toHaveValue('')
  })

  it('sends on Enter without Shift', async () => {
    const user = userEvent.setup()
    const onSend = vi.fn()

    const { container } = render(<ChatInput onSend={onSend} disabled={false} />)

    const field = container.querySelector('textarea')!
    await user.type(field, 'Enter send')
    await user.keyboard('{Enter}')

    expect(onSend).toHaveBeenCalledWith('Enter send')
  })

  it('does not send when disabled', async () => {
    const user = userEvent.setup()
    const onSend = vi.fn()

    render(<ChatInput onSend={onSend} disabled={true} />)

    const field = screen.getByPlaceholderText('Type a message…')
    await user.type(field, 'Nope')
    await user.click(screen.getByRole('button', { name: 'Send' }))

    expect(onSend).not.toHaveBeenCalled()
  })

  it('does not send whitespace-only message', async () => {
    const user = userEvent.setup()
    const onSend = vi.fn()

    render(<ChatInput onSend={onSend} disabled={false} />)

    await user.type(screen.getByPlaceholderText('Type a message…'), '   ')
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
  })

  it('shows error message when provided', () => {
    render(<ChatInput onSend={vi.fn()} disabled={false} error="Cannot send" />)
    expect(screen.getByText('Cannot send')).toBeInTheDocument()
  })

  it('does not send whitespace-only message on Enter', async () => {
    const user = userEvent.setup()
    const onSend = vi.fn()

    render(<ChatInput onSend={onSend} disabled={false} />)

    await user.type(screen.getByPlaceholderText('Type a message…'), '   ')
    await user.keyboard('{Enter}')

    expect(onSend).not.toHaveBeenCalled()
  })

  it('does not send when disabled even if text is present', async () => {
    const user = userEvent.setup()
    const onSend = vi.fn()

    const { rerender } = render(<ChatInput onSend={onSend} disabled={false} />)
    await user.type(screen.getByPlaceholderText('Type a message…'), 'Hello')
    rerender(<ChatInput onSend={onSend} disabled={true} />)
    await user.click(screen.getByRole('button', { name: 'Send' }))

    expect(onSend).not.toHaveBeenCalled()
  })
})
