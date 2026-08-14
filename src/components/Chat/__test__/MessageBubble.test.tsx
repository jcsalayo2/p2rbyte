import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MessageBubble } from '../MessageBubble'

describe('MessageBubble', () => {
  it('renders local message with local class', () => {
    render(
      <MessageBubble
        message={{ id: '1', text: 'Hello', sentAt: 1000, isLocal: true }}
      />,
    )
    const bubble = screen.getByText('Hello').closest('.message-bubble')
    expect(bubble).toHaveClass('message-bubble--local')
  })

  it('renders remote message with remote class', () => {
    render(
      <MessageBubble
        message={{ id: '2', text: 'Hi back', sentAt: 2000, isLocal: false }}
      />,
    )
    const bubble = screen.getByText('Hi back').closest('.message-bubble')
    expect(bubble).toHaveClass('message-bubble--remote')
  })
})
