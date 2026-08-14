import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Button } from '../Button'

describe('Button', () => {
  it('renders with default ghost variant', () => {
    render(<Button>Click</Button>)
    expect(screen.getByRole('button', { name: 'Click' })).toHaveClass('btn', 'btn--ghost')
  })

  it('renders primary variant and custom className', () => {
    render(
      <Button variant="primary" className="extra">
        Save
      </Button>,
    )
    expect(screen.getByRole('button', { name: 'Save' })).toHaveClass('btn--primary', 'extra')
  })

  it('forwards click handler', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Tap</Button>)
    await user.click(screen.getByRole('button', { name: 'Tap' }))
    expect(onClick).toHaveBeenCalledOnce()
  })
})
