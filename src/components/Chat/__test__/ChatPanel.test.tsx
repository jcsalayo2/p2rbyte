import { createRef } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DataChannelBus } from '../../../hooks/useDataChannelBus'
import { ChatPanel } from '../ChatPanel'

vi.mock('../../../hooks/useChat', () => ({
  useChat: vi.fn(),
}))

import { useChat } from '../../../hooks/useChat'

const mockUseChat = vi.mocked(useChat)

const mockBus = {
  subscribe: vi.fn(() => () => {}),
  sendControl: vi.fn(),
  sendBinary: vi.fn(async () => {}),
  waitUntilCanSend: vi.fn(async () => {}),
  isOpen: true,
  maxMessageSize: 65536,
  bufferedAmount: 0,
} satisfies DataChannelBus

describe('ChatPanel', () => {
  beforeEach(() => {
    mockUseChat.mockReturnValue({
      messages: [{ id: '1', text: 'Hi', sentAt: 1, isLocal: true }],
      sendMessage: vi.fn(),
      sendError: null,
      canSend: true,
      listEndRef: createRef(),
    })
  })

  it('renders chat title and messages from useChat', () => {
    render(
      <ChatPanel
        bus={mockBus}
        connected={true}
        onSendFile={vi.fn()}
        canSendFile={true}
      />,
    )

    expect(screen.getByText('Chat')).toBeInTheDocument()
    expect(screen.getByText('Hi')).toBeInTheDocument()
  })

  it('disables input when not connected', () => {
    const { container } = render(
      <ChatPanel
        bus={mockBus}
        connected={false}
        onSendFile={vi.fn()}
        canSendFile={false}
      />,
    )

    expect(container.querySelector('textarea')).toBeDisabled()
  })

  it('shows waiting hint when connected but channel not ready', () => {
    mockUseChat.mockReturnValue({
      messages: [],
      sendMessage: vi.fn(),
      sendError: null,
      canSend: false,
      listEndRef: createRef(),
    })

    render(
      <ChatPanel
        bus={mockBus}
        connected={true}
        onSendFile={vi.fn()}
        canSendFile={false}
      />,
    )

    expect(screen.getByText('Waiting for data channel…')).toBeInTheDocument()
  })

  it('shows chat send error from useChat', () => {
    mockUseChat.mockReturnValue({
      messages: [],
      sendMessage: vi.fn(),
      sendError: 'Cannot send — not connected',
      canSend: false,
      listEndRef: createRef(),
    })

    render(
      <ChatPanel
        bus={mockBus}
        connected={false}
        onSendFile={vi.fn()}
        canSendFile={false}
      />,
    )

    expect(screen.getByText('Cannot send — not connected')).toBeInTheDocument()
  })

  it('shows file send error when provided', () => {
    render(
      <ChatPanel
        bus={mockBus}
        connected={true}
        onSendFile={vi.fn()}
        canSendFile={true}
        fileSendError="Max file size is 500.0 MB"
      />,
    )

    expect(screen.getByText('Max file size is 500.0 MB')).toBeInTheDocument()
  })

  it('forwards chat input to sendMessage', async () => {
    const user = userEvent.setup()
    const sendMessage = vi.fn()
    mockUseChat.mockReturnValue({
      messages: [],
      sendMessage,
      sendError: null,
      canSend: true,
      listEndRef: createRef(),
    })

    render(
      <ChatPanel
        bus={mockBus}
        connected={true}
        onSendFile={vi.fn()}
        canSendFile={true}
      />,
    )

    await user.type(screen.getByPlaceholderText('Type a message…'), 'Hi there')
    await user.click(screen.getByRole('button', { name: 'Send' }))

    expect(sendMessage).toHaveBeenCalledWith('Hi there')
  })
})
