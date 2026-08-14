import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MAX_FILE_SIZE, MAX_SMALL_FILE_SIZE } from '../../config/constants'
import { LARGE_FILE_OPFS_ERROR } from '../../services/file/storage'
import type { DataChannelBus } from '../useDataChannelBus'
import { useFileTransfer } from '../useFileTransfer'

vi.mock('../../services/file/chunking', () => ({
  getEffectiveChunkSize: vi.fn(() => 1024),
  readFileChunks: vi.fn(async function* (file: File) {
    const bytes = new Uint8Array(await file.arrayBuffer())
    yield bytes.buffer
  }),
}))

vi.mock('../../services/file/storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/file/storage')>()
  return {
    ...actual,
    isOpfsSupported: vi.fn(() => true),
    openReceiveWriter: vi.fn(async () => ({
      storage: 'memory' as const,
      writeAt: vi.fn(async () => {}),
      finalize: vi.fn(async () => new File([new Uint8Array([1, 2, 3])], 'received.txt')),
      abort: vi.fn(async () => {}),
    })),
  }
})

import { isOpfsSupported, openReceiveWriter } from '../../services/file/storage'

type MockBus = DataChannelBus & {
  emitControl: (message: Parameters<DataChannelBus['sendControl']>[0]) => void
  emitBinary: (data: ArrayBuffer) => void
}

function createMockBus(overrides: Partial<DataChannelBus> = {}): MockBus {
  const controlHandlers = new Map<string, Set<(message: unknown) => void>>()
  const binaryHandlers = new Set<(data: ArrayBuffer) => void>()

  const bus: MockBus = {
    isOpen: true,
    subscribe: vi.fn((type, handler) => {
      if (type === 'binary') {
        const fn = handler as (data: ArrayBuffer) => void
        binaryHandlers.add(fn)
        return () => binaryHandlers.delete(fn)
      }

      const fn = handler as (message: unknown) => void
      if (!controlHandlers.has(type)) controlHandlers.set(type, new Set())
      controlHandlers.get(type)!.add(fn)
      return () => controlHandlers.get(type)?.delete(fn)
    }),
    sendControl: vi.fn(),
    sendBinary: vi.fn(async () => {}),
    waitUntilCanSend: vi.fn(async () => {}),
    maxMessageSize: 65536,
    bufferedAmount: 0,
    emitControl(message) {
      controlHandlers.get(message.type)?.forEach((handler) => handler(message))
    },
    emitBinary(data) {
      binaryHandlers.forEach((handler) => handler(data))
    },
    ...overrides,
  }

  return bus
}

describe('useFileTransfer', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.mocked(isOpfsSupported).mockReturnValue(true)
  })

  it('reports canSend false when bus is null', () => {
    const { result } = renderHook(() => useFileTransfer({ bus: null }))
    expect(result.current.canSend).toBe(false)
  })

  it('rejects send when not connected', () => {
    const bus = createMockBus({ isOpen: false })
    const { result } = renderHook(() => useFileTransfer({ bus }))
    const file = new File(['hello'], 'notes.txt', { type: 'text/plain' })

    act(() => {
      expect(result.current.sendFile(file)).toBe('Cannot send — not connected')
    })

    expect(result.current.sendError).toBe('Cannot send — not connected')
  })

  it('rejects empty files', () => {
    const bus = createMockBus()
    const { result } = renderHook(() => useFileTransfer({ bus }))
    const file = new File([], 'empty.txt', { type: 'text/plain' })

    act(() => {
      expect(result.current.sendFile(file)).toBe('File is empty')
    })
  })

  it('rejects files over 500 MB', () => {
    const bus = createMockBus()
    const { result } = renderHook(() => useFileTransfer({ bus }))
    const file = new File([new Uint8Array(1)], 'big.bin', { type: 'application/octet-stream' })
    Object.defineProperty(file, 'size', { value: MAX_FILE_SIZE + 1 })

    act(() => {
      expect(result.current.sendFile(file)).toBe('Max file size is 500.0 MB')
    })
  })

  it('rejects large files when OPFS is unsupported', () => {
    vi.mocked(isOpfsSupported).mockReturnValue(false)
    const bus = createMockBus()
    const { result } = renderHook(() => useFileTransfer({ bus }))
    const file = new File([new Uint8Array(1)], 'big.bin', { type: 'application/octet-stream' })
    Object.defineProperty(file, 'size', { value: MAX_SMALL_FILE_SIZE + 1 })

    act(() => {
      expect(result.current.sendFile(file)).toBe(LARGE_FILE_OPFS_ERROR)
    })
  })

  it('sends a small file and marks it complete', async () => {
    const bus = createMockBus()
    const { result } = renderHook(() => useFileTransfer({ bus }))
    const file = new File(['hello'], 'notes.txt', { type: 'text/plain' })

    act(() => {
      expect(result.current.sendFile(file)).toBeNull()
    })

    await waitFor(() => {
      expect(result.current.files).toHaveLength(1)
      expect(result.current.files[0]).toMatchObject({
        name: 'notes.txt',
        direction: 'sent',
        status: 'complete',
      })
    })

    expect(bus.sendControl).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'file-start', name: 'notes.txt' }),
    )
    expect(bus.sendBinary).toHaveBeenCalled()
    expect(bus.sendControl).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'file-end' }),
    )
  })

  it('receives a file over the bus', async () => {
    const bus = createMockBus()
    const { result } = renderHook(() => useFileTransfer({ bus }))

    act(() => {
      bus.emitControl({
        type: 'file-start',
        transferId: 'rx-1',
        name: 'photo.jpg',
        size: 3,
        mimeType: 'image/jpeg',
      })
    })

    expect(result.current.files).toHaveLength(1)
    expect(result.current.files[0]).toMatchObject({
      direction: 'received',
      status: 'receiving',
    })

    act(() => {
      bus.emitBinary(new Uint8Array([1, 2, 3]).buffer)
    })

    await act(async () => {
      bus.emitControl({ type: 'file-end', transferId: 'rx-1' })
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(result.current.files[0]?.status).toBe('complete')
      expect(result.current.files[0]?.blobUrl).toBeTruthy()
    })

    expect(openReceiveWriter).toHaveBeenCalledWith('rx-1', 'photo.jpg', 'image/jpeg', 3)
  })

  it('marks receive errors for oversized incoming files', () => {
    const bus = createMockBus()
    const { result } = renderHook(() => useFileTransfer({ bus }))

    act(() => {
      bus.emitControl({
        type: 'file-start',
        transferId: 'rx-big',
        name: 'huge.bin',
        size: MAX_FILE_SIZE + 1,
        mimeType: 'application/octet-stream',
      })
    })

    expect(result.current.files[0]).toMatchObject({
      status: 'error',
      error: 'Max file size is 500.0 MB',
    })
  })

  it('marks transfer aborted by peer', async () => {
    const bus = createMockBus()
    const { result } = renderHook(() => useFileTransfer({ bus }))

    act(() => {
      bus.emitControl({
        type: 'file-start',
        transferId: 'rx-abort',
        name: 'doc.pdf',
        size: 3,
        mimeType: 'application/pdf',
      })
      bus.emitControl({
        type: 'file-abort',
        transferId: 'rx-abort',
        reason: 'Peer cancelled',
      })
    })

    await waitFor(() => {
      expect(result.current.files[0]).toMatchObject({
        status: 'error',
        error: 'Peer cancelled',
      })
    })
  })
})
