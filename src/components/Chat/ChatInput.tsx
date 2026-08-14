import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { Button } from '../common/Button'

interface ChatInputProps {
  onSend: (text: string) => void
  disabled: boolean
  error?: string | null
}

export function ChatInput({ onSend, disabled, error }: ChatInputProps) {
  const [text, setText] = useState('')

  function submit() {
    if (disabled || !text.trim()) return
    onSend(text)
    setText('')
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    submit()
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <form className="chat-input" onSubmit={handleSubmit}>
      <textarea
        className="chat-input__field"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a message…"
        disabled={disabled}
        rows={1}
      />
      <Button variant="primary" type="submit" disabled={disabled || !text.trim()}>
        Send
      </Button>
      {error && <p className="chat-input__error">{error}</p>}
    </form>
  )
}
