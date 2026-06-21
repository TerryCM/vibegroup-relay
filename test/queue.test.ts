import { test, expect } from 'bun:test'
import { OfflineQueue } from '../src/queue'
import type { Envelope } from '@vibegroup/protocol'

const q = (qid: string): Envelope => ({
  v: 1, kind: 'question', id: 'm_' + qid, ts: 0, to: 'p_1', qid,
  body: { ciphertext: 'x', nonce: 'y' },
})

test('enqueue then drain returns FIFO and clears', () => {
  const oq = new OfflineQueue()
  oq.enqueue('p_1', q('q_1'), 0)
  oq.enqueue('p_1', q('q_2'), 0)
  expect(oq.drain('p_1', 0).map(e => e.qid)).toEqual(['q_1', 'q_2'])
  expect(oq.drain('p_1', 0)).toEqual([])
})

test('enqueue is idempotent on (kind, qid)', () => {
  const oq = new OfflineQueue()
  oq.enqueue('p_1', q('q_1'), 0)
  oq.enqueue('p_1', q('q_1'), 0)
  expect(oq.drain('p_1', 0).length).toBe(1)
})

test('drain drops expired entries', () => {
  const oq = new OfflineQueue(50, 1000)
  oq.enqueue('p_1', q('q_1'), 0)
  expect(oq.drain('p_1', 2000)).toEqual([])
})

test('over-cap evicts the oldest', () => {
  const oq = new OfflineQueue(2, 100000)
  oq.enqueue('p_1', q('q_1'), 0)
  oq.enqueue('p_1', q('q_2'), 0)
  oq.enqueue('p_1', q('q_3'), 0)
  expect(oq.drain('p_1', 0).map(e => e.qid)).toEqual(['q_2', 'q_3'])
})
