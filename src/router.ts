import { newMsgId, type Envelope } from '@vibegroup/protocol'
import type { PresenceRegistry } from './presence'
import type { AskRegistry } from './asks'
import type { OfflineQueue } from './queue'

export type RouteOutcome = { status: 'delivered' | 'queued' } | { error: string }

export interface RouterDeps {
  presence: PresenceRegistry
  asks: AskRegistry
  queue: OfflineQueue
  send: (peerId: string, env: Envelope) => boolean
  now: () => number
}

export interface Router {
  routeQuestion(from: string, env: Envelope): RouteOutcome
  routeAnswer(from: string, env: Envelope): RouteOutcome
}

export function createRouter(deps: RouterDeps): Router {
  const deliver = (to: string, env: Envelope): 'delivered' | 'queued' => {
    if (deps.send(to, env)) return 'delivered'
    deps.queue.enqueue(to, env, deps.now())
    return 'queued'
  }

  return {
    routeQuestion(from, env) {
      if (!env.to || !env.qid) return { error: 'missing_to_or_qid' }
      const asker = deps.presence.get(from)
      if (!asker) return { error: 'unknown_sender' }
      const opened = deps.asks.open({ qid: env.qid, room: asker.room, from, to: env.to }, deps.now())
      if (opened === 'duplicate') return { error: 'duplicate_qid' }

      const outbound: Envelope = { ...env, id: newMsgId(), from }
      const status = deliver(env.to, outbound)
      if (status === 'delivered') deps.asks.markDelivered(env.qid)
      return { status }
    },

    routeAnswer(from, env) {
      if (!env.to || !env.qid) return { error: 'missing_to_or_qid' }
      const ask = deps.asks.answer(env.qid, from, deps.now())
      if (!ask) return { error: 'no_open_ask' }
      const outbound: Envelope = { ...env, id: newMsgId(), from, to: ask.from }
      return { status: deliver(ask.from, outbound) }
    },
  }
}
