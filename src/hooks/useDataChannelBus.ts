import { useCallback, useEffect, useMemo, useRef } from 'react'
import {
  BUFFER_HIGH_WATER_MARK,
  BUFFER_LOW_WATER_MARK,
} from '../config/constants'
import {
  configureBackpressure,
  sendWithBackpressure,
  waitUntilCanSend as waitUntilCanSendChannel,
} from '../services/file/backpressure'
import { encodeControlMessage, parseControlMessage } from '../services/protocol/wire'
import type { ControlMessage } from '../services/protocol/wire'

export type BusMessageType = ControlMessage['type'] | 'binary'

type StringHandler = (message: ControlMessage) => void
type BinaryHandler = (data: ArrayBuffer) => void

export interface DataChannelBus {
  subscribe(type: 'binary', handler: BinaryHandler): () => void
  subscribe(type: ControlMessage['type'], handler: StringHandler): () => void
  sendControl: (message: ControlMessage) => void
  sendBinary: (data: ArrayBuffer) => Promise<void>
  waitUntilCanSend: (pendingBytes?: number) => Promise<void>
  isOpen: boolean
  maxMessageSize: number
  bufferedAmount: number
}

type DataChannelWithMaxSize = RTCDataChannel & { maxMessageSize?: number }

export function useDataChannelBus(
  dataChannel: RTCDataChannel | null,
): DataChannelBus | null {
  const stringSubsRef = useRef(new Map<string, Set<StringHandler>>())
  const binarySubsRef = useRef(new Set<BinaryHandler>())

  useEffect(() => {
    if (!dataChannel) return

    const handleMessage = (event: MessageEvent) => {
      if (typeof event.data === 'string') {
        const parsed = parseControlMessage(event.data)
        if (!parsed) return
        const handlers = stringSubsRef.current.get(parsed.type)
        handlers?.forEach((fn) => fn(parsed))
      } else if (event.data instanceof ArrayBuffer) {
        binarySubsRef.current.forEach((fn) => fn(event.data))
      }
    }

    dataChannel.addEventListener('message', handleMessage)
    return () => dataChannel.removeEventListener('message', handleMessage)
  }, [dataChannel])

  useEffect(() => {
    if (!dataChannel) return

    const setupBackpressure = () => {
      configureBackpressure(dataChannel, BUFFER_LOW_WATER_MARK)
    }

    if (dataChannel.readyState === 'open') {
      setupBackpressure()
    } else {
      dataChannel.addEventListener('open', setupBackpressure, { once: true })
    }
  }, [dataChannel])

  const subscribe = useMemo((): DataChannelBus['subscribe'] => {
    return (type, handler) => {
      if (type === 'binary') {
        const fn = handler as BinaryHandler
        binarySubsRef.current.add(fn)
        return () => binarySubsRef.current.delete(fn)
      }

      const fn = handler as StringHandler
      let set = stringSubsRef.current.get(type)
      if (!set) {
        set = new Set()
        stringSubsRef.current.set(type, set)
      }
      set.add(fn)
      return () => {
        set!.delete(fn)
        if (set!.size === 0) stringSubsRef.current.delete(type)
      }
    }
  }, [])

  const sendControl = useCallback(
    (message: ControlMessage) => {
      if (!dataChannel || dataChannel.readyState !== 'open') {
        throw new Error('Data channel not open')
      }
      dataChannel.send(encodeControlMessage(message))
    },
    [dataChannel],
  )

  const sendBinary = useCallback(
    async (data: ArrayBuffer) => {
      if (!dataChannel || dataChannel.readyState !== 'open') {
        throw new Error('Data channel not open')
      }
      await sendWithBackpressure(dataChannel, data, BUFFER_HIGH_WATER_MARK)
    },
    [dataChannel],
  )

  const waitUntilCanSend = useCallback(
    async (pendingBytes = 0) => {
      if (!dataChannel || dataChannel.readyState !== 'open') {
        throw new Error('Data channel not open')
      }
      await waitUntilCanSendChannel(dataChannel, BUFFER_HIGH_WATER_MARK, pendingBytes)
    },
    [dataChannel],
  )

  return useMemo((): DataChannelBus | null => {
    if (!dataChannel) return null
    return {
      subscribe,
      sendControl,
      sendBinary,
      waitUntilCanSend,
      get isOpen() {
        return dataChannel.readyState === 'open'
      },
      get maxMessageSize() {
        const channel = dataChannel as DataChannelWithMaxSize
        const max = channel.maxMessageSize
        return typeof max === 'number' && max > 0 ? max : 0
      },
      get bufferedAmount() {
        return dataChannel.bufferedAmount
      },
    }
  }, [dataChannel, subscribe, sendControl, sendBinary, waitUntilCanSend])
}
