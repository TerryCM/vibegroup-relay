import type { ServerWebSocket } from 'bun'
import { parseEnvelope, serialize, newMsgId, newPeerId, type Envelope } from '@vibegroup/protocol'
import { RoomStore } from './rooms'
import { createIdentity } from './identity'
import { PresenceRegistry } from './presence'
import { AskRegistry } from './asks'
import { OfflineQueue } from './queue'
import { createRouter } from './router'

export interface RelayConfig { port: number; secret: string }
export interface RelayHandle { port: number; rooms: RoomStore; stop(): void }

interface WsData { room?: string; peerId?: string }

export function startRelay(cfg: RelayConfig): RelayHandle {
  const rooms = new RoomStore()
  const identity = createIdentity(cfg.secret)
  const presence = new PresenceRegistry()
  const asks = new AskRegistry()
  const queue = new OfflineQueue()
  const conns = new Map<string, ServerWebSocket<WsData>>()
  const now = () => Date.now()

  const send = (peerId: string, env: Envelope): boolean => {
    const ws = conns.get(peerId)
    if (!ws) return false
    ws.send(serialize(env))
    return true
  }
  const router = createRouter({ presence, asks, queue, send, now })

  const mk = (kind: Envelope['kind'], extra: Partial<Envelope>): Envelope =>
    ({ v: 1, kind, id: newMsgId(), ts: now(), ...extra })

  const peerList = (room: string) =>
    presence.list(room).map(p => ({
      peerId: p.peerId, name: p.info.name, state: p.state, lastSeen: p.lastSeen, status: p.info.status,
    }))

  const broadcastPresence = (room: string) => {
    const peers = peerList(room)
    for (const p of presence.list(room)) send(p.peerId, mk('presence', { room, body: { peers } }))
  }

  const handleJoin = (ws: ServerWebSocket<WsData>, env: Envelope) => {
    const body = (env.body ?? {}) as { room?: string; token?: string; name?: string }
    const room = body.room ?? ''
    if (!rooms.verify(room, body.token ?? '')) {
      ws.send(serialize(mk('error', { body: { code: 'bad_room' } })))
      ws.close()
      return
    }
    let peerId = newPeerId()
    if (env.resumeToken) {
      const [claimedId, sig] = env.resumeToken.split('.')
      if (claimedId && sig && identity.verify(room, claimedId, sig)) peerId = claimedId
    }
    ws.data.room = room
    ws.data.peerId = peerId
    conns.set(peerId, ws)
    presence.add({ peerId, room, info: { name: body.name ?? peerId }, state: 'available', lastSeen: now() })

    const resumeToken = `${peerId}.${identity.sign(room, peerId)}`
    ws.send(serialize(mk('joined', { room, from: peerId, resumeToken, body: { peers: peerList(room) } })))

    for (const queued of queue.drain(peerId, now())) ws.send(serialize(queued))
    broadcastPresence(room)
  }

  const handleMessage = (ws: ServerWebSocket<WsData>, raw: string) => {
    let env: Envelope
    try { env = parseEnvelope(raw) } catch { ws.send(serialize(mk('error', { body: { code: 'bad_envelope' } }))); return }

    if (env.kind === 'join') return handleJoin(ws, env)

    const from = ws.data.peerId
    if (!from) { ws.send(serialize(mk('error', { body: { code: 'not_joined' } }))); return }
    presence.touch(from, now())

    switch (env.kind) {
      case 'question': {
        const outcome = router.routeQuestion(from, env)
        ws.send(serialize(mk('ack', { qid: env.qid, body: { outcome } })))
        return
      }
      case 'answer': {
        const outcome = router.routeAnswer(from, env)
        ws.send(serialize(mk('ack', { qid: env.qid, body: { outcome } })))
        return
      }
      case 'peers': {
        ws.send(serialize(mk('peers_result', { room: ws.data.room, body: { peers: peerList(ws.data.room!) } })))
        return
      }
      case 'ping': { ws.send(serialize(mk('pong', {}))); return }
      default: ws.send(serialize(mk('error', { body: { code: 'unsupported_kind' } })))
    }
  }

  const server = Bun.serve<WsData, {}>({
    port: cfg.port,
    fetch(req, srv) {
      const url = new URL(req.url)
      if (url.pathname === '/health') return new Response('ok')
      if (req.method === 'POST' && url.pathname === '/rooms') return Response.json(rooms.createRoom())
      if (url.pathname === '/ws') return srv.upgrade(req, { data: {} }) ? undefined : new Response('upgrade failed', { status: 400 })
      return new Response('not found', { status: 404 })
    },
    websocket: {
      message(ws, raw) { handleMessage(ws, typeof raw === 'string' ? raw : raw.toString()) },
      close(ws) {
        const pid = ws.data.peerId
        if (!pid) return
        conns.delete(pid)
        presence.setState(pid, 'offline')
        if (ws.data.room) broadcastPresence(ws.data.room)
      },
    },
  })

  return { port: server.port, rooms, stop: () => server.stop(true) }
}
