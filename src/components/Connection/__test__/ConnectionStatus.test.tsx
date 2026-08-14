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

  it('shows direct connecting hint', () => {
    render(<ConnectionStatus state="connecting" icePhase="direct" />)
    expect(screen.getByText(/Trying direct connection on your local network/)).toBeInTheDocument()
  })

  it('shows relay connecting hint', () => {
    render(<ConnectionStatus state="connecting" icePhase="relay" />)
    expect(screen.getByText(/Direct path unavailable — connecting via relay/)).toBeInTheDocument()
  })

  it('shows error message when provided', () => {
    render(<ConnectionStatus state="error" error="Signaling failed" />)
    expect(screen.getByText('Signaling failed')).toBeInTheDocument()
  })

  it('shows TURN route when connected via relay', () => {
    render(<ConnectionStatus state="connected" connectionPath="relay" />)
    expect(screen.getByText('Connection: TURN relay')).toBeInTheDocument()
  })

  it('shows host route when connected on LAN', () => {
    render(<ConnectionStatus state="connected" connectionPath="host" />)
    expect(screen.getByText('Connection: Local network (LAN)')).toBeInTheDocument()
  })

  it('shows srflx route when connected via direct WebRTC', () => {
    render(<ConnectionStatus state="connected" connectionPath="srflx" />)
    expect(screen.getByText('Connection: Direct (WebRTC)')).toBeInTheDocument()
  })
})
