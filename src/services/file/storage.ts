import {
  MAX_FILE_SIZE,
  MAX_SMALL_FILE_SIZE,
  OPFS_ROOT,
} from '../../config/constants'
import { formatFileSize } from '../../utils/formatFileSize'

export type StorageKind = 'memory' | 'opfs'

export interface ReceiveWriter {
  readonly storage: StorageKind
  writeAt(offset: number, data: Uint8Array): Promise<void>
  finalize(): Promise<File>
  abort(): Promise<void>
}

export function isOpfsSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'storage' in navigator &&
    typeof navigator.storage.getDirectory === 'function'
  )
}

export function pickStorageKind(size: number): StorageKind {
  return size > MAX_SMALL_FILE_SIZE ? 'opfs' : 'memory'
}

export const LARGE_FILE_OPFS_ERROR =
  'Files over 5 MB require OPFS support in this browser'

export function formatStorageError(err: unknown): string {
  if (err instanceof DOMException && err.name === 'QuotaExceededError') {
    return 'Not enough browser storage for this file'
  }
  if (err instanceof Error && err.message.trim()) {
    return err.message
  }
  return 'Failed to store file'
}

function openMemoryReceiveWriter(
  size: number,
  name: string,
  mimeType: string,
): ReceiveWriter {
  const buffer = new Uint8Array(size)
  let closed = false

  return {
    storage: 'memory',
    async writeAt(offset, data) {
      if (closed) throw new Error('Writer closed')
      buffer.set(data, offset)
    },
    async finalize() {
      if (closed) throw new Error('Writer closed')
      closed = true
      return new File([buffer.slice()], name, {
        type: mimeType,
        lastModified: Date.now(),
      })
    },
    async abort() {
      closed = true
    },
  }
}

async function openOpfsReceiveWriter(
  transferId: string,
  name: string,
  mimeType: string,
): Promise<ReceiveWriter> {
  const root = await navigator.storage.getDirectory()
  const dir = await root.getDirectoryHandle(OPFS_ROOT, { create: true })
  const fileHandle = await dir.getFileHandle(transferId, { create: true })
  const writable = await fileHandle.createWritable()
  let closed = false

  const removeTempFile = async () => {
    try {
      await dir.removeEntry(transferId)
    } catch {
      // already removed or missing
    }
  }

  return {
    storage: 'opfs',
    async writeAt(offset, data) {
      if (closed) throw new Error('Writer closed')
      await writable.write({
        type: 'write',
        position: offset,
        data: new Uint8Array(data),
      })
    },
    async finalize() {
      if (closed) throw new Error('Writer closed')
      await writable.close()
      closed = true
      const blob = await fileHandle.getFile()
      const file = new File([blob], name, {
        type: mimeType,
        lastModified: Date.now(),
      })
      await removeTempFile()
      return file
    },
    async abort() {
      if (!closed) {
        try {
          await writable.close()
        } catch {
          // channel may already be closed
        }
        closed = true
      }
      await removeTempFile()
    },
  }
}

export async function openReceiveWriter(
  transferId: string,
  name: string,
  mimeType: string,
  size: number,
): Promise<ReceiveWriter> {
  if (size > MAX_FILE_SIZE) {
    throw new Error(`Max file size is ${formatFileSize(MAX_FILE_SIZE)}`)
  }

  const kind = pickStorageKind(size)
  if (kind === 'opfs') {
    if (!isOpfsSupported()) {
      throw new Error(LARGE_FILE_OPFS_ERROR)
    }
    return openOpfsReceiveWriter(transferId, name, mimeType)
  }

  return openMemoryReceiveWriter(size, name, mimeType)
}

export async function removeOpfsTransfer(transferId: string): Promise<void> {
  if (!isOpfsSupported()) return

  try {
    const root = await navigator.storage.getDirectory()
    const dir = await root.getDirectoryHandle(OPFS_ROOT)
    await dir.removeEntry(transferId)
  } catch {
    // best-effort cleanup
  }
}
