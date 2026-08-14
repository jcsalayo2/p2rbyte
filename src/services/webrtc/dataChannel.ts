import { DATA_CHANNEL_LABEL } from '../../config/constants'

export function createDataChannel(
  pc: RTCPeerConnection,
): RTCDataChannel {
  return pc.createDataChannel(DATA_CHANNEL_LABEL, {
    ordered: true,
  })
}

export function waitForDataChannel(
  pc: RTCPeerConnection,
): Promise<RTCDataChannel> {
  return new Promise((resolve, reject) => {
    pc.addEventListener('datachannel', (event) => {
      resolve(event.channel)
    })
    const timeout = setTimeout(() => {
      reject(new Error('Data channel timeout'))
    }, 60000)
    pc.addEventListener('connectionstatechange', () => {
      if (pc.connectionState === 'failed') {
        clearTimeout(timeout)
        reject(new Error('Connection failed'))
      }
    })
  })
}

export function waitForChannelOpen(channel: RTCDataChannel): Promise<void> {
  if (channel.readyState === 'open') return Promise.resolve()
  return new Promise((resolve, reject) => {
    channel.addEventListener('open', () => resolve(), { once: true })
    channel.addEventListener('error', () => reject(new Error('Data channel error')), {
      once: true,
    })
  })
}
