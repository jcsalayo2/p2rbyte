import { afterEach, describe, expect, it, vi } from 'vitest'
import { MAX_FILE_SIZE, MAX_SMALL_FILE_SIZE } from '../../../config/constants'
import {
  formatStorageError,
  isOpfsSupported,
  LARGE_FILE_OPFS_ERROR,
  openReceiveWriter,
  pickStorageKind,
} from '../storage'
import * as storage from '../storage'

describe('pickStorageKind', () => {
  it('uses memory for files at or below 5 MB', () => {
    expect(pickStorageKind(1024)).toBe('memory')
    expect(pickStorageKind(MAX_SMALL_FILE_SIZE)).toBe('memory')
  })

  it('uses opfs for files over 5 MB', () => {
    expect(pickStorageKind(MAX_SMALL_FILE_SIZE + 1)).toBe('opfs')
    expect(pickStorageKind(10 * 1024 * 1024)).toBe('opfs')
  })
})

describe('formatStorageError', () => {
  it('formats quota exceeded', () => {
    const err = new DOMException('quota', 'QuotaExceededError')
    expect(formatStorageError(err)).toBe('Not enough browser storage for this file')
  })

  it('returns error message', () => {
    expect(formatStorageError(new Error('disk full'))).toBe('disk full')
  })

  it('returns fallback for unknown errors', () => {
    expect(formatStorageError(null)).toBe('Failed to store file')
  })

  it('returns fallback for empty error message', () => {
    expect(formatStorageError(new Error('   '))).toBe('Failed to store file')
  })
})

describe('openReceiveWriter memory path', () => {
  it('writes and finalizes file with correct size and bytes', async () => {
    const writer = await openReceiveWriter('t1', 'test.bin', 'application/octet-stream', 16)
    expect(writer.storage).toBe('memory')

    const chunk = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])
    await writer.writeAt(4, chunk)

    const file = await writer.finalize()
    expect(file.size).toBe(16)
    expect(file.name).toBe('test.bin')

    const bytes = new Uint8Array(await file.arrayBuffer())
    expect(bytes[4]).toBe(1)
    expect(bytes[11]).toBe(8)
  })

  it('throws when writing after finalize', async () => {
    const writer = await openReceiveWriter('t2', 'test.bin', 'application/octet-stream', 8)
    await writer.finalize()
    await expect(writer.writeAt(0, new Uint8Array([1]))).rejects.toThrow('Writer closed')
  })

  it('allows abort without writing', async () => {
    const writer = await openReceiveWriter('t2b', 'test.bin', 'application/octet-stream', 8)
    await writer.abort()
    await expect(writer.writeAt(0, new Uint8Array([1]))).rejects.toThrow('Writer closed')
  })
})

describe('openReceiveWriter limits', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('rejects files over 500 MB', async () => {
    await expect(
      openReceiveWriter('t3', 'big.bin', 'application/octet-stream', MAX_FILE_SIZE + 1),
    ).rejects.toThrow('Max file size is 500.0 MB')
  })

  it('rejects large files when OPFS is unsupported', async () => {
    vi.spyOn(storage, 'isOpfsSupported').mockReturnValue(false)
    await expect(
      openReceiveWriter('t4', 'big.bin', 'application/octet-stream', MAX_SMALL_FILE_SIZE + 1),
    ).rejects.toThrow(LARGE_FILE_OPFS_ERROR)
  })
})

describe('isOpfsSupported', () => {
  it('returns boolean based on navigator.storage', () => {
    expect(typeof isOpfsSupported()).toBe('boolean')
  })
})

describe('openReceiveWriter opfs path', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  function mockOpfs() {
    const writable = {
      write: vi.fn(async () => {}),
      close: vi.fn(async () => {}),
    }
    const fileHandle = {
      createWritable: vi.fn(async () => writable),
      getFile: vi.fn(async () => new Blob([new Uint8Array([1, 2, 3])])),
    }
    const dir = {
      getFileHandle: vi.fn(async () => fileHandle),
      getDirectoryHandle: vi.fn(),
      removeEntry: vi.fn(async () => {}),
    }
    const root = {
      getDirectoryHandle: vi.fn(async () => dir),
    }
    const getDirectory = vi.fn(async () => root)

    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: { getDirectory },
    })

    vi.spyOn(storage, 'isOpfsSupported').mockReturnValue(true)

    return { writable, fileHandle, dir, getDirectory }
  }

  it('writes, finalizes, and removes temp OPFS file', async () => {
    const { writable, dir } = mockOpfs()
    const writer = await openReceiveWriter(
      'opfs-1',
      'large.bin',
      'application/octet-stream',
      MAX_SMALL_FILE_SIZE + 1,
    )

    expect(writer.storage).toBe('opfs')
    await writer.writeAt(0, new Uint8Array([9, 8, 7]))
    const file = await writer.finalize()

    expect(writable.write).toHaveBeenCalled()
    expect(writable.close).toHaveBeenCalled()
    expect(dir.removeEntry).toHaveBeenCalledWith('opfs-1')
    expect(file.name).toBe('large.bin')
    expect(file.size).toBe(3)
  })

  it('aborts OPFS writer and cleans up temp file', async () => {
    const { writable, dir } = mockOpfs()
    const writer = await openReceiveWriter(
      'opfs-2',
      'large.bin',
      'application/octet-stream',
      MAX_SMALL_FILE_SIZE + 1,
    )

    await writer.abort()

    expect(writable.close).toHaveBeenCalled()
    expect(dir.removeEntry).toHaveBeenCalledWith('opfs-2')
  })
})

describe('removeOpfsTransfer', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('removes transfer file when OPFS is supported', async () => {
    const dir = { removeEntry: vi.fn(async () => {}) }
    const root = {
      getDirectoryHandle: vi.fn(async () => dir),
    }
    const getDirectory = vi.fn(async () => root)

    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: { getDirectory },
    })

    vi.spyOn(storage, 'isOpfsSupported').mockReturnValue(true)

    await storage.removeOpfsTransfer('cleanup-id')
    expect(dir.removeEntry).toHaveBeenCalledWith('cleanup-id')
  })

  it('no-ops when OPFS is unsupported', async () => {
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: {},
    })

    await expect(storage.removeOpfsTransfer('cleanup-id')).resolves.toBeUndefined()
  })
})
