// Which email goes to whom, and when. Called after the database change has succeeded;
// email problems are logged (see send.js) and never undo or block the change itself.
import { BETTER_AUTH_URL, OWNER_NOTIFY_EMAIL } from 'astro:env/server'
import { addDaysTo, todayInToronto } from '../../data/dates.js'
import { store } from '../db.js'
import { sendEmail } from './send.js'
import * as t from './templates.js'

const siteUrl = (BETTER_AUTH_URL || 'https://mreinhart-fac-demo.com').replace(/\/$/, '')

/** Run a notification without letting an email problem affect the caller. */
export async function safely(task) {
  try {
    await task
  } catch (error) {
    console.error('[email] notification failed', error)
  }
}

const toStudent = (reg, template, email, extra = {}) =>
  sendEmail({ to: reg.student.email, template, ...email, registrationId: reg._id.toString(), ...extra })

/** New registration: payment instructions to the student, a heads-up to the owner. */
export async function notifyRegistration(registrationId) {
  const reg = await store().getRegistration(registrationId)
  await Promise.allSettled([
    toStudent(reg, 'registration-received', t.registrationReceived(reg), { idempotencyKey: `registration-received-${registrationId}` }),
    sendEmail({ to: OWNER_NOTIFY_EMAIL, template: 'owner-new-registration', ...t.ownerNewRegistration(reg, { siteUrl }), registrationId }),
  ])
}

export async function notifyContactMessage(message) {
  await sendEmail({ to: OWNER_NOTIFY_EMAIL, template: 'owner-new-message', ...t.ownerNewMessage(message, { siteUrl }) })
}

export async function notifyPaid(registrationId, amountPaidCents) {
  const reg = await store().getRegistration(registrationId)
  await toStudent(reg, 'payment-confirmed', t.paymentConfirmed(reg, { amountPaidCents, siteUrl }))
}

export async function notifyCancelled(registrationId, refundCents) {
  const reg = await store().getRegistration(registrationId)
  await toStudent(reg, 'registration-cancelled', t.registrationCancelled(reg, { refundCents }))
}

export async function notifyMoved(registrationId, fromStartDate) {
  const reg = await store().getRegistration(registrationId)
  await toStudent(reg, 'registration-moved', t.registrationMoved(reg, { fromStartDate }))
}

const torontoHour = (now) => Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', hour: 'numeric', hourCycle: 'h23' }).format(now))

/**
 * The hourly job: once it is 9 a.m. in Toronto, send class reminders to paid students (3 days before)
 * and class lists to the weekend's instructors (2 days before). Each email is claimed in the database first,
 * so it goes out once even if runs overlap. It never changes registrations or seats.
 * `now` can be set for local testing only (see /api/cron/hourly).
 */
export async function runHourlyJob({ now = new Date() } = {}) {
  const data = store()
  const summary = { classReminders: 0, rosters: 0 }
  if (torontoHour(now) < 9) return summary

  const today = todayInToronto(now)
  for (const reg of await data.listClassRemindersDue(addDaysTo(today, 3))) {
    if (await data.claimOnce('registration', reg._id, 'classReminderSentAt')) {
      await toStudent(reg, 'class-reminder', t.classReminder(reg))
      summary.classReminders += 1
    }
  }
  for (const weekend of await data.listRostersDue(addDaysTo(today, 2))) {
    if (!weekend.instructorIds.length) continue
    if (await data.claimOnce('courseSession', weekend.id, 'rosterSentAt')) {
      const roster = await data.listRoster(weekend.id)
      await sendEmail({ to: await data.staffEmails(weekend.instructorIds), template: 'instructor-roster', ...t.instructorRoster(weekend, roster, { siteUrl }) })
      summary.rosters += 1
    }
  }
  return summary
}
