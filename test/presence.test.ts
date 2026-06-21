import { test, expect } from 'bun:test'
import { PresenceRegistry, type Peer } from '../src/presence'

const peer = (id: string, room = 'rm_1'): Peer => ({
  peerId: id, room, info: { name: id }, state: 'available', lastSeen: 0,
})

test('lists only peers in the given room', () => {
  const r = new PresenceRegistry()
  r.add(peer('p_1', 'rm_1'))
  r.add(peer('p_2', 'rm_2'))
  expect(r.list('rm_1').map(p => p.peerId)).toEqual(['p_1'])
})

test('touch updates lastSeen; setState updates state', () => {
  const r = new PresenceRegistry()
  r.add(peer('p_1'))
  r.touch('p_1', 1234)
  r.setState('p_1', 'busy')
  const got = r.get('p_1')!
  expect(got.lastSeen).toBe(1234)
  expect(got.state).toBe('busy')
})

test('remove drops the peer', () => {
  const r = new PresenceRegistry()
  r.add(peer('p_1'))
  r.remove('p_1')
  expect(r.get('p_1')).toBeUndefined()
})
