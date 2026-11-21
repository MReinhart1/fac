// The booking rules in store.js, run against a throwaway in-memory MongoDB (a replica set, for transactions).
import { MongoClient } from 'mongodb'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { addDaysTo, todayInToronto } from '../data/dates.js'
import { ensureIndexes } from './mongo.js'
import { createStore } from './store.js'

const owner = { id: 'owner-1', name: 'Olive Owner', role: 'admin' }
let replSet, client, db, store

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } })
  client = new MongoClient(replSet.getUri())
  db = client.db('store-test')
  await ensureIndexes(db)
  store = createStore(db, client)
})

afterAll(async () => {
  await client?.close()
  await replSet?.stop()
})

beforeEach(async () => {
  await Promise.all(['courseSessions', 'registrations', 'auditLog'].map((name) => db.collection(name).deleteMany({})))
})

let day = 30
/** A new weekend some days ahead (each call a different date, since dates are unique). */
async function weekend({ capacity = 20, status = 'open', daysAhead } = {}) {
  day += 7
  const id = await store.createSession({ startDate: addDaysTo(todayInToronto(), daysAhead ?? day), capacity }, owner)
  if (status !== 'open') await store.updateSession(id, { status }, owner)
  return id
}

const register = (courseSessionId, overrides = {}) =>
  store.createRegistration({
    packageId: 'cfsc',
    courseSessionId,
    hasGuide: false,
    student: { firstName: 'Pat', familyName: 'Tester', email: 'pat@example.test', phone: '416-555-0100' },
    ...overrides,
  })

const seatsTaken = async (id) => (await store.getSession(id)).seatsTaken
const statusOf = async (id) => (await store.getRegistration(id)).status

describe('registering', () => {
  it('works out the price on the server and takes one seat', async () => {
    const w = await weekend()
    const reply = await register(w)
    expect(reply).toMatchObject({ amountDue: '$258.30', course: 'CFSC course package', payWithinHours: 48 })
    expect(await store.getRegistration(reply.id)).toMatchObject({ status: 'pending', amountDueCents: 25_830, payments: [] })
    expect(await seatsTaken(w)).toBe(1)
  })

  it('takes the guide off the price when the student has one', async () => {
    const reply = await register(await weekend(), { hasGuide: true })
    expect((await store.getRegistration(reply.id)).amountDueCents).toBe(23_730)
  })

  it('ignores a price or status sent from the browser', async () => {
    const reply = await register(await weekend(), { amountDueCents: 1, status: 'paid' })
    expect(await store.getRegistration(reply.id)).toMatchObject({ amountDueCents: 25_830, status: 'pending' })
  })

  it('keeps PAL details only for restricted-only packages', async () => {
    const w = await weekend()
    const pal = { courseDate: '2026-01-10', instructor: 'Jane' }
    expect((await store.getRegistration((await register(w, { packageId: 'crfsc', pal })).id)).pal).toEqual(pal)
    expect((await store.getRegistration((await register(w, { packageId: 'cfsc', pal })).id)).pal).toBeNull()
  })

  it('refuses unknown packages and weekends', async () => {
    const w = await weekend()
    await expect(register(w, { packageId: 'free' })).rejects.toMatchObject({ code: 'invalid' })
    await expect(register('not-an-id')).rejects.toMatchObject({ code: 'invalid' })
    await expect(register('0123456789abcdef01234567')).rejects.toMatchObject({ code: 'invalid' })
  })

  it('refuses full, closed, cancelled and past weekends', async () => {
    const full = await weekend({ capacity: 1 })
    await register(full)
    await expect(register(full)).rejects.toMatchObject({ code: 'full' })
    await expect(register(await weekend({ status: 'closed' }))).rejects.toMatchObject({ code: 'full' })
    await expect(register(await weekend({ status: 'cancelled' }))).rejects.toMatchObject({ code: 'full' })
    await expect(register(await weekend({ daysAhead: -7 }))).rejects.toMatchObject({ code: 'full' })
  })

  it('never oversells when many people register at once', async () => {
    const w = await weekend({ capacity: 3 })
    const results = await Promise.allSettled(Array.from({ length: 12 }, (_, i) => register(w, { student: { firstName: 'P', familyName: `N${i}`, email: 'p@example.test', phone: '1' } })))
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(3)
    expect(results.filter((r) => r.status === 'rejected').every((r) => r.reason.code === 'full')).toBe(true)
    expect(await seatsTaken(w)).toBe(3)
    expect(await db.collection('registrations').countDocuments()).toBe(3)
  })
})

