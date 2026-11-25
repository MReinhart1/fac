// Fills the TEST database with realistic sample data, so every screen of the site and staff portal has something to show.
// Usage: npm run db:seed-test   (uses MONGODB_URI from .env, and MONGODB_DB or fac_test)
//
// It wipes and refills the test database's weekends, registrations, messages, email log and audit log, and creates
// three test staff logins (listed in TEST_STAFF below). Dates are relative to today, so the data always looks current.
// It refuses to run against the live database ("fac").
import { ObjectId } from 'mongodb'
import { findPackage, GUIDE_PRICE } from '../src/data/courses.js'
import { addDaysTo, isSaturday, todayInToronto } from '../src/data/dates.js'
import { createAuth, ROLES } from '../src/lib/auth-config.js'
import { ensureIndexes, getClient, getDb } from '../src/lib/mongo.js'
import { makePaymentReference } from '../src/lib/paymentReference.js'
import { scriptDatabase } from './database.mjs'

const uri = process.env.MONGODB_URI
const dbName = scriptDatabase()
// Never the live database, even on GitHub: only a database whose name contains "test".
if (!/test/i.test(dbName)) {
  console.error(`Refusing to seed "${dbName}": this script only fills a test database (a name containing "test").`)
  process.exit(1)
}

// Test-only logins for the test database. Never use these on the live site.
export const TEST_STAFF = [
  { email: 'owner@fac.test', name: 'Olive Owner', password: 'test-owner-password', role: 'owner' },
  { email: 'ian@fac.test', name: 'Ian Instructor', password: 'test-ian-password', role: 'instructor' },
  { email: 'ivy@fac.test', name: 'Ivy Instructor', password: 'test-ivy-password', role: 'instructor' },
]

const client = getClient(uri)
const db = getDb(uri, dbName)
const today = todayInToronto()
const daysFromToday = (days) => addDaysTo(today, days)
const at = (days, hour = 10) => new Date(`${daysFromToday(days)}T${String(hour).padStart(2, '0')}:00:00-05:00`)
/** The first Saturday on or after `days` from today. */
const saturdayIn = (days) => {
  let date = daysFromToday(days)
  while (!isSaturday(date)) date = addDaysTo(date, 1)
  return date
}

// ---------- Staff ----------

async function ensureStaff() {
  const auth = createAuth({ db, client, secret: process.env.BETTER_AUTH_SECRET, baseURL: process.env.BETTER_AUTH_URL })
  const ids = {}
  for (const person of TEST_STAFF) {
    let user = await db.collection('user').findOne({ email: person.email })
    if (!user) {
      await auth.api.createUser({ body: { email: person.email, name: person.name, password: person.password, role: ROLES[person.role] } })
      user = await db.collection('user').findOne({ email: person.email })
    }
    ids[person.email] = user._id.toString()
  }
  return ids
}

// ---------- Sample people ----------

const PEOPLE = [
  ['Liam', 'Tremblay'], ['Olivia', 'Gagnon'], ['Noah', 'Roy'], ['Emma', 'Côté'], ['Lucas', 'Bouchard'], ['Charlotte', 'Gauthier'],
  ['Ethan', 'Morin'], ['Amelia', 'Lavoie'], ['Benjamin', 'Fortin'], ['Ava', 'Gagné'], ['Jack', 'Ouellet'], ['Sophia', 'Pelletier'],
  ['William', 'Bélanger'], ['Mia', 'Lévesque'], ['James', 'Bergeron'], ['Chloe', 'Leblanc'], ['Logan', 'Paquette'], ['Ella', 'Girard'],
  ['Owen', 'Simard'], ['Grace', 'Boucher'], ['Leo', 'Caron'], ['Zoe', 'Beaulieu'], ['Henry', 'Cloutier'], ['Lily', 'Dubé'],
  ['Thomas', 'Poirier'], ['Nora', 'Fournier'], ['Daniel', 'Lapointe'], ['Hannah', 'Leclerc'], ['Samuel', 'Lefebvre'], ['Aria', 'Poulin'],
  ['Jacob', 'Thibault'], ['Isla', 'St-Pierre'], ['Nathan', 'Nadeau'], ['Ruby', 'Martin'], ['Ryan', 'Landry'], ['Claire', 'Martel'],
  ['Wei', 'Chen'], ['Priya', 'Patel'], ['Arjun', 'Singh'], ['Fatima', 'Hussein'], ['Mateo', 'Garcia'], ['Aisha', 'Mohamed'],
  ['Kenji', 'Tanaka'], ['Sofia', 'Rossi'], ['Mohammed', 'Ali'], ['Ji-woo', 'Kim'], ['Tiago', 'Silva'], ['Anika', 'Sharma'],
  ['Connor', "O'Brien"], ['Maya', 'Nguyen'], ['Dmitri', 'Volkov'], ['Leila', 'Haddad'], ['Marcus', 'Brown'], ['Sarah', 'Wilson'],
]
let next = 0
const person = () => PEOPLE[next++ % PEOPLE.length]

