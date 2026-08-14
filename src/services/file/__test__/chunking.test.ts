import { describe, expect, it } from 'vitest'
import {
  DEFAULT_MAX_MESSAGE_SIZE,
  FILE_CHUNK_SIZE,
} from '../../../config/constants'
import { getEffectiveChunkSize, readFileChunks } from '../chunking'

describe('getEffectiveChunkSize', () => {
  it('uses default when maxMessageSize is 0', () => {
    expect(getEffectiveChunkSize(0)).toBe(DEFAULT_MAX_MESSAGE_SIZE)
  })

  it('caps at channel max when below chunk size', () => {
    expect(getEffectiveChunkSize(256 * 1024)).toBe(256 * 1024)
  })

  it('uses file chunk size when channel allows', () => {
    expect(getEffectiveChunkSize(2 * 1024 * 1024)).toBe(FILE_CHUNK_SIZE)
  })
})

describe('readFileChunks', () => {
  it('yields nothing for empty file', async () => {
    const file = new File([], 'empty.bin')
    const chunks: ArrayBuffer[] = []
    for await (const chunk of readFileChunks(file, 1024)) {
      chunks.push(chunk)
    }
    expect(chunks).toHaveLength(0)
  })

  it('splits file into chunks with correct total size', async () => {
    const size = 2.5 * 1024 * 1024
    const data = new Uint8Array(size)
    data.fill(42)
    const file = new File([data], 'test.bin')
    const chunkSize = 1024 * 1024

    const chunks: ArrayBuffer[] = []
    for await (const chunk of readFileChunks(file, chunkSize)) {
      chunks.push(chunk)
    }

    expect(chunks).toHaveLength(3)
    expect(chunks[0]?.byteLength).toBe(chunkSize)
    expect(chunks[1]?.byteLength).toBe(chunkSize)
    expect(chunks[2]?.byteLength).toBe(size - chunkSize * 2)
    expect(chunks.reduce((sum, c) => sum + c.byteLength, 0)).toBe(size)
  })
})
