import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Card } from '../Card'

describe('Card', () => {
  it('renders children in card container', () => {
    render(<Card>Content</Card>)
    expect(screen.getByText('Content')).toHaveClass('card')
  })

  it('merges custom className', () => {
    render(<Card className="panel">Panel</Card>)
    expect(screen.getByText('Panel')).toHaveClass('card', 'panel')
  })
})
