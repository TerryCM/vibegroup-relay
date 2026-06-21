import { test, expect, afterEach } from 'bun:test'
import { startRelay, type RelayHandle } from '../src/server'
import { serialize, parseEnvelope, newMsgId, newQid, type Envelope } from '@vibegroup/protocol'

let relay: RelayHandle | undefined
afterEach(() => { relay?.stop(); relay = undefined })

function connect(port: number) {
  const ws = new WebSocket(`ws://localhost:${port}/ws`)
  const inbox: Envelope[] = []
  const waiters: ((e: Envelope) => void)[] = []
  ws.addEventListener('message', (ev) => {
    const env = parseEnvelope(String(ev.data))
    const w = waiters.shift()
    if (w) w(env); else inbox.push(env)
  })
  const next = (): Promise<Envelope> =>
    new Promise((resolve) => { const q = inbox.shift(); if (q) resolve(q); else waiters.push(resolve) })
  const open = new Promise<void>((r) => ws.addEventListener('open', () => r()))
  const sendEnv = (e: Partial<Envelope> & Pick<Envelope, 'kind'>) =>
    ws.send(serialize({ v: 1, id: newMsgId(), ts: 0, ...e } as Envelope))
  return { ws, next, open, sendEnv }
}

type Conn = ReturnType<typeof connect>
async function until(c: Conn, kind: string): Promise<Envelope> {
  for (;;) { const e = await c.next(); if (e.kind === kind) return e }
}

async function newRoom(port: number) {
  const res = await fetch(`http://localhost:${port}/rooms`, { method: 'POST' })
  return res.json() as Promise<{ room: string; token: string }>
}

test('two peers complete a full ask -> answer loop', async () => {
  relay = startRelay({ port: 0, secret: 's' })
  const { room, token } = await newRoom(relay.port)

  const alice = connect(relay.port)
  const bob = connect(relay.port)
  await Promise.all([alice.open, bob.open])

  alice.sendEnv({ kind: 'join', body: { room, token, name: 'alice' } })
  bob.sendEnv({ kind: 'join', body: { room, token, name: 'bob' } })

  const aliceId = (await until(alice, 'joined')).from!
  const bobId = (await until(bob, 'joined')).from!

  const qid = newQid()
  alice.sendEnv({ kind: 'question', to: bobId, qid, body: { ciphertext: 'c', nonce: 'n' } })

  expect((await until(alice, 'ack')).body).toEqual({ outcome: { status: 'delivered' } })

  const bobQuestion = await until(bob, 'question')
  expect(bobQuestion.from).toBe(aliceId)            // authoritative sender
  expect(bobQuestion.qid).toBe(qid)
  expect((bobQuestion.body as { ciphertext: string }).ciphertext).toBe('c')

  bob.sendEnv({ kind: 'answer', to: aliceId, qid, body: { ciphertext: 'A', nonce: 'N' } })
  expect((await until(bob, 'ack')).body).toEqual({ outcome: { status: 'delivered' } })

  const aliceAnswer = await until(alice, 'answer')
  expect(aliceAnswer.qid).toBe(qid)
  expect(aliceAnswer.from).toBe(bobId)
  expect((aliceAnswer.body as { ciphertext: string }).ciphertext).toBe('A')
})

test('a question can NOT cross room boundaries', async () => {
  relay = startRelay({ port: 0, secret: 's' })
  const roomA = await newRoom(relay.port)
  const roomB = await newRoom(relay.port)

  const alice = connect(relay.port)   // room A
  const eve = connect(relay.port)     // room B
  await Promise.all([alice.open, eve.open])

  alice.sendEnv({ kind: 'join', body: { room: roomA.room, token: roomA.token, name: 'alice' } })
  eve.sendEnv({ kind: 'join', body: { room: roomB.room, token: roomB.token, name: 'eve' } })
  const aliceId = (await until(alice, 'joined')).from!
  const eveId = (await until(eve, 'joined')).from!
  expect(aliceId).not.toBe(eveId)

  // Alice (room A) tries to reach eve's peerId, which lives in room B.
  const qid = newQid()
  alice.sendEnv({ kind: 'question', to: eveId, qid, body: { ciphertext: 'c', nonce: 'n' } })

  // The relay must refuse — eve is not in alice's room — and eve must receive nothing.
  const ack = await until(alice, 'ack')
  expect(ack.body).toEqual({ outcome: { error: 'peer_not_in_room' } })

  // Drain eve's stream for a beat and assert no question ever crossed (she still gets
  // presence frames, so we must scan past those rather than peek a single message).
  const sawQuestion = await Promise.race([
    (async () => { for (;;) { if ((await eve.next()).kind === 'question') return true } })(),
    new Promise<boolean>((r) => setTimeout(() => r(false), 60)),
  ])
  expect(sawQuestion).toBe(false)
})

test('a question to an offline peer is queued and drained when it resumes', async () => {
  relay = startRelay({ port: 0, secret: 's' })
  const { room, token } = await newRoom(relay.port)

  const alice = connect(relay.port)
  await alice.open
  alice.sendEnv({ kind: 'join', body: { room, token, name: 'alice' } })
  const aliceId = (await until(alice, 'joined')).from!

  const bob = connect(relay.port)
  await bob.open
  bob.sendEnv({ kind: 'join', body: { room, token, name: 'bob' } })
  const bobJoined = await until(bob, 'joined')
  const bobId = bobJoined.from!
  const bobResume = bobJoined.resumeToken!
  bob.ws.close()
  await new Promise((r) => setTimeout(r, 50))

  const qid = newQid()
  alice.sendEnv({ kind: 'question', to: bobId, qid, body: { ciphertext: 'c', nonce: 'n' } })
  expect((await until(alice, 'ack')).body).toEqual({ outcome: { status: 'queued' } })

  // Bob reconnects, reclaiming his identity via the resume token, and drains the queue.
  const bob2 = connect(relay.port)
  await bob2.open
  bob2.sendEnv({ kind: 'join', resumeToken: bobResume, body: { room, token, name: 'bob' } })
  const reJoined = await until(bob2, 'joined')
  expect(reJoined.from).toBe(bobId)                 // same identity reclaimed

  const drained = await until(bob2, 'question')
  expect(drained.qid).toBe(qid)
  expect(drained.from).toBe(aliceId)
})
