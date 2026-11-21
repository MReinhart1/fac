// All reads and writes for course weekends, registrations, payments and messages.
// Takes a database and client, so the site (src/lib/db.js) and the scripts share the same rules.
//
// Seat counting: each course weekend keeps `seatsTaken`. A seat is taken when a registration is created
// (status "pending" until the owner marks it paid) and given back only when staff cancel it; unpaid registrations
// are never released automatically. Seat changes and registration changes happen in one transaction, so the count
// stays exact.
import { ObjectId } from 'mongodb'
import { findPackage, GUIDE_PRICE, money } from '../data/courses.js'
import { todayInToronto, weekendParts } from '../data/dates.js'
import { booking } from '../data/site.js'
import { COLLECTIONS } from './mongo.js'
import { makePaymentReference } from './paymentReference.js'
import { holdsSeat, REGISTRATION_STATUS, SESSION_STATUS } from './status.js'

export class StoreError extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
  }
}

const HOLDS_A_SEAT = [REGISTRATION_STATUS.pending, REGISTRATION_STATUS.paid]

export const toObjectId = (id) => {
  if (id instanceof ObjectId) return id
  if (typeof id !== 'string' || !ObjectId.isValid(id)) throw new StoreError('not_found', 'Not found.')
  return new ObjectId(id)
}

/** A course weekend as pages show it. */
export function describeSession(doc) {
  const seatsLeft = Math.max(0, doc.capacity - doc.seatsTaken)
  return {
    id: doc._id.toString(),
    start: doc.startDate,
    ...weekendParts(doc.startDate),
    capacity: doc.capacity,
    seatsTaken: doc.seatsTaken,
    seatsLeft,
    status: doc.status,
    full: doc.status !== SESSION_STATUS.open || seatsLeft === 0,
    instructorIds: doc.instructorIds ?? [],
    notes: doc.notes ?? '',
  }
}

