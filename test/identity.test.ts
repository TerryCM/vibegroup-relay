import { test, expect } from 'bun:test'
import { createIdentity } from '../src/identity'

test('a token signed for (room, peer) verifies', () => {
  const id = createIdentity('relay-secret')
  const token = id.sign('rm_1', 'p_1')
  expect(id.verify('rm_1', 'p_1', token)).toBe(true)
})

test('a token does not verify for a different peer or room', () => {
  const id = createIdentity('relay-secret')
  const token = id.sign('rm_1', 'p_1')
  expect(id.verify('rm_1', 'p_2', token)).toBe(false)
  expect(id.verify('rm_2', 'p_1', token)).toBe(false)
})

test('a token does not verify under a different secret', () => {
  const token = createIdentity('secret-a').sign('rm_1', 'p_1')
  expect(createIdentity('secret-b').verify('rm_1', 'p_1', token)).toBe(false)
})
