// The wording of every automatic email. Each function returns { subject, html, text }.
// Plain functions of their data (no database, no settings), so the portal can preview them with sample data.
import { money } from '../../data/courses.js'
import { weekendParts } from '../../data/dates.js'
import { booking, cfp, etransfer, location, phone } from '../../data/site.js'
import { renderEmail } from './layout.js'

const dateLabel = (startDate) => weekendParts(startDate).label

/** Which day(s) the student attends, from the site's schedule: CFSC on Saturday, CRFSC on Sunday. */
export function scheduleFor(packageId) {
  if (packageId === 'cfsc') return 'Saturday (CFSC)'
  if (packageId === 'package') return 'Saturday (CFSC) and Sunday (CRFSC)'
  return 'Sunday (CRFSC)'
}

const where = `${location.name}, ${location.address}`
const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.address)}`
const replyLine = `Questions? Reply to this email or call ${phone.display}.`

const paymentBlocks = (reg) => [
  {
    details: [
      ['Amount', money(reg.amountDueCents)],
      ['Send to', etransfer.email || 'We will send you the e-Transfer address in a separate email'],
      ['Message / reference', reg.reference],
    ],
  },
  { small: 'If your bank asks for a security question, use “Registration reference” as the question and your reference code as the answer.' },
]

const bringList = (reg) => [
  reg.hasGuide ? 'Your Canadian Firearms Safety Course student guide' : 'Your student guide is included and will be given to you in class',
  'Electronic devices (laptops, tablets, etc.) are not permitted in the classroom',
]

// ---------- To students ----------

/** The cancel reason the portal records when the owner removes an unpaid student. */
export const UNPAID_REASON = 'Not paid'

export function registrationReceived(reg) {
  return renderEmail({
    subject: `Registration received — ${dateLabel(reg.startDate)} (payment ${reg.reference})`,
    preheader: `Send ${money(reg.amountDueCents)} by Interac e-Transfer with reference ${reg.reference}.`,
    blocks: [
      { p: `Hi ${reg.student.firstName},` },
      { p: `Thanks for registering for the ${reg.packageTitle} on ${dateLabel(reg.startDate)} at ${location.name}.` },
      { note: `Please send your payment within ${booking.payWithinHours} hours. Your seat is confirmed once it arrives; unpaid registrations may be cancelled so the seat can go to someone else.` },
      { h: 'Pay by Interac e-Transfer' },
      ...paymentBlocks(reg),
      { p: 'We will email your course confirmation once the payment arrives, usually within one business day.' },
      { small: 'Cancellations are accepted up to 14 days before the course (a $100 deposit is non-refundable); none within 48 hours. Reschedules are free up to 7 days before.' },
      { small: replyLine },
    ],
  })
}

export function paymentConfirmed(reg, { amountPaidCents, siteUrl }) {
  return renderEmail({
    subject: `You're confirmed: ${reg.packageTitle}, ${dateLabel(reg.startDate)}`,
    preheader: `Payment received. See you on ${dateLabel(reg.startDate)}.`,
    blocks: [
      { p: `Hi ${reg.student.firstName},` },
      { p: `We received your payment of ${money(amountPaidCents ?? reg.amountDueCents)}. Your seat is confirmed.` },
      {
        details: [
          ['Course', reg.packageTitle],
          ['Dates', dateLabel(reg.startDate)],
          ['You attend', scheduleFor(reg.packageId)],
          ['Where', where],
          ['Reference', reg.reference],
        ],
      },
      { button: { label: 'Map and directions', url: mapUrl } },
      { h: 'Before you come' },
      { list: bringList(reg) },
      { p: 'Allow for the full scheduled course and exam time, and avoid making other plans that day.' },
      { small: `Under 18? Bring the signed parent/guardian consent form: ${siteUrl}/consent` },
      { small: `For licence or application questions, contact the Canadian Firearms Program at ${cfp.phoneDisplay}. ${replyLine}` },
    ],
  })
}

export function classReminder(reg) {
  return renderEmail({
    subject: `See you this weekend: ${dateLabel(reg.startDate)}`,
    preheader: `${scheduleFor(reg.packageId)} at ${location.name}.`,
    blocks: [
      { p: `Hi ${reg.student.firstName},` },
      { p: `A reminder that your ${reg.packageTitle} is coming up.` },
      { details: [['Dates', dateLabel(reg.startDate)], ['You attend', scheduleFor(reg.packageId)], ['Where', where]] },
      { button: { label: 'Map and directions', url: mapUrl } },
      { h: 'Before you come' },
      { list: bringList(reg) },
      { small: `Running late or can’t make it? Call ${phone.display} as soon as possible. Rescheduling within 48 hours of the course is not possible.` },
    ],
  })
}

