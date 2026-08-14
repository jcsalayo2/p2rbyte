import { useState } from 'react'
import { Button } from '../common/Button'
import { Card } from '../common/Card'
import { QrCode } from './QrCode'

export type ShareMode = 'link' | 'qr'

interface SessionShareProps {
  roomId: string
  joinUrl: string
  mode: ShareMode
  onModeChange: (mode: ShareMode) => void
}

export function SessionShare({
  roomId,
  joinUrl,
  mode,
  onModeChange,
}: SessionShareProps) {
  const [copiedLink, setCopiedLink] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)

  async function copyLink() {
    await navigator.clipboard.writeText(joinUrl)
    setCopiedLink(true)
    window.setTimeout(() => setCopiedLink(false), 2000)
  }

  async function copyCode() {
    await navigator.clipboard.writeText(roomId)
    setCopiedCode(true)
    window.setTimeout(() => setCopiedCode(false), 2000)
  }

  return (
    <Card className="session-share">
      <div className="session-share__header">
        <p className="session-share__title">Share with peer</p>
        <div className="share-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'link'}
            className={`share-tabs__tab${mode === 'link' ? ' share-tabs__tab--active' : ''}`}
            onClick={() => onModeChange('link')}
          >
            Link
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'qr'}
            className={`share-tabs__tab${mode === 'qr' ? ' share-tabs__tab--active' : ''}`}
            onClick={() => onModeChange('qr')}
          >
            QR code
          </button>
        </div>
      </div>

      <div className="session-share__code-block">
        <span className="session-share__label">Session code</span>
        <div className="session-share__code-row">
          <span className="session-share__code">{roomId}</span>
          <Button variant="ghost" onClick={() => void copyCode()}>
            {copiedCode ? 'Copied' : 'Copy'}
          </Button>
        </div>
      </div>

      {mode === 'link' ? (
        <div className="session-share__panel">
          <span className="session-share__label">Join link</span>
          <div className="url-field">
            <code className="url-field__text">{joinUrl}</code>
          </div>
          <Button variant="ghost" onClick={() => void copyLink()}>
            {copiedLink ? 'Link copied' : 'Copy link'}
          </Button>
        </div>
      ) : (
        <div className="session-share__panel session-share__panel--qr">
          <span className="session-share__label">Scan to join</span>
          <div className="qr-frame">
            <QrCode value={joinUrl} size={220} />
          </div>
          <p className="session-share__qr-hint">
            Open camera on other device. No app install needed.
          </p>
        </div>
      )}
    </Card>
  )
}
