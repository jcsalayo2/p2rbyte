import { createRef } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MessageList } from '../MessageList'

describe('MessageList', () => {
  it('shows empty state when there are no messages', () => {
    const listEndRef = createRef<HTMLDivElement>()
    render(<MessageList messages={[]} listEndRef={listEndRef} />)

    expect(screen.getByText('No messages yet. Say hello.')).toBeInTheDocument()
    expect(document.querySelector('.message-list--empty')).toBeInTheDocument()
    expect(listEndRef.current).toBeTruthy()
  })

  it('renders message bubbles when messages exist', () => {
    const listEndRef = createRef<HTMLDivElement>()
    render(
      <MessageList
        messages={[
          { id: 'a', text: 'First', sentAt: 1, isLocal: true },
          { id: 'b', text: 'Second', sentAt: 2, isLocal: false },
        ]}
        listEndRef={listEndRef}
      />,
    )

    expect(screen.getByText('First')).toBeInTheDocument()
    expect(screen.getByText('Second')).toBeInTheDocument()
    expect(screen.queryByText('No messages yet. Say hello.')).not.toBeInTheDocument()
  })
})
