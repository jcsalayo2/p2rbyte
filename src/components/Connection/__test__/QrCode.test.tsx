import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { QrCode } from '../QrCode'

describe('QrCode', () => {
  it('renders QR SVG for the join URL', () => {
    const { container } = render(<QrCode value="https://example.com/join/ABC123" />)

    expect(container.querySelector('.qr-code')).toBeInTheDocument()
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('uses custom size when provided', () => {
    const { container } = render(
      <QrCode value="https://example.com/join/ABC123" size={128} />,
    )

    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('height', '128')
    expect(svg).toHaveAttribute('width', '128')
  })
})
