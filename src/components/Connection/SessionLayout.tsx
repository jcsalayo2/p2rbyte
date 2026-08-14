import { useDataChannelBus } from '../../hooks/useDataChannelBus'
import { useFileTransfer } from '../../hooks/useFileTransfer'
import { ChatPanel } from '../Chat/ChatPanel'
import { FileSidebar } from '../FileTransfer/FileSidebar'

interface SessionLayoutProps {
  dataChannel: RTCDataChannel | null
  connected: boolean
}

export function SessionLayout({ dataChannel, connected }: SessionLayoutProps) {
  const bus = useDataChannelBus(dataChannel)
  const { files, sendFile, sendError, canSend } = useFileTransfer({ bus })

  if (!bus) return null

  return (
    <div className="session-layout">
      <ChatPanel
        bus={bus}
        connected={connected}
        onSendFile={(file) => sendFile(file)}
        fileSendError={sendError}
        canSendFile={connected && canSend}
      />
      <FileSidebar files={files} />
    </div>
  )
}