// ---------- Builders ----------

const sessions = []
const registrations = []
const owner = { id: null, name: 'Olive Owner' }

function addWeekend({ startDate, capacity = 20, status = 'open', notes = '', instructorIds = [], createdDaysAgo = 60 }) {
  const doc = { _id: new ObjectId(), startDate, capacity, seatsTaken: 0, status, instructorIds, notes, createdAt: at(-createdDaysAgo), updatedAt: at(-1) }
  sessions.push(doc)
  return doc
}

/**
 * One registration. `paid`: 'e-Transfer' | 'Cash' | { method, amountCents, note } · `cancelled`: { reason, refundCents }
 * Seats are counted afterwards from the registrations themselves, so they always add up.
 */
function addRegistration(weekend, options = {}) {
  const {
    packageId = 'cfsc', hasGuide = false, registeredDaysAgo = 10, paid, cancelled, attendance = null, consentReceived = false,
    nickname = '', friendName = '', comments = '', waitlistEarlier = false, staffNotes = '', eveningPhone = '', moves,
  } = options
  const [firstName, familyName] = options.name ?? person()
  const pkg = findPackage(packageId)
  const amountDueCents = pkg.total - (hasGuide ? GUIDE_PRICE : 0)
  const createdAt = at(-registeredDaysAgo, 9 + (registrations.length % 10))
  const localPart = `${firstName}.${familyName}`.toLowerCase().normalize('NFD').replaceAll(/[^a-z.]/g, '')
  const email = `${localPart}@example.test`
  const doc = {
    _id: new ObjectId(),
    reference: makePaymentReference(familyName, weekend.startDate),
    courseSessionId: weekend._id,
    startDate: weekend.startDate,
    packageId,
    packageTitle: pkg.title,
    amountDueCents,
    hasGuide,
    status: 'pending',
    student: { firstName, familyName, nickname, email, phone: `416-555-${String(1000 + registrations.length).slice(-4)}`, phoneExt: '', eveningPhone, eveningPhoneExt: '' },
    friendName,
    comments,
    waitlistEarlier,
    pal: pkg.needsPal ? { courseDate: addDaysTo(weekend.startDate, -45), instructor: 'Dana Whitfield' } : null,
    consentReceived,
    attendance,
    staffNotes,
    payments: [],
    createdAt,
    updatedAt: createdAt,
  }
  if (moves) doc.moves = moves
  if (paid) {
    const payment = typeof paid === 'string' ? { method: paid } : paid
    const receivedAt = new Date(createdAt.getTime() + 86_400_000)
    doc.status = 'paid'
    doc.paidAt = receivedAt
    doc.payments.push({ kind: 'payment', method: payment.method, amountCents: payment.amountCents ?? amountDueCents, receivedAt, recordedBy: owner, note: payment.note ?? '' })
  }
  if (cancelled) {
    doc.status = 'cancelled'
    doc.cancelledAt = new Date(createdAt.getTime() + 3 * 86_400_000)
    doc.cancelReason = cancelled.reason ?? ''
    if (cancelled.refundCents) {
      doc.payments.push({ kind: 'refund', method: 'refund', amountCents: cancelled.refundCents, receivedAt: doc.cancelledAt, recordedBy: owner, note: cancelled.reason ?? '' })
    }
  }
  registrations.push(doc)
  return doc
}

const repeat = (count, make) => Array.from({ length: count }, (_, i) => make(i))

// ---------- The sample data ----------

