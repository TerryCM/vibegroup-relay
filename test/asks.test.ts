import { test, expect } from 'bun:test'
import { AskRegistry } from '../src/asks'

const A = { qid: 'q_1', room: 'rm_1', from: 'p_asker', to: 'p_answerer' }

test('open then duplicate', () => {
  const r = new AskRegistry()
  expect(r.open(A, 0)).toBe('opened')
  expect(r.open(A, 0)).toBe('duplicate')
})

test('only the asked peer can answer, and only once', () => {
  const r = new AskRegistry()
  r.open(A, 0)
  expect(r.answer('q_1', 'p_someone_else', 1)).toBeUndefined()
  const ans = r.answer('q_1', 'p_answerer', 2)
  expect(ans?.state).toBe('answered')
  expect(r.answer('q_1', 'p_answerer', 3)).toBeUndefined()
})

test('answering an unknown qid returns undefined', () => {
  expect(new AskRegistry().answer('q_nope', 'p_answerer', 0)).toBeUndefined()
})

test('sweep expires asks past the TTL', () => {
  const r = new AskRegistry(1000)
  r.open(A, 0)
  r.sweep(1500)
  expect(r.get('q_1')?.state).toBe('expired')
  expect(r.answer('q_1', 'p_answerer', 1600)).toBeUndefined()
})
