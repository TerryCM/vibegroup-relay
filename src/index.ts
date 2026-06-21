import { startRelay } from './server'

const port = Number(process.env.PORT ?? 8799)
const secret = process.env.RELAY_SECRET ?? 'dev-secret-change-me'
const handle = startRelay({ port, secret })
console.log(`vibegroup relay listening on :${handle.port}`)
