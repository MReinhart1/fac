// Creates a staff login. Usage:
//   npm run staff:create -- --email owner@example.com --name "Pat Owner" --role owner
//   npm run staff:create -- --email instructor@example.com --name "Sam Instructor"
// A random temporary password is printed once; share it privately and have the person change it.
// Set STAFF_PASSWORD to choose the password instead of generating one.
import { randomBytes } from 'node:crypto'
import { parseArgs } from 'node:util'
import { createAuth, ROLES } from '../src/lib/auth-config.js'
import { getClient, getDb } from '../src/lib/mongo.js'

const { values } = parseArgs({
  options: { email: { type: 'string' }, name: { type: 'string' }, role: { type: 'string', default: 'instructor' } },
})
if (!values.email || !values.name || !['owner', 'instructor'].includes(values.role)) {
  console.error('Usage: npm run staff:create -- --email someone@example.com --name "Full Name" [--role owner|instructor]')
  process.exit(1)
}

const uri = process.env.MONGODB_URI
const client = getClient(uri)
const db = getDb(uri, process.env.MONGODB_DB || 'fac')
const auth = createAuth({
  db,
  client,
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
})
const password = process.env.STAFF_PASSWORD || randomBytes(12).toString('base64url')

try {
  await auth.api.createUser({ body: { email: values.email, name: values.name, password, role: ROLES[values.role] } })
  console.log(`Created ${values.role} login for ${values.email}.`)
  if (!process.env.STAFF_PASSWORD) console.log(`Temporary password (shown once): ${password}`)
} catch (error) {
  console.error('Could not create the login:', error?.body?.message ?? error.message)
  process.exitCode = 1
} finally {
  // Better Auth builds its indexes in the background on first use; let that finish before disconnecting.
  const hasUserIdIndex = async (name) =>
    (await db.collection(name).listIndexes().toArray().catch(() => [])).some((index) => 'userId' in index.key)
  for (let i = 0; i < 20; i += 1) {
    if ((await hasUserIdIndex('account')) && (await hasUserIdIndex('session'))) break
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  await client.close()
}
