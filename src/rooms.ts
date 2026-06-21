import { randomBytes } from 'node:crypto'
import { newId } from '@vibegroup/protocol'

export interface RoomRecord { room: string; token: string }

export class RoomStore {
  private tokens = new Map<string, string>()

  createRoom(): RoomRecord {
    const room = newId('rm')
    const token = randomBytes(24).toString('base64url')
    this.tokens.set(room, token)
    return { room, token }
  }

  verify(room: string, token: string): boolean {
    const t = this.tokens.get(room)
    return t !== undefined && t === token
  }

  rotate(room: string): string | undefined {
    if (!this.tokens.has(room)) return undefined
    const token = randomBytes(24).toString('base64url')
    this.tokens.set(room, token)
    return token
  }

  has(room: string): boolean {
    return this.tokens.has(room)
  }

  seed(room: string, token: string): void {
    this.tokens.set(room, token)
  }
}
