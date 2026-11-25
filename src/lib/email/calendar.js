// "Add to calendar" for course emails: a calendar file (.ics, opened by Apple Calendar, Outlook, Gmail and most others)
// and a Google Calendar link. The site does not publish class times, so each course day is an all-day event.
// Plain functions of their data, like the email templates, so they can be tested and previewed.
import { addDaysTo, weekendParts } from '../../data/dates.js'
import { LIVE_DOMAIN, location, phone, site } from '../../data/site.js'

/** The days this registration attends, from the site's schedule: CFSC on Saturday, CRFSC on Sunday. */
export function courseDays(reg) {
  const saturday = reg.startDate
  const sunday = addDaysTo(saturday, 1)
  if (reg.packageId === 'cfsc') return [{ date: saturday, course: 'CFSC' }]
  if (reg.packageId === 'package') return [{ date: saturday, course: 'CFSC' }, { date: sunday, course: 'CRFSC' }]
  return [{ date: sunday, course: 'CRFSC' }]
}

const compact = (date) => date.replaceAll('-', '')
const address = `${location.name}, ${location.address}`
const details = (reg) =>
  [
    `${reg.packageTitle}, ${weekendParts(reg.startDate).label}.`,
    `Payment reference: ${reg.reference}.`,
    'Bring your student guide if you have one. Electronic devices are not permitted in the classroom.',
    `Questions or running late: ${phone.display}.`,
  ].join('\n')

// Text values in a calendar file escape backslashes, semicolons, commas and line breaks.
const escapeText = (value) => String(value).replaceAll('\\', '\\\\').replaceAll(';', '\\;').replaceAll(',', '\\,').replaceAll('\n', '\\n')

// Lines longer than 75 bytes are folded: broken with CRLF and a leading space (RFC 5545).
function fold(line) {
  const bytes = new TextEncoder().encode(line)
  if (bytes.length <= 75) return line
  const parts = []
  let current = ''
  let size = 0
  for (const char of line) {
    const charSize = new TextEncoder().encode(char).length
    if (size + charSize > (parts.length ? 74 : 75)) {
      parts.push(current)
      current = ''
      size = 0
    }
    current += char
    size += charSize
  }
  parts.push(current)
  return parts.join('\r\n ')
}

/** The calendar file for a registration: one all-day event per course day. */
export function calendarFile(reg, { now = new Date() } = {}) {
  const stamp = now.toISOString().replaceAll(/[-:]/g, '').replace(/\.\d{3}/, '')
  // The same registration keeps the same event ids, so a calendar that receives a newer file (after a move) can
  // update the events instead of adding copies. SEQUENCE counts the moves.
  const sequence = (reg.moves ?? []).length
  const events = courseDays(reg).flatMap(({ date, course }, index) => [
    'BEGIN:VEVENT',
    `UID:${reg._id}-day${index + 1}@${LIVE_DOMAIN}`,
    `DTSTAMP:${stamp}`,
    `SEQUENCE:${sequence}`,
    `DTSTART;VALUE=DATE:${compact(date)}`,
    `DTEND;VALUE=DATE:${compact(addDaysTo(date, 1))}`,
    `SUMMARY:${escapeText(`${course} course, ${site.name}`)}`,
    `LOCATION:${escapeText(address)}`,
    `DESCRIPTION:${escapeText(details(reg))}`,
    'TRANSP:OPAQUE',
    'END:VEVENT',
  ])
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:-//${site.name}//Course registration//EN`, 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', ...events, 'END:VCALENDAR']
  return `${lines.map(fold).join('\r\n')}\r\n`
}

/** The calendar file as an email attachment (Resend takes base64 content). */
export function calendarAttachment(reg, options) {
  const bytes = new TextEncoder().encode(calendarFile(reg, options))
  let binary = ''
  for (const byte of bytes) binary += String.fromCodePoint(byte)
  return { filename: 'firearms-course.ics', content: btoa(binary), content_type: 'text/calendar; charset=utf-8; method=PUBLISH' }
}

/** A link that opens Google Calendar with the course filled in (all course days as one all-day event). */
export function googleCalendarLink(reg) {
  const days = courseDays(reg)
  const first = days[0].date
  const last = days.at(-1).date
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${days.map((day) => day.course).join(' & ')} course, ${site.name}`,
    dates: `${compact(first)}/${compact(addDaysTo(last, 1))}`,
    location: address,
    details: details(reg),
  })
  return `https://calendar.google.com/calendar/render?${params}`
}
