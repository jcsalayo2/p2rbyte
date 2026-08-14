# P2RBYTE

Peer-to-peer chat and file transfer in the browser. No accounts, no login, no cloud upload — devices connect directly via WebRTC.

**Live:** [p2rbyte.web.app](https://p2rbyte.web.app)

## Features

| Status | Feature |
|--------|---------|
| Done | Anonymous session create/join (link, QR code, or 6-char code) |
| Done | Firebase Realtime Database signaling only (SDP + ICE) |
| Done | WebRTC DataChannel P2P connection |
| Done | P2P text chat (in-memory, not stored on server) |
| Done | Small file transfer (up to 5 MB, files sidebar) |
| Planned | Chunked large files, backpressure, progressive storage |

## How it works

```
Firebase RTDB          WebRTC DataChannel
(signaling only)       (chat & files)
      │                       │
 Device A ═══════════════════ Device B
              direct P2P
```

1. **Creator** starts a session and shares a link or QR code.
2. **Joiner** opens the link or enters the session code.
3. Signaling (offer, answer, ICE candidates) flows through Firebase RTDB.
4. Once connected, RTDB room data is deleted. Chat travels over the DataChannel only.

Firebase is never used for message content after the P2P link is up.

## Tech stack

- React 19 + TypeScript + Vite
- WebRTC (`RTCPeerConnection`, `RTCDataChannel`)
- Firebase Realtime Database (signaling)
- Firebase Hosting
- React Router

**Not used:** Firestore, Cloud Functions, Firebase Storage, Firebase Auth.

## Getting started

### Prerequisites

- Node.js 18+
- Firebase CLI (`npx firebase-tools@latest`)
- A Firebase project with **Realtime Database** and **Hosting** enabled

### Install

```bash
npm install
```

### Environment

Copy `.env.example` to `.env` and fill in values from your Firebase web app config:

```bash
cp .env.example .env
```

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=p2rbyte.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://p2rbyte-default-rtdb.asia-southeast1.firebasedatabase.app
VITE_FIREBASE_PROJECT_ID=p2rbyte
VITE_FIREBASE_APP_ID=
VITE_APP_URL=https://p2rbyte.web.app
```

Fetch SDK config:

```bash
npx -y firebase-tools@latest apps:sdkconfig WEB <APP_ID> --project p2rbyte
```

### Develop

```bash
npm run dev
```

Open two browser tabs (or two devices) to test create + join + chat.

### Build

```bash
npm run build
npm run preview
```

### Deploy

```bash
npm run build
npx -y firebase-tools@latest deploy --only hosting,database --project p2rbyte
```

## Project structure

```
src/
├── components/
│   ├── Chat/           Chat UI (Phase 2)
│   ├── Connection/     Session share, status, connected layout
│   └── common/         Button, Badge, Card
├── hooks/
│   ├── usePeerSession.ts   WebRTC + signaling orchestration
│   └── useChat.ts          P2P chat over DataChannel
├── services/
│   ├── firebase/       RTDB signaling
│   ├── webrtc/         Peer connection, ICE, data channel
│   └── chat/           Chat wire protocol
├── pages/              Home, CreateSession, JoinSession
└── types/
```

## Privacy

- No user accounts or login
- Chat messages are not written to Firebase or any backend
- Signaling data (SDP/ICE) is removed from RTDB after connect
- Sessions expire after 30 minutes if unused (client-side cleanup)

## Roadmap

1. **Phase 1** — Rooms, signaling, WebRTC connect
2. **Phase 2** — P2P chat
3. **Phase 3** — Small file transfer (5 MB cap, files sidebar)
4. **Phase 4–7** — Chunked transfer, backpressure, large-file storage, transfer UX
5. **Phase 8** — STUN/TURN verification across networks

## License

Private project.
