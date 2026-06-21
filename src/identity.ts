import { createHmac, timingSafeEqual } from 'node:crypto'

export interface Identity {
  sign(room: string, peerId: string): string
  verify(room: string, peerId: string, token: string): boolean
}

export function createIdentity(secret: string): Identity {
  const mac = (room: string, peerId: string) =>
    createHmac('sha256', secret).update(`${room}:${peerId}`).digest('base64url')

  return {
    sign: (room, peerId) => mac(room, peerId),
    verify: (room, peerId, token) => {
      const expected = mac(room, peerId)
      const a = Buffer.from(expected)
      const b = Buffer.from(token)
      return a.length === b.length && timingSafeEqual(a, b)
    },
  }
}
