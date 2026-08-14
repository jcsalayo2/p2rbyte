import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ConnectionStatus } from '../ConnectionStatus'

describe('ConnectionStatus', () => {
  it('shows connected label with success badge', () => {
    render(<ConnectionStatus state="connected" />)
    expect(screen.getByText('Connected')).toHaveClass('badge--success')
  })

  it('shows waiting hint when not compact', () => {
    render(<ConnectionStatus state="waiting" />)
    expect(screen.getByText(/Share the link or QR below/)).toBeInTheDocument()
  })

  it('hides waiting hint in compact mode', () => {
    render(<ConnectionStatus state="waiting" compact />)
    expect(screen.queryByText(/Share the link or QR below/)).not.toBeInTheDocument()
  })

  it('shows connecting hint', () => {
    render(<ConnectionStatus state="connecting" />)
    expect(screen.getByText(/Establishing secure connection/)).toBeInTheDocument()
  })

  it('shows error message when provided', () => {
    render(<ConnectionStatus state="error" error="Signaling failed" />)
    expect(screen.getByText('Signaling failed')).toBeInTheDocument()
  })
})
