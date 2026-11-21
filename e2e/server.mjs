// Starts everything the end-to-end tests need, then stays running until stopped:
//   1. an in-memory MongoDB (a one-node replica set, because the site uses transactions)
//   2. a fake Resend API that records every email instead of sending it
//   3. the built site in Cloudflare's local runtime (`wrangler dev`), pointed at both
// Playwright starts this automatically (playwright.config.js). Run it by hand with `npm run test:e2e:server`
// to keep it up between test runs. Set E2E_SKIP_BUILD=1 to reuse the last `astro build`.
import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { MongoClient } from 'mongodb'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { createAuth, ROLES } from '../src/lib/auth-config.js'
import { ensureIndexes } from '../src/lib/mongo.js'
import { BASE_URL, E2E, MAIL_URL, MONGO_URI, OWNER_NOTIFY_EMAIL, STAFF } from './env.js'

const AUTH_SECRET = 'e2e-only-secret-not-for-production-use'
const log = (message) => console.log(`[e2e] ${message}`)

// 1. Database
const replSet = await MongoMemoryReplSet.create({
  replSet: { name: 'e2e', count: 1, storageEngine: 'wiredTiger' },
  instanceOpts: [{ port: E2E.dbPort, ip: '127.0.0.1' }],
})
const client = new MongoClient(MONGO_URI)
const db = client.db(E2E.dbName)
await ensureIndexes(db)
const auth = createAuth({ db, client, secret: AUTH_SECRET, baseURL: BASE_URL })
for (const person of Object.values(STAFF)) {
  await auth.api.createUser({ body: { email: person.email, name: person.name, password: person.password, role: ROLES[person.role] } })
}
log(`database ready at ${MONGO_URI}`)

// 2. Fake Resend: POST /emails records an email; GET /emails lists them; DELETE /emails clears them.
const sent = []
const mail = createServer(async (request, response) => {
  const reply = (status, body) => {
    response.writeHead(status, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify(body))
  }
  if (request.url !== '/emails') return reply(404, { message: 'Not found' })
  if (request.method === 'GET') return reply(200, sent)
  if (request.method === 'DELETE') {
    sent.length = 0
    return reply(200, { ok: true })
  }
  let body = ''
  for await (const chunk of request) body += chunk
  sent.push(JSON.parse(body))
  return reply(200, { id: `e2e_${sent.length}` })
})
await new Promise((resolve) => mail.listen(E2E.mailPort, '127.0.0.1', resolve))
log(`fake email service at ${MAIL_URL}`)

// 3. The site
if (!process.env.E2E_SKIP_BUILD) {
  log('building the site…')
  const build = spawnSync('npx', ['astro', 'build'], { stdio: 'inherit' })
  if (build.status !== 0) throw new Error('astro build failed')
}
const envFile = '.wrangler/e2e.env'
const stateDir = '.wrangler/e2e-state'
rmSync(stateDir, { recursive: true, force: true })
mkdirSync('.wrangler', { recursive: true })
writeFileSync(
  envFile,
  [
    `MONGODB_URI=${MONGO_URI}`,
    `MONGODB_DB=${E2E.dbName}`,
    `BETTER_AUTH_SECRET=${AUTH_SECRET}`,
    `BETTER_AUTH_URL=${BASE_URL}`,
    `CRON_SECRET=${E2E.cronSecret}`,
    'RESEND_API_KEY=re_e2e_fake',
    `RESEND_API_URL=${MAIL_URL}`,
    'EMAIL_FROM=Firearms Academy Canada <bookings@e2e.test>',
    `OWNER_NOTIFY_EMAIL=${OWNER_NOTIFY_EMAIL}`,
    '',
  ].join('\n'),
)
const site = spawn(
  'npx',
  ['wrangler', 'dev', '--local', '--ip', '127.0.0.1', '--port', String(E2E.sitePort), '--env-file', envFile, '--persist-to', stateDir],
  { stdio: 'inherit' },
)
log(`site starting at ${BASE_URL}`)

let stopping = false
async function stop() {
  if (stopping) return
  stopping = true
  site.kill('SIGTERM')
  mail.close()
  await client.close().catch(() => {})
  await replSet.stop().catch(() => {})
  process.exit(0)
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
site.on('exit', (code) => {
  if (!stopping) {
    log(`site stopped unexpectedly (exit ${code})`)
    stop()
  }
})
