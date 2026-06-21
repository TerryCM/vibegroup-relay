import type { Envelope } from '@vibegroup/protocol'

interface Entry { env: Envelope; expiresAt: number; key: string }

export class OfflineQueue {
  private q = new Map<string, Entry[]>()
  constructor(private maxPerPeer = 50, private ttlMs = 300_000) {}

  enqueue(peerId: string, env: Envelope, now: number): void {
    const key = `${env.kind}:${env.qid ?? env.id}`
    const list = this.q.get(peerId) ?? []
    if (list.some(e => e.key === key)) return
    list.push({ env, expiresAt: now + this.ttlMs, key })
    while (list.length > this.maxPerPeer) list.shift()
    this.q.set(peerId, list)
  }

  drain(peerId: string, now: number): Envelope[] {
    const list = this.q.get(peerId) ?? []
    this.q.delete(peerId)
    return list.filter(e => e.expiresAt > now).map(e => e.env)
  }
}
