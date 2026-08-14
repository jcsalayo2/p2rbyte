import { DEFAULT_MAX_MESSAGE_SIZE, FILE_CHUNK_SIZE } from '../../config/constants'

export function getEffectiveChunkSize(maxMessageSize: number): number {
  const channelMax = maxMessageSize > 0 ? maxMessageSize : DEFAULT_MAX_MESSAGE_SIZE
  return Math.min(FILE_CHUNK_SIZE, channelMax)
}

export async function* readFileChunks(
  file: File,
  chunkSize: number,
): AsyncGenerator<ArrayBuffer> {
  let offset = 0
  while (offset < file.size) {
    const end = Math.min(offset + chunkSize, file.size)
    yield await file.slice(offset, end).arrayBuffer()
    offset = end
  }
}