export function createStore(db, client) {
  const sessions = db.collection(COLLECTIONS.courseSessions)
  const registrations = db.collection(COLLECTIONS.registrations)
  const messages = db.collection(COLLECTIONS.messages)
  const auditLog = db.collection(COLLECTIONS.auditLog)

  const transaction = async (work) => {
    const session = client.startSession()
    try {
      let result
      await session.withTransaction(async () => {
        result = await work(session)
      })
      return result
    } finally {
      await session.endSession()
    }
  }

  // Take one seat if the weekend is open and not full. Returns the updated weekend, or null.
  const takeSeat = (courseSessionId, session) =>
    sessions.findOneAndUpdate(
      {
        _id: courseSessionId,
        status: SESSION_STATUS.open,
        startDate: { $gte: todayInToronto() },
        $expr: { $lt: ['$seatsTaken', '$capacity'] },
      },
      { $inc: { seatsTaken: 1 }, $set: { updatedAt: new Date() } },
      { session, returnDocument: 'after' },
    )

  const giveBackSeat = (courseSessionId, session) =>
    sessions.updateOne(
      { _id: courseSessionId, seatsTaken: { $gt: 0 } },
      { $inc: { seatsTaken: -1 }, $set: { updatedAt: new Date() } },
      { session },
    )

  const audit = (actor, action, target, details = {}) =>
    auditLog.insertOne({
      at: new Date(),
      actor: actor ? { id: actor.id, name: actor.name, role: actor.role } : { id: null, name: 'system', role: 'system' },
      action,
      target,
      details,
    })

  const getRegistration = async (id) => {
    const doc = await registrations.findOne({ _id: toObjectId(id) })
    if (!doc) throw new StoreError('not_found', 'Registration not found.')
    return doc
  }

  // Update a registration only if its status is still what the page loaded, so two staff members
  // working on the same student cannot overwrite each other.
  const updateUnchanged = async (reg, update, session) => {
    const result = await registrations.updateOne({ _id: reg._id, status: reg.status }, update, { session })
    if (result.modifiedCount !== 1) throw new StoreError('conflict', 'This registration changed while you were working. Reload and try again.')
  }

  return {
    audit,

    // ---------- Course weekends ----------

    /** Upcoming weekends for the public site (cancelled ones hidden). */
    async listPublicSessions() {
      const docs = await sessions
        .find({ startDate: { $gte: todayInToronto() }, status: { $ne: SESSION_STATUS.cancelled } })
        .sort({ startDate: 1 })
        .toArray()
      return docs.map(describeSession)
    },

    /** Weekends for the staff portal. `instructorId` limits the list to weekends that instructor teaches. */
    async listSessions({ includePast = false, instructorId } = {}) {
      const filter = {
        ...(includePast ? {} : { startDate: { $gte: todayInToronto() } }),
        ...(instructorId ? { instructorIds: instructorId } : {}),
      }
      const docs = await sessions.find(filter).sort({ startDate: includePast ? -1 : 1 }).toArray()
      return docs.map(describeSession)
    },

    async getSession(id) {
      const doc = await sessions.findOne({ _id: toObjectId(id) })
      if (!doc) throw new StoreError('not_found', 'Course weekend not found.')
      return describeSession(doc)
    },

    async createSession({ startDate, capacity = booking.defaultCapacity, notes = '', instructorIds = [] }, actor) {
      const now = new Date()
      try {
        const { insertedId } = await sessions.insertOne({
          startDate,
          capacity,
          seatsTaken: 0,
          status: SESSION_STATUS.open,
          instructorIds,
          notes,
          createdAt: now,
          updatedAt: now,
        })
        await audit(actor, 'session.create', { type: 'courseSession', id: insertedId.toString() }, { startDate, capacity })
        return insertedId.toString()
      } catch (error) {
        if (error?.code === 11_000) throw new StoreError('duplicate', 'There is already a course weekend on that date.')
        throw error
      }
    },

    async updateSession(id, changes, actor) {
      const _id = toObjectId(id)
      const current = await sessions.findOne({ _id })
      if (!current) throw new StoreError('not_found', 'Course weekend not found.')
      const set = { updatedAt: new Date() }
      if (changes.capacity !== undefined) {
        if (changes.capacity < current.seatsTaken) {
          throw new StoreError('invalid', `Capacity can't be lower than the ${current.seatsTaken} seats already taken.`)
        }
        set.capacity = changes.capacity
      }
      if (changes.status !== undefined) set.status = changes.status
      if (changes.notes !== undefined) set.notes = changes.notes
      if (changes.instructorIds !== undefined) set.instructorIds = changes.instructorIds
      await sessions.updateOne({ _id }, { $set: set })
      await audit(actor, 'session.update', { type: 'courseSession', id }, changes)
    },

    // ---------- Registrations ----------

    /**
     * Save a registration from the public form and take a seat for it.
     * Prices are always worked out here from the package list, never taken from the browser.
     */
    async createRegistration(input) {
      const pkg = findPackage(input.packageId)
      if (!pkg) throw new StoreError('invalid', 'Please choose a course package.')
      if (typeof input.courseSessionId !== 'string' || !ObjectId.isValid(input.courseSessionId)) {
        throw new StoreError('invalid', 'Please choose a course date.')
      }
      const courseSessionId = new ObjectId(input.courseSessionId)
      const weekend = await sessions.findOne({ _id: courseSessionId })
      if (!weekend) throw new StoreError('invalid', 'Please choose a course date.')

      const amountDueCents = pkg.total - (input.hasGuide ? GUIDE_PRICE : 0)
      const now = new Date()

      for (let attempt = 0; attempt < 4; attempt += 1) {
        const doc = {
          reference: makePaymentReference(input.student.familyName, weekend.startDate),
          courseSessionId,
          startDate: weekend.startDate,
          packageId: pkg.id,
          packageTitle: pkg.title,
          amountDueCents,
          hasGuide: Boolean(input.hasGuide),
          status: REGISTRATION_STATUS.pending,
          student: input.student,
          friendName: input.friendName ?? '',
          comments: input.comments ?? '',
          waitlistEarlier: Boolean(input.waitlistEarlier),
          pal: pkg.needsPal ? (input.pal ?? null) : null,
          consentReceived: false,
          attendance: null,
          staffNotes: '',
          payments: [],
          createdAt: now,
          updatedAt: now,
        }
        try {
          // Retries are deliberately sequential: each attempt only runs if the previous reference collided.
          // oxlint-disable-next-line no-await-in-loop
          await transaction(async (session) => {
            const seat = await takeSeat(courseSessionId, session)
            if (!seat) throw new StoreError('full', 'Sorry, that date just filled up. Please choose another date.')
            await registrations.insertOne(doc, { session })
          })
          return {
            id: doc._id.toString(),
            reference: doc.reference,
            amountDue: money(amountDueCents),
            course: pkg.title,
            courseDate: weekendParts(weekend.startDate).label,
            firstName: doc.student.firstName,
            email: doc.student.email,
            payWithinHours: booking.payWithinHours,
          }
        } catch (error) {
          // A clash on the random payment reference: try again with a new one.
          if (error?.code === 11_000 && error?.keyPattern?.reference) continue
          throw error
        }
      }
      throw new StoreError('error', 'Could not create a payment reference. Please try again.')
    },

    getRegistration,

    async listRoster(courseSessionId) {
      return registrations
        .find({ courseSessionId: toObjectId(courseSessionId) })
        .sort({ status: 1, 'student.familyName': 1, 'student.firstName': 1 })
        .toArray()
    },

    async findByReference(reference) {
      const clean = String(reference ?? '').trim().toUpperCase()
      if (!clean) return null
      return registrations.findOne({ reference: clean })
    },

    /** Unpaid registrations (each still has its seat), soonest course first. */
    async listUnpaid() {
      return registrations.find({ status: REGISTRATION_STATUS.pending }).sort({ startDate: 1, createdAt: 1 }).toArray()
    },

    async markPaid(id, { method = 'e-Transfer', amountCents, note = '' }, actor) {
      const reg = await getRegistration(id)
      if (reg.status === REGISTRATION_STATUS.paid) throw new StoreError('invalid', 'This registration is already paid.')
      if (reg.status === REGISTRATION_STATUS.cancelled) throw new StoreError('invalid', 'This registration was cancelled.')
      const payment = {
        kind: 'payment',
        method,
        amountCents: amountCents ?? reg.amountDueCents,
        receivedAt: new Date(),
        recordedBy: { id: actor.id, name: actor.name },
        note,
      }
      await updateUnchanged(reg, { $set: { status: REGISTRATION_STATUS.paid, paidAt: new Date(), updatedAt: new Date() }, $push: { payments: payment } })
      await audit(actor, 'registration.paid', { type: 'registration', id }, { reference: reg.reference, method, amountCents: payment.amountCents })
    },

    async cancelRegistration(id, { refundCents = 0, reason = '' }, actor) {
      const reg = await getRegistration(id)
      if (reg.status === REGISTRATION_STATUS.cancelled) throw new StoreError('invalid', 'This registration is already cancelled.')
      const push = refundCents > 0
        ? { payments: { kind: 'refund', method: 'refund', amountCents: refundCents, receivedAt: new Date(), recordedBy: { id: actor.id, name: actor.name }, note: reason } }
        : undefined
      await transaction(async (session) => {
        await updateUnchanged(
          reg,
          {
            $set: { status: REGISTRATION_STATUS.cancelled, cancelledAt: new Date(), cancelReason: reason, updatedAt: new Date() },
            ...(push ? { $push: push } : {}),
          },
          session,
        )
        if (holdsSeat(reg)) await giveBackSeat(reg.courseSessionId, session)
      })
      await audit(actor, 'registration.cancel', { type: 'registration', id }, { reference: reg.reference, refundCents, reason })
    },

    /** Move a registration to another weekend (reschedule). */
    async moveRegistration(id, newSessionId, actor) {
      const reg = await getRegistration(id)
      const target = toObjectId(newSessionId)
      if (target.equals(reg.courseSessionId)) throw new StoreError('invalid', 'The student is already booked on that weekend.')
      if (!holdsSeat(reg)) throw new StoreError('invalid', 'Only unpaid or paid registrations can be moved.')
      const weekend = await sessions.findOne({ _id: target })
      if (!weekend) throw new StoreError('not_found', 'Course weekend not found.')
      await transaction(async (session) => {
        const seat = await takeSeat(target, session)
        if (!seat) throw new StoreError('full', 'That weekend is full, closed or already past.')
        await giveBackSeat(reg.courseSessionId, session)
        await updateUnchanged(
          reg,
          {
            $set: { courseSessionId: target, startDate: weekend.startDate, updatedAt: new Date() },
            $push: { moves: { from: reg.startDate, to: weekend.startDate, at: new Date(), by: { id: actor.id, name: actor.name } } },
          },
          session,
        )
      })
      await audit(actor, 'registration.move', { type: 'registration', id }, { reference: reg.reference, from: reg.startDate, to: weekend.startDate })
    },

    /** Course-day details staff can change: consent form, attendance, notes. */
    async updateRegistrationDetails(id, { consentReceived, attendance, staffNotes }, actor) {
      const reg = await getRegistration(id)
      const set = { updatedAt: new Date() }
      if (consentReceived !== undefined) set.consentReceived = consentReceived
      if (attendance !== undefined) set.attendance = attendance
      if (staffNotes !== undefined) set.staffNotes = staffNotes
      await registrations.updateOne({ _id: reg._id }, { $set: set })
      await audit(actor, 'registration.update', { type: 'registration', id }, { consentReceived, attendance })
    },

    /** Counts per weekend for the dashboard: { [sessionId]: { pending, paid, outstandingCents } }. */
    async rosterCounts(sessionIds) {
      const ids = sessionIds.map(toObjectId)
      const rows = await registrations
        .aggregate([
          { $match: { courseSessionId: { $in: ids }, status: { $in: HOLDS_A_SEAT } } },
          {
            $group: {
              _id: '$courseSessionId',
              pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
              paid: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] } },
              outstandingCents: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, '$amountDueCents', 0] } },
            },
          },
        ])
        .toArray()
      return Object.fromEntries(rows.map((row) => [row._id.toString(), row]))
    },

    // ---------- Scheduled emails ----------

    /** Paid registrations on a weekend that have not had their class reminder. */
    async listClassRemindersDue(startDate) {
      return registrations.find({ startDate, status: REGISTRATION_STATUS.paid, classReminderSentAt: { $exists: false } }).toArray()
    },

    /** Open or closed weekends starting on a date whose class list has not been emailed. */
    async listRostersDue(startDate) {
      const docs = await sessions
        .find({ startDate, status: { $ne: SESSION_STATUS.cancelled }, rosterSentAt: { $exists: false } })
        .toArray()
      return docs.map(describeSession)
    },

    /**
     * Mark a one-time email as sent before sending it. Returns false if another run already claimed it,
     * so overlapping scheduled runs can never send the same email twice.
     */
    async claimOnce(kind, id, field) {
      const collection = kind === 'courseSession' ? sessions : registrations
      const result = await collection.updateOne({ _id: toObjectId(id), [field]: { $exists: false } }, { $set: { [field]: new Date() } })
      return result.modifiedCount === 1
    },

    /** Email addresses of staff logins (Better Auth's user collection). */
    async staffEmails(userIds) {
      const ids = userIds.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id))
      if (!ids.length) return []
      const users = await db.collection('user').find({ _id: { $in: ids }, banned: { $ne: true } }).project({ email: 1 }).toArray()
      return users.map((user) => user.email)
    },

    // ---------- Email log ----------

    async listEmails({ registrationId, limit = 100 } = {}) {
      return db
        .collection(COLLECTIONS.emailLog)
        .find(registrationId ? { registrationId } : {})
        .sort({ at: -1 })
        .limit(limit)
        .toArray()
    },

    // ---------- Contact messages ----------

    async createMessage({ name, email, comments }) {
      const doc = { name, email, comments, createdAt: new Date(), readAt: null }
      await messages.insertOne(doc)
      return doc
    },

    async listMessages({ limit = 100 } = {}) {
      return messages.find({}).sort({ createdAt: -1 }).limit(limit).toArray()
    },

    async countUnreadMessages() {
      return messages.countDocuments({ readAt: null })
    },

    async markMessageRead(id, actor) {
      await messages.updateOne({ _id: toObjectId(id) }, { $set: { readAt: new Date(), readBy: { id: actor.id, name: actor.name } } })
    },
  }
}
