import { useCallback, useEffect, useRef, useState } from 'react'
import {
  MAX_FILE_SIZE,
  MAX_SMALL_FILE_SIZE,
} from '../config/constants'
import { getEffectiveChunkSize, readFileChunks } from '../services/file/chunking'
import {
  formatStorageError,
  isOpfsSupported,
  LARGE_FILE_OPFS_ERROR,
  openReceiveWriter,
  pickStorageKind,
  type ReceiveWriter,
} from '../services/file/storage'
import { formatFileSize } from '../utils/formatFileSize'
import type { DataChannelBus } from './useDataChannelBus'
import type { FileEntry, FileStartMessage } from '../types/fileTransfer'

interface UseFileTransferOptions {
  bus: DataChannelBus | null
}

interface PendingReceive {
  transferId: string
  name: string
  size: number
  mimeType: string
  received: number
  writerPromise: Promise<ReceiveWriter>
}

interface UseFileTransferResult {
  files: FileEntry[]
  sendFile: (file: File) => string | null
  sendError: string | null
  canSend: boolean
}

function maxFileSizeError(limitBytes: number): string {
  return `Max file size is ${formatFileSize(limitBytes)}`
}

function channelMessageLimitError(limitBytes: number): string {
  return `Data channel message limit is ${formatFileSize(limitBytes)}`
}

function formatSendFileError(err: unknown, chunkSize: number, fallback: string): string {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : ''
  if (/max-message-size|larger than max/i.test(raw)) {
    return channelMessageLimitError(chunkSize)
  }
  if (raw.trim()) return raw
  return fallback
}

function receiveTimeoutMs(size: number): number {
  if (size <= MAX_SMALL_FILE_SIZE) return 60000
  return 30 * 60 * 1000
}