function buildData(staff) {
  owner.id = staff['owner@fac.test']
  const ian = staff['ian@fac.test']
  const ivy = staff['ivy@fac.test']

  // Two finished weekends with attendance recorded.
  const pastA = addWeekend({ startDate: saturdayIn(-42), capacity: 20, instructorIds: [ian], createdDaysAgo: 120 })
  repeat(11, (i) => addRegistration(pastA, { packageId: i % 3 ? 'package' : 'cfsc', paid: 'e-Transfer', attendance: 'attended', registeredDaysAgo: 70 - i, hasGuide: i === 4 }))
  addRegistration(pastA, { paid: 'e-Transfer', attendance: 'no_show', registeredDaysAgo: 60, staffNotes: 'No call, no show. Fee forfeited per policy.' })
  addRegistration(pastA, { packageId: 'package', paid: 'e-Transfer', cancelled: { reason: 'Cancelled 3 weeks before', refundCents: 35_040 }, registeredDaysAgo: 80 })

  const pastB = addWeekend({ startDate: saturdayIn(-14), capacity: 16, instructorIds: [ian, ivy], createdDaysAgo: 90 })
  repeat(13, (i) => addRegistration(pastB, { packageId: ['package', 'cfsc', 'crfsc'][i % 3], paid: i === 5 ? 'Cash' : 'e-Transfer', attendance: i === 9 ? 'no_show' : 'attended', registeredDaysAgo: 40 - i, consentReceived: i === 2 }))

  // The next weekend: nearly full, a few still unpaid, one removed for not paying.
  const nextUp = addWeekend({ startDate: saturdayIn(4), capacity: 12, instructorIds: [ian], notes: 'Projector bulb replaced. Bring spare extension cord.' })
  repeat(7, (i) => addRegistration(nextUp, { packageId: i % 2 ? 'package' : 'cfsc', paid: 'e-Transfer', registeredDaysAgo: 30 - i * 2, hasGuide: i === 1, consentReceived: i === 3, nickname: i === 0 ? 'Bill' : '' }))
  addRegistration(nextUp, { paid: { method: 'Cash', amountCents: 20_000, note: 'Paid $200 at the office; owes the rest on course day' }, registeredDaysAgo: 12 })
  addRegistration(nextUp, { packageId: 'package', registeredDaysAgo: 6, comments: 'Will send the e-Transfer on payday.' })
  addRegistration(nextUp, { registeredDaysAgo: 2, friendName: 'Mateo Garcia' })
  addRegistration(nextUp, { packageId: 'module', registeredDaysAgo: 1 })
  addRegistration(nextUp, { registeredDaysAgo: 15, cancelled: { reason: 'Not paid' } })

  // A full weekend.
  const full = addWeekend({ startDate: saturdayIn(18), capacity: 10, instructorIds: [ivy] })
  repeat(10, (i) => addRegistration(full, { packageId: i % 4 === 0 ? 'crfsc' : 'package', paid: i < 7 ? 'e-Transfer' : undefined, registeredDaysAgo: 25 - i, waitlistEarlier: i === 8 }))

  // Closed early by the owner, and one cancelled weekend whose students were moved.
  const closed = addWeekend({ startDate: saturdayIn(32), status: 'closed', notes: 'Closed early: private group booking.' })
  repeat(4, (i) => addRegistration(closed, { paid: 'e-Transfer', registeredDaysAgo: 20 - i }))
  const cancelledWeekend = addWeekend({ startDate: saturdayIn(46), status: 'cancelled', notes: 'Legion Hall unavailable that weekend.' })

  // Open weekends further out, with a mix of everything.
  const openA = addWeekend({ startDate: saturdayIn(60), instructorIds: [ivy] })
  addRegistration(openA, {
    packageId: 'package', paid: 'e-Transfer', registeredDaysAgo: 9,
    moves: [{ from: cancelledWeekend.startDate, to: openA.startDate, at: at(-3), by: owner }],
    comments: 'Moved from the cancelled weekend.',
  })
  addRegistration(openA, { packageId: 'crfsc', registeredDaysAgo: 4, comments: 'Took my CFSC with another school last month.' })
  addRegistration(openA, { packageId: 'module', paid: 'e-Transfer', registeredDaysAgo: 3 })
  addRegistration(openA, { hasGuide: true, registeredDaysAgo: 1, friendName: 'Sofia Rossi', eveningPhone: '647-555-0199' })
  addRegistration(openA, { name: ['Sofia', 'Rossi'], registeredDaysAgo: 1, friendName: 'Anika Sharma' })
  addRegistration(openA, { packageId: 'package', registeredDaysAgo: 0, comments: 'I am 16. My mother will sign the consent form.' })

  const openB = addWeekend({ startDate: saturdayIn(88) })
  addRegistration(openB, { packageId: 'package', registeredDaysAgo: 2 })
  addRegistration(openB, { paid: 'e-Transfer', registeredDaysAgo: 5 })
  addRegistration(openB, { cancelled: { reason: 'Changed plans' }, registeredDaysAgo: 8 })

  addWeekend({ startDate: saturdayIn(116) })
  addWeekend({ startDate: saturdayIn(144), capacity: 24 })

  // Seats always match the registrations that hold one.
  for (const weekend of sessions) {
    weekend.seatsTaken = registrations.filter((r) => r.courseSessionId.equals(weekend._id) && r.status !== 'cancelled').length
  }
  return { nextUp, openA }
}

