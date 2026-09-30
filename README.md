# Case Unknown — Networked v0.1

A real-time browser multiplayer prototype for **Case Unknown: The Last Guest**.

## What works
- Create a private room and share a six-character room code.
- Join from different browsers/devices while they connect to the same deployed server.
- 2–6 human players.
- Optional AI fill to six seats.
- Server-side secret role assignment: Detective / Witness / Criminal.
- Server-owned evidence state and progressive evidence discovery.
- Real-time synchronized room state and live text discussion using Socket.IO.
- Detective-only final accusation.
- Server-scored case reveal.
- Responsive browser UI.

## Important prototype limitations
- Room state is stored in server memory. Restarting the server clears active rooms.
- AI fill has lightweight scripted discussion, not an LLM yet.
- There are no user accounts, database, matchmaking, moderation, payments, or persistent progression yet.
- Case #001 is the only case.
- Production launch should add authentication, a persistent database, rate limiting, moderation/reporting, observability, and stronger reconnect/session handling.

## Run locally
1. Install Node.js 18 or newer.
2. In this folder run:
   npm install
   npm start
3. Open http://localhost:3000
4. For same-network testing, open the computer's LAN IP with port 3000 from another device.

## Put it on a public URL
Deploy this folder to any Node.js host that supports WebSockets. Configure the service to run:
   npm install
   npm start

The server reads the host-provided `PORT` environment variable automatically.

For a commercial version, use a persistent database and a host with stable WebSocket support. A custom domain can then point at that deployment.

## Recommended v0.2
- PostgreSQL for accounts, rooms, case history, progression, and purchases.
- Redis for scalable real-time room presence/state.
- Authentication and reconnect tokens.
- AI agents with role-specific information boundaries.
- Lobby privacy controls and public matchmaking.
- Report/block/mute tools and chat moderation.
- Multiple handcrafted cases and a validated case schema.
- Spectator protection and anti-cheat logging.
- Cosmetics / premium case packs only after the core loop is proven.