export function useFileTransfer({ bus }: UseFileTransferOptions): UseFileTransferResult {
  const [files, setFiles] = useState<FileEntry[]>([])
  const [sendError, setSendError] = useState<string | null>(null)
  const pendingReceiveRef = useRef<PendingReceive | null>(null)
  const receiveTimeoutRef = useRef<number | null>(null)
  const seenTransferIdsRef = useRef(new Set<string>())
  const blobUrlsRef = useRef<string[]>([])
  const writeQueueRef = useRef(Promise.resolve())

  const canSend = bus?.isOpen ?? false

  const updateEntry = useCallback(
    (transferId: string, patch: Partial<FileEntry>) => {
      setFiles((prev) =>
        prev.map((f) => (f.transferId === transferId ? { ...f, ...patch } : f)),
      )
    },
    [],
  )

  const addEntry = useCallback((entry: FileEntry) => {
    if (seenTransferIdsRef.current.has(entry.transferId)) return false
    seenTransferIdsRef.current.add(entry.transferId)
    setFiles((prev) => [...prev, entry])
    return true
  }, [])

  const registerBlobUrl = useCallback((url: string) => {
    blobUrlsRef.current.push(url)
  }, [])

  useEffect(() => {
    return () => {
      blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
      blobUrlsRef.current = []
    }
  }, [])

  const clearReceiveTimeout = useCallback(() => {
    if (receiveTimeoutRef.current !== null) {
      window.clearTimeout(receiveTimeoutRef.current)
      receiveTimeoutRef.current = null
    }
  }, [])

  const abortPendingReceive = useCallback(
    (reason: string) => {
      const pending = pendingReceiveRef.current
      if (!pending) return
      pendingReceiveRef.current = null
      clearReceiveTimeout()
      void pending.writerPromise
        .then((writer) => writer.abort())
        .catch(() => {
          // writer may not have opened
        })
      updateEntry(pending.transferId, { status: 'error', error: reason })
    },
    [updateEntry, clearReceiveTimeout],
  )

  const armReceiveTimeout = useCallback(
    (size: number) => {
      clearReceiveTimeout()
      receiveTimeoutRef.current = window.setTimeout(() => {
        abortPendingReceive('Transfer timed out')
      }, receiveTimeoutMs(size))
    },
    [clearReceiveTimeout, abortPendingReceive],
  )

  useEffect(() => {
    if (!bus) return

    seenTransferIdsRef.current.clear()
    pendingReceiveRef.current = null
    writeQueueRef.current = Promise.resolve()

    const handleFileStart = (message: FileStartMessage) => {
      if (seenTransferIdsRef.current.has(message.transferId)) return

      if (pendingReceiveRef.current) {
        abortPendingReceive('Transfer interrupted')
      }

      const storage = pickStorageKind(message.size)

      if (message.size > MAX_FILE_SIZE) {
        addEntry({
          transferId: message.transferId,
          name: message.name,
          size: message.size,
          mimeType: message.mimeType,
          direction: 'received',
          status: 'error',
          error: maxFileSizeError(MAX_FILE_SIZE),
          storage,
        })
        return
      }

      if (message.size > MAX_SMALL_FILE_SIZE && !isOpfsSupported()) {
        addEntry({
          transferId: message.transferId,
          name: message.name,
          size: message.size,
          mimeType: message.mimeType,
          direction: 'received',
          status: 'error',
          error: LARGE_FILE_OPFS_ERROR,
          storage,
        })
        return
      }

      addEntry({
        transferId: message.transferId,
        name: message.name,
        size: message.size,
        mimeType: message.mimeType,
        direction: 'received',
        status: 'receiving',
        storage,
      })

      const writerPromise = openReceiveWriter(
        message.transferId,
        message.name,
        message.mimeType,
        message.size,
      )

      pendingReceiveRef.current = {
        transferId: message.transferId,
        name: message.name,
        size: message.size,
        mimeType: message.mimeType,
        received: 0,
        writerPromise,
      }

      armReceiveTimeout(message.size)

      void writerPromise.catch((err) => {
        if (pendingReceiveRef.current?.transferId !== message.transferId) return
        pendingReceiveRef.current = null
        clearReceiveTimeout()
        updateEntry(message.transferId, {
          status: 'error',
          error: formatStorageError(err),
        })
      })
    }

    const unsubStart = bus.subscribe('file-start', (message) => {
      if (message.type !== 'file-start') return
      handleFileStart(message)
    })

    const unsubBinary = bus.subscribe('binary', (data) => {
      const pending = pendingReceiveRef.current
      if (!pending) return

      const chunk = new Uint8Array(data)
      if (pending.received + chunk.length > pending.size) {
        abortPendingReceive('File size mismatch')
        return
      }

      writeQueueRef.current = writeQueueRef.current.then(async () => {
        const active = pendingReceiveRef.current
        if (!active || active.transferId !== pending.transferId) return

        try {
          const writer = await active.writerPromise
          await writer.writeAt(active.received, chunk)
          active.received += chunk.length
          armReceiveTimeout(active.size)
          updateEntry(active.transferId, { bytesTransferred: active.received })
        } catch (err) {
          abortPendingReceive(formatStorageError(err))
        }
      })
    })

    const unsubEnd = bus.subscribe('file-end', (message) => {
      if (message.type !== 'file-end') return
      const pending = pendingReceiveRef.current
      if (!pending || pending.transferId !== message.transferId) return

      writeQueueRef.current = writeQueueRef.current.then(async () => {
        const active = pendingReceiveRef.current
        if (!active || active.transferId !== message.transferId) return

        if (active.received !== active.size) {
          abortPendingReceive('Incomplete file received')
          return
        }

        try {
          const writer = await active.writerPromise
          const file = await writer.finalize()
          const blobUrl = URL.createObjectURL(file)
          registerBlobUrl(blobUrl)
          pendingReceiveRef.current = null
          clearReceiveTimeout()

          updateEntry(message.transferId, {
            status: 'complete',
            blobUrl,
            bytesTransferred: active.size,
            completedAt: Date.now(),
          })
        } catch (err) {
          abortPendingReceive(formatStorageError(err))
        }
      })
    })

    const unsubAbort = bus.subscribe('file-abort', (message) => {
      if (message.type !== 'file-abort') return
      if (pendingReceiveRef.current?.transferId === message.transferId) {
        const pending = pendingReceiveRef.current
        pendingReceiveRef.current = null
        clearReceiveTimeout()
        void pending.writerPromise
          .then((writer) => writer.abort())
          .catch(() => {
            // writer may not have opened
          })
      }
      updateEntry(message.transferId, {
        status: 'error',
        error: message.reason ?? 'Transfer aborted',
      })
    })

    return () => {
      clearReceiveTimeout()
      const pending = pendingReceiveRef.current
      if (pending) {
        void pending.writerPromise
          .then((writer) => writer.abort())
          .catch(() => {
            // writer may not have opened
          })
        pendingReceiveRef.current = null
      }
      unsubStart()
      unsubBinary()
      unsubEnd()
      unsubAbort()
    }
  }, [
    bus,
    addEntry,
    updateEntry,
    registerBlobUrl,
    abortPendingReceive,
    armReceiveTimeout,
    clearReceiveTimeout,
  ])

  const sendFile = useCallback(
    (file: File): string | null => {
      setSendError(null)

      if (!bus?.isOpen) {
        const err = 'Cannot send — not connected'
        setSendError(err)
        return err
      }

      if (file.size > MAX_FILE_SIZE) {
        const err = maxFileSizeError(MAX_FILE_SIZE)
        setSendError(err)
        return err
      }

      if (file.size > MAX_SMALL_FILE_SIZE && !isOpfsSupported()) {
        setSendError(LARGE_FILE_OPFS_ERROR)
        return LARGE_FILE_OPFS_ERROR
      }

      if (file.size === 0) {
        const err = 'File is empty'
        setSendError(err)
        return err
      }

      const transferId = crypto.randomUUID()
      const storage = pickStorageKind(file.size)

      if (
        !addEntry({
          transferId,
          name: file.name,
          size: file.size,
          mimeType: file.type || 'application/octet-stream',
          direction: 'sent',
          status: 'preparing',
          storage,
        })
      ) {
        const err = 'Duplicate transfer'
        setSendError(err)
        return err
      }

      void (async () => {
        let started = false
        const chunkSize = getEffectiveChunkSize(bus.maxMessageSize)
        try {
          updateEntry(transferId, { status: 'sending', bytesTransferred: 0 })

          bus.sendControl({
            type: 'file-start',
            transferId,
            name: file.name,
            size: file.size,
            mimeType: file.type || 'application/octet-stream',
          })
          started = true

          let bytesSent = 0
          for await (const chunk of readFileChunks(file, chunkSize)) {
            if (!bus.isOpen) {
              throw new Error('Data channel not open')
            }
            await bus.sendBinary(chunk)
            bytesSent += chunk.byteLength
            updateEntry(transferId, { bytesTransferred: bytesSent })
          }

          bus.sendControl({ type: 'file-end', transferId })

          const blobUrl = URL.createObjectURL(file)
          registerBlobUrl(blobUrl)

          updateEntry(transferId, {
            status: 'complete',
            blobUrl,
            bytesTransferred: file.size,
            completedAt: Date.now(),
          })
        } catch (err) {
          const reason = formatSendFileError(err, chunkSize, 'Failed to send file')
          if (started) {
            try {
              bus.sendControl({
                type: 'file-abort',
                transferId,
                reason,
              })
            } catch {
              // channel may be closed
            }
          }
          updateEntry(transferId, {
            status: 'error',
            error: reason,
          })
          setSendError(reason)
        }
      })()

      return null
    },
    [bus, addEntry, updateEntry, registerBlobUrl],
  )

  return { files, sendFile, sendError, canSend }
}
