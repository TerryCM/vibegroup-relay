export type PresenceState = 'available' | 'busy' | 'offline'
export interface PeerInfo { name: string; status?: string }
export interface Peer {
  peerId: string
  room: string
  info: PeerInfo
  state: PresenceState
  lastSeen: number
}

export class PresenceRegistry {
  private peers = new Map<string, Peer>()

  add(p: Peer): void { this.peers.set(p.peerId, p) }
  remove(peerId: string): void { this.peers.delete(peerId) }
  get(peerId: string): Peer | undefined { return this.peers.get(peerId) }

  touch(peerId: string, now: number): void {
    const p = this.peers.get(peerId)
    if (p) p.lastSeen = now
  }

  setState(peerId: string, state: PresenceState): void {
    const p = this.peers.get(peerId)
    if (p) p.state = state
  }

  list(room: string): Peer[] {
    return [...this.peers.values()].filter(p => p.room === room)
  }
}
