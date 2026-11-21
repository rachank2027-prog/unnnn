# THE UNCHOSEN — Multiplayer mobile game

A mobile-first, browser-based multiplayer narrative game for up to 100 players in one room. Players join by QR code or room code; no app installation is needed.

## Features in this build
- Host-created six-character rooms and live QR join code
- Up to 100 simultaneous players per room
- Live lobby and player list
- Four story chapters based on the supplied *The Kingdom of Aster / The Unchosen* narrative
- 30-second voting rounds, live vote counts and majority outcomes
- Previous decisions are recorded and influence the ending
- Three ending routes: Hero Triumphs, Unchosen Triumphs, and Reconciliation
- Responsive mobile interface, cinematic fantasy styling, procedural UI sound cues and a low ambient drone
- Server-authoritative room state using Socket.IO

## Run locally
Requires Node.js 18+.

```bash
npm install
npm start
```

Open `http://localhost:3000` on the host computer. For phones on the same Wi-Fi, use the computer's LAN IP and port 3000. The QR code uses the server's public URL when deployed; set `PUBLIC_URL=https://your-domain.example` in production if needed.

## Deploy later
This project is ready for a Node hosting service that supports WebSockets (for example, Render, Railway, Fly.io, or a VPS). Set the start command to `npm start`, Node version 18+, and set `PUBLIC_URL` to the final HTTPS address. Use a persistent single server instance for the first release: rooms currently live in server memory and are not shared across multiple instances. A restart clears active rooms.

## Notes / next production steps
- This is a working MVP, not a finished commercial game. Art is currently CSS-generated; replace the scene art with commissioned/created background assets and add licensed music/SFX for a richer release.
- The game currently uses a 30-second round timer. The host advances between chapters; players cannot skip a round.
- The final outcome logic is a first playable interpretation of the source story and can be tuned with the game owner.
- Add moderation, reconnect/resume, persistent analytics, load testing, rate limiting, and a multi-instance room store (e.g. Redis adapter) before a public large-scale launch.
- The 100-player cap is enforced per room. Actual capacity should be load-tested on the selected hosting plan.
