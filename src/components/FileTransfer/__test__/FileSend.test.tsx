import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { FileSend } from '../FileSend'

describe('FileSend', () => {
  it('opens file picker when button is clicked', async () => {
    const user = userEvent.setup()
    const click = vi.fn()
    render(<FileSend onSend={vi.fn()} disabled={false} />)

    const input = document.querySelector('.file-send__input') as HTMLInputElement
    input.click = click

    await user.click(screen.getByRole('button', { name: 'Send file' }))
    expect(click).toHaveBeenCalledOnce()
  })

  it('calls onSend when a file is selected', async () => {
    const user = userEvent.setup()
    const onSend = vi.fn()
    render(<FileSend onSend={onSend} disabled={false} />)

    const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' })
    const input = document.querySelector('.file-send__input') as HTMLInputElement
    await user.upload(input, file)

    expect(onSend).toHaveBeenCalledWith(file)
    expect(input.value).toBe('')
  })

  it('shows error when provided', () => {
    render(<FileSend onSend={vi.fn()} disabled={false} error="Too large" />)
    expect(screen.getByText('Too large')).toBeInTheDocument()
  })

  it('ignores empty file selection', async () => {
    const user = userEvent.setup()
    const onSend = vi.fn()
    render(<FileSend onSend={onSend} disabled={false} />)

    const input = document.querySelector('.file-send__input') as HTMLInputElement
    await user.upload(input, [])

    expect(onSend).not.toHaveBeenCalled()
  })
})
