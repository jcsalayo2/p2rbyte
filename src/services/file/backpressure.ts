import { BUFFER_HIGH_WATER_MARK } from '../../config/constants'

export function configureBackpressure(
  channel: RTCDataChannel,
  lowWaterMark: number,
): void {
  if (lowWaterMark >= BUFFER_HIGH_WATER_MARK) {
    throw new Error('Low water mark must be less than high water mark')
  }
  channel.bufferedAmountLowThreshold = lowWaterMark
}

function isChannelClosed(channel: RTCDataChannel): boolean {
  return channel.readyState === 'closed' || channel.readyState === 'closing'
}

export function isSendQueueFullError(err: unknown): boolean {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : ''
  return /send queue is full|QueueFull|OperationError/i.test(raw)
}

function waitForBufferedAmountLow(channel: RTCDataChannel): Promise<void> {
  if (channel.bufferedAmount <= channel.bufferedAmountLowThreshold) {
    return Promise.resolve()
  }

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      channel.removeEventListener('bufferedamountlow', onLow)
      channel.removeEventListener('close', onClose)
      channel.removeEventListener('error', onError)
    }

    const onLow = () => {
      cleanup()
      resolve()
    }

    const onClose = () => {
      cleanup()
      reject(new Error('Data channel closed'))
    }

    const onError = () => {
      cleanup()
      reject(new Error('Data channel error'))
    }

    channel.addEventListener('bufferedamountlow', onLow)
    channel.addEventListener('close', onClose)
    channel.addEventListener('error', onError)

    if (channel.bufferedAmount <= channel.bufferedAmountLowThreshold) {
      cleanup()
      resolve()
    }
  })
}

export async function waitUntilCanSend(
  channel: RTCDataChannel,
  highWaterMark: number,
  pendingBytes = 0,
): Promise<void> {
  while (channel.bufferedAmount + pendingBytes >= highWaterMark) {
    if (isChannelClosed(channel)) {
      throw new Error('Data channel closed')
    }
    await waitForBufferedAmountLow(channel)
  }
}

async function waitAfterQueueFull(channel: RTCDataChannel): Promise<void> {
  if (channel.bufferedAmount === 0) {
    await new Promise((resolve) => setTimeout(resolve, 16))
    return
  }
  await waitForBufferedAmountLow(channel)
}

export async function sendWithBackpressure(
  channel: RTCDataChannel,
  data: ArrayBuffer,
  highWaterMark: number,
): Promise<void> {
  if (isChannelClosed(channel)) {
    throw new Error('Data channel not open')
  }

  const pendingBytes = data.byteLength

  for (;;) {
    await waitUntilCanSend(channel, highWaterMark, pendingBytes)

    try {
      channel.send(data)
      return
    } catch (err) {
      if (!isSendQueueFullError(err)) throw err
      await waitAfterQueueFull(channel)
    }
  }
}