describe('payments', () => {
  it('records a payment and confirms the seat', async () => {
    const { id } = await register(await weekend())
    await store.markPaid(id, { method: 'Cash', amountCents: 20_000, note: 'At the door' }, owner)
    const reg = await store.getRegistration(id)
    expect(reg.status).toBe('paid')
    expect(reg.payments).toEqual([expect.objectContaining({ kind: 'payment', method: 'Cash', amountCents: 20_000, note: 'At the door' })])
  })

  it('refuses to record a payment twice or on a cancelled registration', async () => {
    const w = await weekend()
    const paid = await register(w)
    await store.markPaid(paid.id, {}, owner)
    await expect(store.markPaid(paid.id, {}, owner)).rejects.toMatchObject({ code: 'invalid' })

    const cancelled = await register(w)
    await store.cancelRegistration(cancelled.id, {}, owner)
    await expect(store.markPaid(cancelled.id, {}, owner)).rejects.toMatchObject({ code: 'invalid' })
  })

  it('lets only one of two staff members record the same payment', async () => {
    const { id } = await register(await weekend())
    const results = await Promise.allSettled([store.markPaid(id, {}, owner), store.markPaid(id, {}, owner)])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect((await store.getRegistration(id)).payments).toHaveLength(1)
  })

  it('finds a registration by its reference, whatever the case or spacing', async () => {
    const { reference } = await register(await weekend())
    expect((await store.findByReference(`  ${reference.toLowerCase()} `)).reference).toBe(reference)
    expect(await store.findByReference('')).toBeNull()
  })

  it('lists unpaid registrations, soonest course first', async () => {
    const later = await weekend()
    const sooner = await weekend({ daysAhead: 10 })
    await register(later)
    await register(sooner)
    const paid = await register(sooner)
    await store.markPaid(paid.id, {}, owner)
    const unpaid = await store.listUnpaid()
    expect(unpaid.map((r) => r.status)).toEqual(['pending', 'pending'])
    expect(unpaid[0].startDate < unpaid[1].startDate).toBe(true)
  })
})

describe('cancelling', () => {
  it('frees the seat of an unpaid registration', async () => {
    const w = await weekend({ capacity: 1 })
    const { id } = await register(w)
    await store.cancelRegistration(id, { reason: 'Not paid' }, owner)
    expect(await store.getRegistration(id)).toMatchObject({ status: 'cancelled', cancelReason: 'Not paid' })
    expect(await seatsTaken(w)).toBe(0)
    await register(w) // the seat can be booked again
  })

  it('records a refund on a paid registration', async () => {
    const w = await weekend()
    const { id } = await register(w)
    await store.markPaid(id, {}, owner)
    await store.cancelRegistration(id, { refundCents: 15_830, reason: 'Asked to cancel' }, owner)
    expect((await store.getRegistration(id)).payments.map((p) => [p.kind, p.amountCents])).toEqual([
      ['payment', 25_830],
      ['refund', 15_830],
    ])
    expect(await seatsTaken(w)).toBe(0)
  })

  it('cannot cancel twice, so a seat is never given back twice', async () => {
    const w = await weekend()
    const keep = await register(w)
    const { id } = await register(w)
    await store.cancelRegistration(id, {}, owner)
    await expect(store.cancelRegistration(id, {}, owner)).rejects.toMatchObject({ code: 'invalid' })
    expect(await seatsTaken(w)).toBe(1)
    expect(await statusOf(keep.id)).toBe('pending')
  })
})

