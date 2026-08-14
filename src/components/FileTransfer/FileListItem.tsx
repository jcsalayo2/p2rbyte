import type { FileEntry } from '../../types/fileTransfer'
import { formatFileSize } from '../../utils/formatFileSize'

interface FileListItemProps {
  entry: FileEntry
}

export function FileListItem({ entry }: FileListItemProps) {
  return (
    <li className="file-list-item">
      <div className="file-list-item__main">
        <span className="file-list-item__name" title={entry.name}>
          {entry.name}
        </span>
        <span className="file-list-item__meta">
          {formatFileSize(entry.size)}
          <span className={`file-list-item__badge file-list-item__badge--${entry.direction}`}>
            {entry.direction}
          </span>
        </span>
        {entry.status !== 'complete' && !entry.error && (
          <span className="file-list-item__status">
            {progressLabel(entry)}
          </span>
        )}
        {entry.error && <span className="file-list-item__error">{entry.error}</span>}
      </div>
      {entry.status === 'complete' && entry.blobUrl && (
        <a
          href={entry.blobUrl}
          download={entry.name}
          className="btn btn--ghost file-list-item__download"
        >
          Download
        </a>
      )}
    </li>
  )
}

function progressLabel(entry: FileEntry): string {
  const { status, bytesTransferred, size } = entry
  if (
    (status === 'sending' || status === 'receiving') &&
    bytesTransferred !== undefined &&
    bytesTransferred > 0
  ) {
    const verb = status === 'sending' ? 'Sending' : 'Receiving'
    return `${verb} ${formatFileSize(bytesTransferred)} / ${formatFileSize(size)}`
  }
  return statusLabel(status)
}

function statusLabel(status: FileEntry['status']): string {
  switch (status) {
    case 'preparing':
      return 'Preparing…'
    case 'sending':
      return 'Sending…'
    case 'receiving':
      return 'Receiving…'
    case 'error':
      return 'Failed'
    default:
      return status
  }
}
