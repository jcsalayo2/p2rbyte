import { useNavigate } from 'react-router-dom'
import { Button } from '../components/common/Button'
import { JoinForm } from '../components/Connection/JoinForm'
import { generateRoomId } from '../utils/roomId'

export function Home() {
  const navigate = useNavigate()

  function createSession(mode: 'link' | 'qr') {
    const roomId = generateRoomId()
    navigate(`/create/${roomId}?mode=${mode}`)
  }

  return (
    <div className="page">
      <header className="page__header">
        <h1 className="wordmark">P2RBYTE</h1>
        <p className="tagline">
          No accounts. No cloud upload. Direct peer-to-peer in your browser.
        </p>
      </header>

      <section className="page__section">
        <h2 className="section-title">Start a session</h2>
        <div className="action-row">
          <Button variant="primary" onClick={() => createSession('link')}>
            Generate link
          </Button>
          <Button variant="ghost" onClick={() => createSession('qr')}>
            Generate QR
          </Button>
        </div>
      </section>

      <section className="page__section">
        <JoinForm />
      </section>
    </div>
  )
}
