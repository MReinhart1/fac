// Creates a staff login, or resets the password of an existing one. Usage:
//   npm run staff:create -- --email owner@example.com --name "Pat Owner" --role owner
//   npm run staff:create -- --email instructor@example.com --name "Sam Instructor"
//   npm run staff:create -- --email someone@example.com --reset
// A random temporary password is printed once; share it privately and have the person change it.
// Set STAFF_PASSWORD to choose the password instead of generating one (at least 12 characters).
// On your computer it uses the test database (fac_test). The live site's logins are changed on the portal's Staff page,
// or, if no owner can sign in, by the "Live database" workflow on GitHub, which runs this script with STAFF_PASSWORD
// from the workflow's Password box (it never prints a password there: the repository's workflow logs are public).
import { randomBytes } from 'node:crypto'
import { parseArgs } from 'node:util'
import { createAuth, ROLES } from '../src/lib/auth-config.js'
import { onGitHubActions } from '../src/lib/databases.js'
import { getClient, getDb } from '../src/lib/mongo.js'
import { describeDatabase, scriptDatabase } from './database.mjs'

const MIN_LENGTH = 12
const { values } = parseArgs({
  options: {
    email: { type: 'string' },
    name: { type: 'string' },
    role: { type: 'string', default: 'instructor' },
    reset: { type: 'boolean', default: false },
  },
})
const usage = [
  'Usage:',
  '  npm run staff:create -- --email someone@example.com --name "Full Name" [--role owner|instructor]',
  '  npm run staff:create -- --email someone@example.com --reset',
].join('\n')
if (!values.email || (!values.reset && (!values.name || !['owner', 'instructor'].includes(values.role)))) {
  console.error(usage)
  process.exit(1)
}
if (onGitHubActions(process.env) && !process.env.STAFF_PASSWORD) {
  console.error('Type a password in the workflow\'s Password box: a generated one would be printed in the public log.')
  process.exit(1)
}
const password = process.env.STAFF_PASSWORD || randomBytes(12).toString('base64url')
if (password.length < MIN_LENGTH) {
  console.error(`STAFF_PASSWORD must be at least ${MIN_LENGTH} characters.`)
  process.exit(1)
}

const uri = process.env.MONGODB_URI
const dbName = scriptDatabase()
const client = getClient(uri)
const db = getDb(uri, dbName)
const auth = createAuth({
  db,
  client,
  // The script signs no sessions, so any secret works; the GitHub workflow does not need the site's real one.
  secret: process.env.BETTER_AUTH_SECRET || randomBytes(32).toString('base64'),
  baseURL: process.env.BETTER_AUTH_URL,
})
const email = values.email.trim().toLowerCase()
const where = describeDatabase(dbName)
const showPassword = () => {
  if (!process.env.STAFF_PASSWORD) console.log(`Temporary password (shown once): ${password}`)
}

/** Set a new password on an existing login and sign it out everywhere. Better Auth hashes it as it would at sign-up. */
async function resetPassword() {
  const ctx = await auth.$context
  const found = await ctx.internalAdapter.findUserByEmail(email)
  if (!found?.user) throw new Error(`There is no login for ${email} in ${where}.`)
  const { user } = found
  if (!(await ctx.internalAdapter.findCredentialAccount(user.id))) throw new Error(`${email} has no password login to reset.`)
  await ctx.internalAdapter.updatePassword(user.id, await ctx.password.hash(password))
  await ctx.internalAdapter.deleteUserSessions(user.id)
  console.log(`Reset the password for ${user.name} (${email}) in ${where}, and signed them out everywhere.`)
  showPassword()
}

async function createLogin() {
  await auth.api.createUser({ body: { email, name: values.name, password, role: ROLES[values.role] } })
  console.log(`Created ${values.role} login for ${email} in ${where}.`)
  showPassword()
}

try {
  if (values.reset) await resetPassword()
  else await createLogin()
} catch (error) {
  const message = error?.body?.message ?? error.message
  console.error(`Could not ${values.reset ? 'reset the password' : 'create the login'}: ${message}`)
  if (!values.reset && error?.body?.code?.startsWith('USER_ALREADY_EXISTS')) {
    console.error(`To set a new password for that login instead, add --reset (without --name and --role).`)
  }
  process.exitCode = 1
} finally {
  // Better Auth and its MongoDB adapter check and create their indexes in the background when they start. Give that a
  // moment to finish before disconnecting (as src/middleware.js does), or it reports a failed index on the closed
  // connection. Quick runs, such as a refused duplicate, would otherwise close too soon.
  const ctx = await auth.$context
  await Promise.resolve(ctx.checkSchema?.()).catch(() => {})
  await new Promise((resolve) => setTimeout(resolve, 2000))
  await client.close()
}
