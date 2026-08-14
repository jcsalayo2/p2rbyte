import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SessionShare } from '../SessionShare'

describe('SessionShare', () => {
  const joinUrl = 'https://p2rbyte.web.app/join/ABC123'

  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn(async () => {}) },
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders session code and join link in link mode', () => {
    render(
      <SessionShare
        roomId="ABC123"
        joinUrl={joinUrl}
        mode="link"
        onModeChange={vi.fn()}
      />,
    )

    expect(screen.getByText('Share with peer')).toBeInTheDocument()
    expect(screen.getByText('ABC123')).toBeInTheDocument()
    expect(screen.getByText(joinUrl)).toBeInTheDocument()
    expect(screen.queryByText('Scan to join')).not.toBeInTheDocument()
  })

  it('shows QR panel in qr mode', () => {
    const { container } = render(
      <SessionShare
        roomId="ABC123"
        joinUrl={joinUrl}
        mode="qr"
        onModeChange={vi.fn()}
      />,
    )

    expect(screen.getByText('Scan to join')).toBeInTheDocument()
    expect(screen.getByText(/Open camera on other device/)).toBeInTheDocument()
    expect(container.querySelector('.qr-code svg')).toBeInTheDocument()
  })

  it('switches tabs via onModeChange', async () => {
    const user = userEvent.setup()
    const onModeChange = vi.fn()

    render(
      <SessionShare
        roomId="ABC123"
        joinUrl={joinUrl}
        mode="link"
        onModeChange={onModeChange}
      />,
    )

    await user.click(screen.getByRole('tab', { name: 'QR code' }))
    expect(onModeChange).toHaveBeenCalledWith('qr')

    await user.click(screen.getByRole('tab', { name: 'Link' }))
    expect(onModeChange).toHaveBeenCalledWith('link')
  })

  it('copies join link to clipboard', async () => {
    const writeText = vi.fn(async () => {})
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })

    render(
      <SessionShare
        roomId="ABC123"
        joinUrl={joinUrl}
        mode="link"
        onModeChange={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }))

    await act(async () => {
      await Promise.resolve()
    })

    expect(writeText).toHaveBeenCalledWith(joinUrl)
    expect(screen.getByRole('button', { name: 'Link copied' })).toBeInTheDocument()
  })

  it('copies session code to clipboard', async () => {
    const writeText = vi.fn(async () => {})
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })

    render(
      <SessionShare
        roomId="ABC123"
        joinUrl={joinUrl}
        mode="link"
        onModeChange={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }))

    await act(async () => {
      await Promise.resolve()
    })

    expect(writeText).toHaveBeenCalledWith('ABC123')
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument()
  })

  it('resets copied labels after timeout', async () => {
    vi.useFakeTimers()
    const writeText = vi.fn(async () => {})
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })

    render(
      <SessionShare
        roomId="ABC123"
        joinUrl={joinUrl}
        mode="link"
        onModeChange={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }))
    await act(async () => {
      await Promise.resolve()
    })

    expect(screen.getByRole('button', { name: 'Link copied' })).toBeInTheDocument()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })

    expect(screen.getByRole('button', { name: 'Copy link' })).toBeInTheDocument()
  })
})
