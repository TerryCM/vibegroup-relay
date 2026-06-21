import { test, expect } from 'bun:test'
import { RoomStore } from '../src/rooms'

test('createRoom returns a room and token that verify', () => {
  const store = new RoomStore()
  const rec = store.createRoom()
  expect(rec.room).toMatch(/^rm_/)
  expect(store.verify(rec.room, rec.token)).toBe(true)
})

test('verify fails for a wrong token or unknown room', () => {
  const store = new RoomStore()
  const rec = store.createRoom()
  expect(store.verify(rec.room, 'wrong')).toBe(false)
  expect(store.verify('rm_missing', rec.token)).toBe(false)
})

test('rotate invalidates the old token and returns a new working one', () => {
  const store = new RoomStore()
  const rec = store.createRoom()
  const next = store.rotate(rec.room)
  expect(next).toBeDefined()
  expect(store.verify(rec.room, rec.token)).toBe(false)
  expect(store.verify(rec.room, next!)).toBe(true)
})

test('rotate returns undefined for an unknown room', () => {
  expect(new RoomStore().rotate('rm_missing')).toBeUndefined()
})
