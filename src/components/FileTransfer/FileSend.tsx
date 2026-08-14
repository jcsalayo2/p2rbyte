import { useRef, type ChangeEvent } from 'react'
import { Button } from '../common/Button'

interface FileSendProps {
  onSend: (file: File) => void
  disabled: boolean
  error?: string | null
}

export function FileSend({ onSend, disabled, error }: FileSendProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) onSend(file)
    e.target.value = ''
  }

  return (
    <div className="file-send">
      <input
        ref={inputRef}
        type="file"
        className="file-send__input"
        onChange={handleChange}
        disabled={disabled}
        aria-hidden
        tabIndex={-1}
      />
      <Button
        variant="ghost"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        Send file
      </Button>
      {error && <p className="file-send__error">{error}</p>}
    </div>
  )
}
