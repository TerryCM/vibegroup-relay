import { test, expect } from 'bun:test'
import { createRouter } from '../src/router'
import { PresenceRegistry, type Peer } from '../src/presence'
import { AskRegistry } from '../src/asks'
import { OfflineQueue } from '../src/queue'
import type { Envelope } from '@vibegroup/protocol'

const peer = (id: string): Peer => ({ peerId: id, room: 'rm_1', info: { name: id }, state: 'available', lastSeen: 0 })

function harness(online: string[]) {
  const presence = new PresenceRegistry()
  presence.add(peer('p_asker'))
  presence.add(peer('p_answerer'))
  const asks = new AskRegistry()
  const queue = new OfflineQueue()
  const sent: { to: string; env: Envelope }[] = []
  const send = (to: string, env: Envelope) => {
    if (!online.includes(to)) return false
    sent.push({ to, env }); return true
  }
  const router = createRouter({ presence, asks, queue, send, now: () => 0 })
  return { router, asks, queue, sent }
}

const question: Envelope = {
  v: 1, kind: 'question', id: 'm_1', ts: 0, to: 'p_answerer', qid: 'q_1',
  body: { ciphertext: 'x', nonce: 'y' },
}

test('routeQuestion delivers to an online peer and stamps authoritative from', () => {
  const h = harness(['p_answerer'])
  const out = h.router.routeQuestion('p_asker', question)
  expect(out).toEqual({ status: 'delivered' })
  expect(h.sent[0].to).toBe('p_answerer')
  expect(h.sent[0].env.from).toBe('p_asker')      // stamped, not client-supplied
  expect(h.asks.get('q_1')?.state).toBe('delivered')
})

test('routeQuestion queues for an offline peer', () => {
  const h = harness([])
  expect(h.router.routeQuestion('p_asker', question)).toEqual({ status: 'queued' })
  expect(h.queue.drain('p_answerer', 0).map(e => e.qid)).toEqual(['q_1'])
})

test('routeQuestion rejects a duplicate qid', () => {
  const h = harness(['p_answerer'])
  h.router.routeQuestion('p_asker', question)
  expect(h.router.routeQuestion('p_asker', question)).toEqual({ error: 'duplicate_qid' })
})

test('routeAnswer delivers back to the original asker', () => {
  const h = harness(['p_answerer', 'p_asker'])
  h.router.routeQuestion('p_asker', question)
  const answer: Envelope = { v: 1, kind: 'answer', id: 'm_2', ts: 0, to: 'p_asker', qid: 'q_1', body: { ciphertext: 'a', nonce: 'b' } }
  expect(h.router.routeAnswer('p_answerer', answer)).toEqual({ status: 'delivered' })
  expect(h.sent.at(-1)!.env.from).toBe('p_answerer')
  expect(h.asks.get('q_1')?.state).toBe('answered')
})

test('routeAnswer rejects an answer with no open ask', () => {
  const h = harness(['p_asker'])
  const answer: Envelope = { v: 1, kind: 'answer', id: 'm_2', ts: 0, to: 'p_asker', qid: 'q_unknown', body: { ciphertext: 'a', nonce: 'b' } }
  expect(h.router.routeAnswer('p_answerer', answer)).toEqual({ error: 'no_open_ask' })
})
