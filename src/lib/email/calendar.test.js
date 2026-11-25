import { describe, expect, it } from 'vitest'
import { calendarAttachment, calendarFile, courseDays, googleCalendarLink } from './calendar.js'
import * as t from './templates.js'

const reg = (overrides = {}) => ({
  _id: 'abc123',
  reference: 'FAC-0116-SMITH-K7Q',
  startDate: '2027-01-16',
  packageId: 'package',
  packageTitle: 'CFSC & CRFSC complete course package',
  amountDueCents: 45_040,
  student: { firstName: 'Pat', familyName: 'Smith', email: 'pat@example.test' },
  ...overrides,
})

describe('courseDays', () => {
  it('follows the schedule: CFSC on Saturday, CRFSC on Sunday', () => {
    expect(courseDays(reg({ packageId: 'cfsc' }))).toEqual([{ date: '2027-01-16', course: 'CFSC' }])
    expect(courseDays(reg({ packageId: 'package' }))).toEqual([
      { date: '2027-01-16', course: 'CFSC' },
      { date: '2027-01-17', course: 'CRFSC' },
    ])
    expect(courseDays(reg({ packageId: 'crfsc' }))).toEqual([{ date: '2027-01-17', course: 'CRFSC' }])
    expect(courseDays(reg({ packageId: 'module' }))).toEqual([{ date: '2027-01-17', course: 'CRFSC' }])
  })

  it('handles a weekend across the end of a month', () => {
    expect(courseDays(reg({ startDate: '2027-07-31', packageId: 'crfsc' }))).toEqual([{ date: '2027-08-01', course: 'CRFSC' }])
  })
})

describe('calendarFile', () => {
  const ics = calendarFile(reg(), { now: new Date('2026-11-24T15:00:00Z') })

  it('has one all-day event per course day', () => {
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2)
    expect(ics).toContain('DTSTART;VALUE=DATE:20270116\r\nDTEND;VALUE=DATE:20270117')
    expect(ics).toContain('DTSTART;VALUE=DATE:20270117\r\nDTEND;VALUE=DATE:20270118')
    expect(ics).toContain('SUMMARY:CFSC course\\, Firearms Academy Canada')
    expect(ics).toContain('DTSTAMP:20261124T150000Z')
  })

  it('is a valid calendar file: CRLF line ends, escaped commas, no line over 75 bytes', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true)
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
    expect(ics).toContain('LOCATION:Legion Hall Branch 31\\, 1050 Weston Rd\\, York\\, ON M6N 3S2')
    for (const line of ics.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75)
    // Unfolding the long description gives the original text back.
    const unfolded = ics.replaceAll('\r\n ', '')
    expect(unfolded).toContain('Payment reference: FAC-0116-SMITH-K7Q.')
  })

  it('keeps the same event ids after a move, with a higher sequence, so calendars update rather than duplicate', () => {
    const moved = calendarFile(reg({ startDate: '2027-02-06', moves: [{ from: '2027-01-16', to: '2027-02-06' }] }))
    expect(moved).toContain('UID:abc123-day1@')
    expect(ics).toContain('UID:abc123-day1@')
    expect(moved).toContain('SEQUENCE:1')
    expect(ics).toContain('SEQUENCE:0')
  })
})

describe('calendarAttachment', () => {
  it('is the calendar file, base64-encoded, as Resend expects', () => {
    const attachment = calendarAttachment(reg())
    expect(attachment.filename).toBe('firearms-course.ics')
    expect(attachment.content_type).toContain('text/calendar')
    const decoded = new TextDecoder().decode(Uint8Array.from(atob(attachment.content), (c) => c.codePointAt(0)))
    expect(decoded).toContain('BEGIN:VCALENDAR')
  })
})

describe('googleCalendarLink', () => {
  it('opens Google Calendar with the course days, place and details filled in', () => {
    const url = new URL(googleCalendarLink(reg()))
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render')
    expect(url.searchParams.get('dates')).toBe('20270116/20270118')
    expect(url.searchParams.get('text')).toBe('CFSC & CRFSC course, Firearms Academy Canada')
    expect(url.searchParams.get('location')).toContain('1050 Weston Rd')
  })
})

describe('course emails', () => {
  it('attach the calendar file and show a Google Calendar button', () => {
    for (const email of [
      t.paymentConfirmed(reg(), { siteUrl: 'https://example.test' }),
      t.classReminder(reg()),
      t.registrationMoved(reg(), { fromStartDate: '2027-01-09' }),
    ]) {
      expect(email.attachments).toEqual([expect.objectContaining({ filename: 'firearms-course.ics' })])
      expect(email.html).toContain('calendar.google.com')
      expect(email.text).toContain('Add to Google Calendar')
    }
  })

  it('leave it off emails that are not about attending', () => {
    expect(t.registrationReceived(reg()).attachments).toBeUndefined()
    expect(t.registrationCancelled(reg(), {}).attachments).toBeUndefined()
  })
})

describe('calendar text', () => {
  const unfold = (ics) => ics.replaceAll('\r\n ', '')

  it('escapes semicolons, backslashes and line breaks in text values', () => {
    const ics = unfold(calendarFile(reg({ packageTitle: 'Course; part \\ two' })))
    expect(ics).toContain('DESCRIPTION:Course\\; part \\\\ two\\, ')
    // The description's lines become escaped \n, so the event stays on one (unfolded) line.
    expect(ics).toMatch(/DESCRIPTION:[^\r\n]*\\nPayment reference: FAC-0116-SMITH-K7Q\.\\n/)
  })

  it('folds long lines without splitting a multi-byte character', () => {
    const title = 'Cours complet de sécurité – armes à feu à autorisation restreinte, édition spéciale'
    const ics = calendarFile(reg({ packageTitle: title }))
    for (const line of ics.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75)
    // Unfolding gives every character back whole.
    expect(unfold(ics)).toContain(title.replaceAll(',', '\\,'))
  })

  it('gives each course day its own event id', () => {
    const uids = calendarFile(reg()).match(/^UID:.*$/gm)
    expect(uids).toEqual([expect.stringMatching(/^UID:abc123-day1@/), expect.stringMatching(/^UID:abc123-day2@/)])
  })
})

describe('calendarAttachment encoding', () => {
  it('keeps accented characters intact (UTF-8, then base64)', () => {
    const attachment = calendarAttachment(reg({ packageTitle: 'Cours de sécurité' }))
    const decoded = new TextDecoder().decode(Uint8Array.from(atob(attachment.content), (c) => c.codePointAt(0)))
    expect(decoded.replaceAll('\r\n ', '')).toContain('Cours de sécurité')
  })
})

describe('googleCalendarLink for one-day courses', () => {
  it.each([
    ['cfsc', '20270116/20270117', 'CFSC course, Firearms Academy Canada'],
    ['crfsc', '20270117/20270118', 'CRFSC course, Firearms Academy Canada'],
  ])('%s covers just its day', (packageId, dates, text) => {
    const url = new URL(googleCalendarLink(reg({ packageId })))
    expect(url.searchParams.get('dates')).toBe(dates)
    expect(url.searchParams.get('text')).toBe(text)
  })

  it('ends on the right day across a month end', () => {
    const url = new URL(googleCalendarLink(reg({ startDate: '2027-07-31', packageId: 'package' })))
    expect(url.searchParams.get('dates')).toBe('20270731/20270802')
  })
})
