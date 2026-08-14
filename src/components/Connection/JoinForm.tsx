import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../common/Button'
import { isValidRoomId } from '../../utils/roomId'

export function JoinForm() {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const normalized = code.trim().toUpperCase()
    if (!isValidRoomId(normalized)) {
      setError('Enter a valid 6-character code')
      return
    }
    navigate(`/join/${normalized}`)
  }

  return (
    <form className="join-form" onSubmit={handleSubmit}>
      <label className="join-form__label" htmlFor="room-code">
        Join with code
      </label>
      <div className="join-form__row">
        <input
          id="room-code"
          className="input"
          type="text"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase())
            setError('')
          }}
          placeholder="ABC123"
          maxLength={6}
          autoComplete="off"
          spellCheck={false}
        />
        <Button variant="ghost" type="submit">
          Join
        </Button>
      </div>
      {error && <p className="join-form__error">{error}</p>}
    </form>
  )
}
