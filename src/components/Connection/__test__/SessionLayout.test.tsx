import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DataChannelBus } from '../../../hooks/useDataChannelBus'
import { SessionLayout } from '../SessionLayout'

vi.mock('../../../hooks/useDataChannelBus', () => ({
  useDataChannelBus: vi.fn(),
}))

vi.mock('../../../hooks/useFileTransfer', () => ({
  useFileTransfer: vi.fn(),
}))

vi.mock('../../Chat/ChatPanel', () => ({
  ChatPanel: vi.fn(({ connected, canSendFile }: { connected: boolean; canSendFile: boolean }) => (
    <div data-testid="chat-panel" data-connected={connected} data-can-send-file={canSendFile} />
  )),
}))

vi.mock('../../FileTransfer/FileSidebar', () => ({
  FileSidebar: vi.fn(({ files }: { files: unknown[] }) => (
    <div data-testid="file-sidebar" data-file-count={files.length} />
  )),
}))

import { useDataChannelBus } from '../../../hooks/useDataChannelBus'
import { useFileTransfer } from '../../../hooks/useFileTransfer'
import { ChatPanel } from '../../Chat/ChatPanel'
import { FileSidebar } from '../../FileTransfer/FileSidebar'

const mockUseDataChannelBus = vi.mocked(useDataChannelBus)
const mockUseFileTransfer = vi.mocked(useFileTransfer)
const mockChatPanel = vi.mocked(ChatPanel)
const mockFileSidebar = vi.mocked(FileSidebar)

const mockBus = {
  subscribe: vi.fn(() => () => {}),
  sendControl: vi.fn(),
  sendBinary: vi.fn(async () => {}),
  waitUntilCanSend: vi.fn(async () => {}),
  isOpen: true,
  maxMessageSize: 65536,
  bufferedAmount: 0,
} satisfies DataChannelBus

describe('SessionLayout', () => {
  beforeEach(() => {
    mockUseDataChannelBus.mockReturnValue(mockBus)
    mockUseFileTransfer.mockReturnValue({
      files: [{ transferId: 't1' }],
      sendFile: vi.fn(),
      sendError: null,
      canSend: true,
    })
  })

  it('returns null when data channel bus is unavailable', () => {
    mockUseDataChannelBus.mockReturnValue(null)

    const { container } = render(
      <SessionLayout dataChannel={null} connected={false} />,
    )

    expect(container.firstChild).toBeNull()
  })

  it('renders chat panel and file sidebar when bus is ready', () => {
    render(<SessionLayout dataChannel={{} as RTCDataChannel} connected={true} />)

    expect(screen.getByTestId('chat-panel')).toBeInTheDocument()
    expect(screen.getByTestId('file-sidebar')).toBeInTheDocument()
    expect(screen.getByTestId('chat-panel')).toHaveAttribute('data-connected', 'true')
    expect(screen.getByTestId('chat-panel')).toHaveAttribute('data-can-send-file', 'true')
    expect(screen.getByTestId('file-sidebar')).toHaveAttribute('data-file-count', '1')
  })

  it('disables file send when not connected', () => {
    render(<SessionLayout dataChannel={{} as RTCDataChannel} connected={false} />)

    expect(screen.getByTestId('chat-panel')).toHaveAttribute('data-can-send-file', 'false')
  })

  it('forwards sendFile through chat panel', async () => {
    const sendFile = vi.fn()
    mockUseFileTransfer.mockReturnValue({
      files: [],
      sendFile,
      sendError: 'Too large',
      canSend: true,
    })

    render(<SessionLayout dataChannel={{} as RTCDataChannel} connected={true} />)

    const props = mockChatPanel.mock.calls.at(-1)?.[0]
    expect(props?.fileSendError).toBe('Too large')

    const file = new File(['x'], 'notes.txt', { type: 'text/plain' })
    props?.onSendFile(file)
    expect(sendFile).toHaveBeenCalledWith(file)
  })

  it('passes files to sidebar', () => {
    render(<SessionLayout dataChannel={{} as RTCDataChannel} connected={true} />)

    const props = mockFileSidebar.mock.calls.at(-1)?.[0]
    expect(props?.files).toHaveLength(1)
  })
})
