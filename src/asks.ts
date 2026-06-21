export type AskState = 'open' | 'delivered' | 'answered' | 'expired'

export interface Ask {
  qid: string
  room: string
  from: string
  to: string
  state: AskState
  createdAt: number
}

export class AskRegistry {
  private asks = new Map<string, Ask>()
  constructor(private ttlMs = 600_000) {}

  open(a: { qid: string; room: string; from: string; to: string }, now: number): 'opened' | 'duplicate' {
    if (this.asks.has(a.qid)) return 'duplicate'
    this.asks.set(a.qid, { ...a, state: 'open', createdAt: now })
    return 'opened'
  }

  markDelivered(qid: string): void {
    const ask = this.asks.get(qid)
    if (ask && ask.state === 'open') ask.state = 'delivered'
  }

  answer(qid: string, answerer: string, _now: number): Ask | undefined {
    const ask = this.asks.get(qid)
    if (!ask) return undefined
    if (ask.state !== 'open' && ask.state !== 'delivered') return undefined
    if (ask.to !== answerer) return undefined
    ask.state = 'answered'
    return ask
  }

  get(qid: string): Ask | undefined { return this.asks.get(qid) }

  sweep(now: number): void {
    for (const ask of this.asks.values()) {
      if ((ask.state === 'open' || ask.state === 'delivered') && now - ask.createdAt >= this.ttlMs) {
        ask.state = 'expired'
      }
    }
  }
}
