# Clash of Legends — WebRTC Voice Signaling Server

Send: `npm install` then `npm start` (or just `npm install` + `node server.js` on Render).

| Item | Value |
|---|---|
| Build Command | `npm install` |
| Start Command | `node server.js` |
| Health Check | `/health` |

This is the PeerJS signaling relay for the P2P voice chat in the game. It only relays WebRTC offer/answer/ICE candidates between players in the same arena; the actual audio streams go peer-to-peer (STUN only, no TURN).