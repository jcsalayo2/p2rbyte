import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Badge } from '../Badge'

describe('Badge', () => {
  it('renders with default muted variant', () => {
    render(<Badge>Label</Badge>)
    expect(screen.getByText('Label')).toHaveClass('badge', 'badge--muted')
  })

  it('renders with explicit variant', () => {
    render(<Badge variant="success">Connected</Badge>)
    expect(screen.getByText('Connected')).toHaveClass('badge--success')
  })
})
