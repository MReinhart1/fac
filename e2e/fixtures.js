// Shared test setup. Import `test` and `expect` from here instead of '@playwright/test'.
//
// Before every test the database is reset to four known course weekends (ids stay the same between tests,
// so pages the site caches for a minute still point at real weekends), and the fake email inbox is emptied.
import { test as base, expect } from '@playwright/test'
import { MongoClient, ObjectId } from 'mongodb'
import { addDaysTo, isSaturday, todayInToronto, weekendParts } from '../src/data/dates.js'
import { E2E, MAIL_URL, MONGO_URI, STAFF } from './env.js'

/** The first Saturday at least `daysAhead` days from today. */
function saturdayAfter(daysAhead) {
  let date = addDaysTo(todayInToronto(), daysAhead)
  while (!isSaturday(date)) date = addDaysTo(date, 1)
  return date
}

// Far enough ahead that no class reminder or instructor class list is ever due during a test.
const WEEKENDS = {
  open: { startDate: saturdayAfter(21), capacity: 20, status: 'open' },
  later: { startDate: saturdayAfter(35), capacity: 20, status: 'open' },
  small: { startDate: saturdayAfter(49), capacity: 1, status: 'open' },
  closed: { startDate: saturdayAfter(63), capacity: 20, status: 'closed' },
}

// Staff logins a test added are removed, and the two standard ones are put back as they started (role, access).
async function resetStaff(db) {
  const keepEmails = Object.values(STAFF).map((person) => person.email)
  const extra = await db.collection('user').find({ email: { $nin: keepEmails } }, { projection: { _id: 1 } }).toArray()
  if (extra.length) {
    const ids = extra.map((user) => user._id)
    await db.collection('user').deleteMany({ _id: { $in: ids } })
    await db.collection('account').deleteMany({ userId: { $in: ids } })
    await db.collection('session').deleteMany({ userId: { $in: ids } })
  }
  for (const person of Object.values(STAFF)) {
    await db.collection('user').updateOne(
      { email: person.email },
      { $set: { role: person.role === 'owner' ? 'admin' : 'user', banned: false }, $unset: { banReason: '', banExpires: '' } },
    )
  }
}

async function resetDatabase(db) {
  await Promise.all(['registrations', 'messages', 'emailLog', 'auditLog'].map((name) => db.collection(name).deleteMany({})))
  await resetStaff(db)
  const sessions = db.collection('courseSessions')
  const keep = Object.values(WEEKENDS).map((w) => w.startDate)
  await sessions.deleteMany({ startDate: { $nin: keep } })
  const now = new Date()
  const weekends = {}
  for (const [key, weekend] of Object.entries(WEEKENDS)) {
    const doc = await sessions.findOneAndUpdate(
      { startDate: weekend.startDate },
      {
        $set: { capacity: weekend.capacity, status: weekend.status, seatsTaken: 0, instructorIds: [], notes: '', updatedAt: now },
        $unset: { rosterSentAt: '' },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true, returnDocument: 'after' },
    )
    weekends[key] = { id: doc._id.toString(), startDate: doc.startDate, label: weekendParts(doc.startDate).label }
  }
  return weekends
}

/** A valid registration body for POST /api/register. */
export const registrationBody = (weekend, overrides = {}) => ({
  firstName: 'Pat',
  familyName: 'Tester',
  phone: '416-555-0100',
  email: 'pat@example.test',
  confirmEmail: 'pat@example.test',
  courseId: 'cfsc',
  courseSessionId: weekend.id,
  agree: 'on',
  ...overrides,
})

export const test = base.extend({
  // One database connection per Playwright worker.
  db: [
    // oxlint-disable-next-line no-empty-pattern -- Playwright fixtures must destructure their first argument.
    async ({}, provide) => {
      const client = new MongoClient(MONGO_URI)
      await provide(client.db(E2E.dbName))
      await client.close()
    },
    { scope: 'worker' },
  ],

  // Runs before every test, even when the test does not ask for it.
  weekends: [
    async ({ db }, provide) => {
      await fetch(`${MAIL_URL}/emails`, { method: 'DELETE' })
      await provide(await resetDatabase(db))
    },
    { auto: true },
  ],

  /** Emails the site has "sent" (recorded by the fake Resend service). */
  // oxlint-disable-next-line no-empty-pattern
  emails: async ({}, provide) => {
    await provide(async () => (await fetch(`${MAIL_URL}/emails`)).json())
  },

  /** Register through the API, as the form does. Returns the server's reply. */
  register: async ({ request }, provide) => {
    await provide(async (weekend, overrides) => {
      const response = await request.post('/api/register', { data: registrationBody(weekend, overrides) })
      expect(response.status(), await response.text()).toBe(201)
      return response.json()
    })
  },

  /** Sign in to the staff portal as 'owner' or 'instructor'. */
  signIn: async ({ page }, provide) => {
    await provide(async (who = 'owner') => {
      const person = STAFF[who]
      await page.goto('/admin/login')
      await page.getByLabel('Email').fill(person.email)
      await page.getByLabel('Password').fill(person.password)
      await page.getByRole('button', { name: 'Sign in' }).click()
      await expect(page).toHaveURL(/\/admin$/)
    })
  },
})

/** Wait until the page's React forms are interactive (Astro removes `ssr` from an island once it hydrates). */
export async function waitForForms(page) {
  await expect(page.locator('astro-island[ssr]')).toHaveCount(0)
}

/** A staff member's user id, for assigning instructors. */
export async function staffId(db, who) {
  const user = await db.collection('user').findOne({ email: STAFF[who].email })
  return user._id.toString()
}

export { expect, ObjectId }
