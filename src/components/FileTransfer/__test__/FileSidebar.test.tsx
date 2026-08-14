import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { FileEntry } from '../../../types/fileTransfer'
import { FileSidebar } from '../FileSidebar'

const sampleFile: FileEntry = {
  transferId: 't1',
  name: 'notes.txt',
  size: 128,
  mimeType: 'text/plain',
  direction: 'sent',
  status: 'complete',
}

describe('FileSidebar', () => {
  it('shows empty state when no files', () => {
    render(<FileSidebar files={[]} />)
    expect(screen.getByText('Files')).toBeInTheDocument()
    expect(screen.getByText('No files yet')).toBeInTheDocument()
  })

  it('lists files with count badge', () => {
    render(<FileSidebar files={[sampleFile]} />)
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('notes.txt')).toBeInTheDocument()
    expect(screen.queryByText('No files yet')).not.toBeInTheDocument()
  })
})