describe('moving to another weekend', () => {
  it('takes a seat on the new weekend and frees the old one', async () => {
    const from = await weekend()
    const to = await weekend()
    const { id } = await register(from)
    await store.moveRegistration(id, to, owner)
    expect(await seatsTaken(from)).toBe(0)
    expect(await seatsTaken(to)).toBe(1)
    const reg = await store.getRegistration(id)
    expect(reg.courseSessionId.toString()).toBe(to)
    expect(reg.moves).toHaveLength(1)
  })

  it('changes nothing when the new weekend is full', async () => {
    const from = await weekend()
    const to = await weekend({ capacity: 1 })
    await register(to)
    const { id } = await register(from)
    await expect(store.moveRegistration(id, to, owner)).rejects.toMatchObject({ code: 'full' })
    expect(await seatsTaken(from)).toBe(1)
    expect(await seatsTaken(to)).toBe(1)
  })

  it('refuses a move to the same weekend or of a cancelled registration', async () => {
    const w = await weekend()
    const other = await weekend()
    const { id } = await register(w)
    await expect(store.moveRegistration(id, w, owner)).rejects.toMatchObject({ code: 'invalid' })
    await store.cancelRegistration(id, {}, owner)
    await expect(store.moveRegistration(id, other, owner)).rejects.toMatchObject({ code: 'invalid' })
  })
})

describe('course weekends', () => {
  it('refuses two weekends on the same date', async () => {
    await store.createSession({ startDate: '2031-05-03' }, owner)
    await expect(store.createSession({ startDate: '2031-05-03' }, owner)).rejects.toMatchObject({ code: 'duplicate' })
  })

  it('will not shrink below the seats already taken', async () => {
    const w = await weekend()
    await register(w)
    await register(w)
    await expect(store.updateSession(w, { capacity: 1 }, owner)).rejects.toMatchObject({ code: 'invalid' })
    await store.updateSession(w, { capacity: 2 }, owner)
    expect((await store.getSession(w)).full).toBe(true)
  })

  it('hides cancelled and past weekends from the public list', async () => {
    const open = await weekend()
    await weekend({ status: 'cancelled' })
    await weekend({ daysAhead: -14 })
    const closed = await weekend({ status: 'closed' })
    expect((await store.listPublicSessions()).map((w) => w.id).toSorted()).toEqual([open, closed].toSorted())
  })

  it('shows instructors only the weekends they teach', async () => {
    const theirs = await weekend()
    await weekend()
    await store.updateSession(theirs, { instructorIds: ['ian'] }, owner)
    expect((await store.listSessions({ instructorId: 'ian' })).map((w) => w.id)).toEqual([theirs])
  })

  it('counts paid and unpaid students per weekend', async () => {
    const w = await weekend()
    await register(w)
    const paid = await register(w, { hasGuide: true })
    await store.markPaid(paid.id, {}, owner)
    const gone = await register(w)
    await store.cancelRegistration(gone.id, {}, owner)
    expect(await store.rosterCounts([w])).toEqual({ [w]: expect.objectContaining({ pending: 1, paid: 1, outstandingCents: 25_830 }) })
  })
})

describe('scheduled emails', () => {
  it('claims each one-time email only once', async () => {
    const { id } = await register(await weekend())
    const claims = await Promise.all([1, 2, 3].map(() => store.claimOnce('registration', id, 'classReminderSentAt')))
    expect(claims.filter(Boolean)).toHaveLength(1)
  })

  it('sends class reminders only to paid students', async () => {
    const w = await weekend()
    const { start: startDate } = await store.getSession(w)
    await register(w)
    const paid = await register(w)
    await store.markPaid(paid.id, {}, owner)
    expect((await store.listClassRemindersDue(startDate)).map((r) => r._id.toString())).toEqual([paid.id])
  })
})

describe('audit log', () => {
  it('records who made each change', async () => {
    const { id } = await register(await weekend())
    await store.markPaid(id, { amountCents: 25_830 }, owner)
    const entry = await db.collection('auditLog').findOne({ action: 'registration.paid' })
    expect(entry).toMatchObject({ actor: { id: 'owner-1', name: 'Olive Owner' }, target: { type: 'registration', id } })
  })
})