export function registrationCancelled(reg, { refundCents = 0 }) {
  return renderEmail({
    subject: `Registration cancelled: ${dateLabel(reg.startDate)} (${reg.reference})`,
    preheader: 'Your registration has been cancelled.',
    blocks: [
      { p: `Hi ${reg.student.firstName},` },
      { p: `Your registration for the ${reg.packageTitle} on ${dateLabel(reg.startDate)} has been cancelled.` },
      ...(reg.cancelReason === UNPAID_REASON
        ? [
            { p: 'We did not receive your payment, so the seat has been given to someone else. If you still want to take the course, please register again.' },
            { small: `Already sent your e-Transfer? Reply to this email or call ${phone.display} and we will sort it out.` },
          ]
        : []),
      ...(refundCents > 0 ? [{ p: `A refund of ${money(refundCents)} is on its way.` }] : []),
      { small: replyLine },
    ],
  })
}

export function registrationMoved(reg, { fromStartDate }) {
  return renderEmail({
    subject: `Your course date changed to ${dateLabel(reg.startDate)}`,
    preheader: `Moved from ${dateLabel(fromStartDate)} to ${dateLabel(reg.startDate)}.`,
    blocks: [
      { p: `Hi ${reg.student.firstName},` },
      { p: `As arranged, your ${reg.packageTitle} has moved from ${dateLabel(fromStartDate)} to ${dateLabel(reg.startDate)}.` },
      { details: [['New dates', dateLabel(reg.startDate)], ['You attend', scheduleFor(reg.packageId)], ['Where', where], ['Reference', reg.reference]] },
      { small: replyLine },
    ],
  })
}

// ---------- To staff ----------

export function ownerNewRegistration(reg, { siteUrl }) {
  const s = reg.student
  return renderEmail({
    subject: `New registration: ${s.firstName} ${s.familyName}, ${dateLabel(reg.startDate)}`,
    preheader: `${reg.packageTitle} · ${money(reg.amountDueCents)} · ${reg.reference}`,
    blocks: [
      {
        details: [
          ['Student', `${s.firstName} ${s.familyName}${s.nickname ? ` (${s.nickname})` : ''}`],
          ['Course', reg.packageTitle],
          ['Dates', dateLabel(reg.startDate)],
          ['Amount due', money(reg.amountDueCents)],
          ['Reference', reg.reference],
          ['Email', s.email],
          ['Phone', `${s.phone}${s.phoneExt ? ` ext. ${s.phoneExt}` : ''}`],
          ['Sit with', reg.friendName],
          ['PAL course', reg.pal ? `${reg.pal.courseDate} with ${reg.pal.instructor}` : ''],
          ['Comments', reg.comments],
        ],
      },
      { button: { label: 'Open in the staff portal', url: `${siteUrl}/admin/registrations/${reg._id}` } },
    ],
  })
}

export function ownerNewMessage(message, { siteUrl }) {
  return renderEmail({
    subject: `New contact message from ${message.name}`,
    preheader: message.comments.slice(0, 90),
    blocks: [
      { details: [['From', message.name], ['Email', message.email]] },
      { p: message.comments },
      { button: { label: 'Open messages', url: `${siteUrl}/admin/messages` } },
      { small: 'Reply directly to the sender’s email address above.' },
    ],
  })
}

export function instructorRoster(weekend, roster, { siteUrl }) {
  const active = roster.filter((reg) => reg.status === 'paid' || reg.status === 'pending')
  const line = (reg) =>
    `${reg.student.familyName}, ${reg.student.firstName} — ${reg.packageTitle}` +
    `${reg.status === 'pending' ? ' (not paid yet)' : ''}${reg.hasGuide ? '' : ' · needs guide'}${reg.friendName ? ` · sit with ${reg.friendName}` : ''}`
  return renderEmail({
    subject: `Class list for ${weekend.label}: ${active.length} student${active.length === 1 ? '' : 's'}`,
    preheader: `${active.length} registered for ${weekend.label}.`,
    blocks: [
      { p: `Here is the class list for ${weekend.label} at ${location.name}.` },
      { list: active.length ? active.map(line) : ['Nobody is registered yet.'] },
      { button: { label: 'Open the class list', url: `${siteUrl}/admin/sessions/${weekend.id}` } },
      { small: 'The portal always has the latest list, including consent forms and a printable sign-in sheet.' },
    ],
  })
}
