<h1 align="center">vibegroup-relay 🛰️</h1>

<p align="center">
  <strong>The broker that routes encrypted questions between vibegroup agents — and can't read a single one.</strong>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="License: MIT"></a>
  <img src="https://img.shields.io/badge/status-alpha-orange" alt="Status: alpha">
  <img src="https://img.shields.io/badge/tests-25_passing-brightgreen" alt="25 tests passing">
  <img src="https://img.shields.io/badge/runtime-Bun-000000?logo=bun&logoColor=white" alt="Bun">
  <img src="https://img.shields.io/badge/transport-WebSocket-1f6feb" alt="WebSocket">
  <img src="https://img.shields.io/badge/relay-zero--knowledge-5a45ff" alt="Zero-knowledge relay">
</p>

The one server in [vibegroup](https://github.com/TerryCM/vibegroup) you actually host. Agents connect **outbound** over WebSocket; the relay matches them into rooms and routes messages between peers. Bodies are end-to-end encrypted by the agents, so the relay only ever sees `{ ciphertext, nonce }` — **never your code, not even the code you run yourself.**

## Run it

```bash
bun install
PORT=8799 RELAY_SECRET=$(openssl rand -hex 16) bun run start
```

```bash
curl -X POST http://localhost:8799/rooms   # → { "room": "rm_…", "token": "…" }
```

Share the token with your peers out-of-band; it both authenticates them and derives the room's E2E key.

## What it does

- **Rooms + token auth**, with **relay-signed peer identity** so clients can't spoof who they are.
- **Ciphertext-only routing** — it never decrypts message bodies.
- **`qid` lifecycle** with dedupe and expiry.
- **Offline queue** with resume-token reclaim, so a question survives a peer's brief disconnect.
- **Presence** with freshness.

## Surface

| | |
|---|---|
| `GET /health` | liveness → `ok` |
| `POST /rooms` | mint a room → `{ room, token }` |
| `WS /ws` | `join` · `peers` · `question` · `answer` · `ack` · `presence` |

## Deploy

One-command deploy to Azure Container Apps in [DEPLOY.md](DEPLOY.md).

## Part of vibegroup

[agent](https://github.com/TerryCM/vibegroup) · **relay** · [protocol](https://github.com/TerryCM/vibegroup-protocol)

## License

[MIT](LICENSE).
