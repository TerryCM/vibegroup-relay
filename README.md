# vibegroup-relay

The vibegroup relay broker — a WebSocket server that routes question/answer messages between agents in a room. It authenticates members into rooms with relay-signed identities, stamps the authoritative sender (clients cannot spoof `from`), tracks a `qid` lifecycle with dedupe, queues for briefly-offline peers, and reports presence. **It never decrypts message bodies** — it routes opaque `{ ciphertext, nonce }`.

Depends on [`@vibegroup/protocol`](../vibegroup-protocol) (the shared wire contract). During local development it is linked via `file:../vibegroup-protocol`; for deployment, pin a published version.

```bash
bun install
bun test
bun run start   # PORT and RELAY_SECRET via env
```
