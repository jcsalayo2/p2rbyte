import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { FileEntry } from '../../../types/fileTransfer'
import { FileListItem } from '../FileListItem'

function entry(overrides: Partial<FileEntry> = {}): FileEntry {
  return {
    transferId: 't1',
    name: 'report.pdf',
    size: 2048,
    mimeType: 'application/pdf',
    direction: 'received',
    status: 'complete',
    ...overrides,
  }
}

describe('FileListItem', () => {
  it('renders name, size, and direction badge', () => {
    render(<FileListItem entry={entry()} />)
    expect(screen.getByText('report.pdf')).toBeInTheDocument()
    expect(screen.getByText('2.0 KB')).toBeInTheDocument()
    expect(screen.getByText('received')).toHaveClass('file-list-item__badge--received')
  })

  it('shows download link when complete with blob URL', () => {
    render(<FileListItem entry={entry({ blobUrl: 'blob:abc' })} />)
    const link = screen.getByRole('link', { name: 'Download' })
    expect(link).toHaveAttribute('href', 'blob:abc')
    expect(link).toHaveAttribute('download', 'report.pdf')
  })

  it('shows progress while sending', () => {
    render(
      <FileListItem
        entry={entry({
          status: 'sending',
          direction: 'sent',
          bytesTransferred: 1024,
          size: 4096,
        })}
      />,
    )
    expect(screen.getByText('Sending 1.0 KB / 4.0 KB')).toBeInTheDocument()
  })

  it('shows status label without byte progress', () => {
    render(<FileListItem entry={entry({ status: 'preparing', direction: 'sent' })} />)
    expect(screen.getByText('Preparing…')).toBeInTheDocument()
  })

  it('shows progress while receiving', () => {
    render(
      <FileListItem
        entry={entry({
          status: 'receiving',
          bytesTransferred: 512,
          size: 2048,
        })}
      />,
    )
    expect(screen.getByText('Receiving 512 B / 2.0 KB')).toBeInTheDocument()
  })

  it('shows receiving label without byte progress', () => {
    render(<FileListItem entry={entry({ status: 'receiving' })} />)
    expect(screen.getByText('Receiving…')).toBeInTheDocument()
  })
})
