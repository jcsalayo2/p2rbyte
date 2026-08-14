import { QRCodeSVG } from 'qrcode.react'

interface QrCodeProps {
  value: string
  size?: number
}

export function QrCode({ value, size = 200 }: QrCodeProps) {
  return (
    <div className="qr-code">
      <QRCodeSVG
        value={value}
        size={size}
        bgColor="#0f1011"
        fgColor="#ffffff"
        level="M"
        includeMargin
      />
    </div>
  )
}
