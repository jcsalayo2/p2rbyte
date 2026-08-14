import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Home } from './pages/Home'
import { CreateSession } from './pages/CreateSession'
import { JoinSession } from './pages/JoinSession'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/create/:roomId" element={<CreateSession />} />
        <Route path="/join/:roomId" element={<JoinSession />} />
      </Routes>
    </BrowserRouter>
  )
}