function buildMessages() {
  return [
    { name: 'Gordon Hale', email: 'gordon.hale@example.test', comments: 'Do you run courses on weekdays? I work every Saturday.', createdAt: at(-1, 14), readAt: null },
    { name: 'Mei Lin', email: 'mei.lin@example.test', comments: 'Can my 15-year-old take the course with me? What does the consent form need?', createdAt: at(0, 9), readAt: null },
    { name: 'Robert Klein', email: 'robert.klein@example.test', comments: 'Is there parking at the Legion Hall?', createdAt: at(-6, 11), readAt: at(-5, 9), readBy: owner },
    { name: 'Aaliyah Ford', email: 'aaliyah.ford@example.test', comments: 'I sent my e-Transfer but forgot the reference. It was from A. Ford for $450.40.', createdAt: at(-9, 16), readAt: at(-9, 18), readBy: owner },
  ]
}

function buildEmailLog({ nextUp }) {
  const log = []
  const add = (reg, template, subject, status, daysAgo, error = null) =>
    log.push({ at: at(-daysAgo, 12), to: [reg.student.email], template, subject, registrationId: reg._id.toString(), status, providerId: status === 'sent' ? `seed_${log.length}` : null, error })
  for (const reg of registrations.filter((r) => r.startDate >= today).slice(0, 25)) {
    const days = Math.max(0, Math.round((Date.now() - reg.createdAt.getTime()) / 86_400_000))
    add(reg, 'registration-received', `Registration received (payment ${reg.reference})`, 'sent', days)
    if (reg.status === 'paid') add(reg, 'payment-confirmed', `You're confirmed: ${reg.packageTitle}`, 'sent', Math.max(0, days - 1))
  }
  const unpaid = registrations.find((r) => r.courseSessionId.equals(nextUp._id) && r.cancelReason === 'Not paid')
  if (unpaid) add(unpaid, 'registration-cancelled', `Registration cancelled (${unpaid.reference})`, 'sent', 2)
  const someone = registrations.find((r) => r.status === 'pending')
  add(someone, 'registration-received', `Registration received (payment ${someone.reference})`, 'failed', 1, 'Resend did not answer in time')
  log.push({ at: at(-1, 14), to: [], template: 'owner-new-message', subject: 'New contact message from Gordon Hale', registrationId: null, status: 'skipped', providerId: null, error: 'No recipient address' })
  return log
}

// ---------- Run ----------

try {
  await ensureIndexes(db)
  const staff = await ensureStaff()
  const built = buildData(staff)
  const messages = buildMessages()
  const emails = buildEmailLog(built)

  await Promise.all(['courseSessions', 'registrations', 'messages', 'emailLog', 'auditLog'].map((name) => db.collection(name).deleteMany({})))
  await db.collection('courseSessions').insertMany(sessions)
  await db.collection('registrations').insertMany(registrations)
  await db.collection('messages').insertMany(messages)
  await db.collection('emailLog').insertMany(emails)
  await db.collection('auditLog').insertOne({ at: new Date(), actor: { id: null, name: 'seed script', role: 'system' }, action: 'seed', target: { type: 'database', id: dbName }, details: {} })

  const count = (status) => registrations.filter((r) => r.status === status).length
  console.log(`Seeded "${dbName}": ${sessions.length} weekends, ${registrations.length} registrations (${count('paid')} paid, ${count('pending')} unpaid, ${count('cancelled')} cancelled), ${messages.length} messages, ${emails.length} email-log entries.`)
  console.log(`Staff logins (test database only): ${TEST_STAFF.map((s) => `${s.email} (${s.role})`).join(', ')}. Passwords are in scripts/seed-test-data.mjs.`)
} finally {
  await client.close()
}
