import type { FileEntry } from '../../types/fileTransfer'
import { Card } from '../common/Card'
import { FileListItem } from './FileListItem'

interface FileSidebarProps {
  files: FileEntry[]
}

export function FileSidebar({ files }: FileSidebarProps) {
  return (
    <Card className="file-sidebar">
      <div className="file-sidebar__header">
        <p className="file-sidebar__title">Files</p>
        {files.length > 0 && (
          <span className="file-sidebar__count">{files.length}</span>
        )}
      </div>

      <div className="file-sidebar__scroll scroll-area">
        {files.length === 0 ? (
          <p className="file-sidebar__empty">No files yet</p>
        ) : (
          <ul className="file-sidebar__list">
            {files.map((entry) => (
              <FileListItem key={entry.transferId} entry={entry} />
            ))}
          </ul>
        )}
      </div>

      <p className="file-sidebar__note">
        Files are stored temporarily by your browser for this session.
      </p>
    </Card>
  )
}
