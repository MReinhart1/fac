import { describe, expect, it } from 'vitest'
import { booking, etransfer } from '../../data/site.js'
import { renderEmail } from './layout.js'
import * as t from './templates.js'

const reg = (overrides = {}) => ({
  _id: 'abc123',
  reference: 'FAC-0116-SMITH-K7Q',
  startDate: '2027-01-16',
  packageId: 'cfsc',
  packageTitle: 'CFSC course package',
  amountDueCents: 25_830,
  hasGuide: false,
  status: 'pending',
  student: { firstName: 'Pat', familyName: 'Smith', nickname: '', email: 'pat@example.test', phone: '416-555-0100', phoneExt: '' },
  friendName: '',
  comments: '',
  pal: null,
  ...overrides,
})

describe('registration received', () => {
  const email = t.registrationReceived(reg())

  it('puts the amount, the reference and the payment deadline in front of the student', () => {
    expect(email.subject).toContain('FAC-0116-SMITH-K7Q')
    expect(email.text).toContain('$258.30')
    expect(email.text).toContain('FAC-0116-SMITH-K7Q')
    expect(email.text).toContain(`within ${booking.payWithinHours} hours`)
    expect(email.text).toContain('January 16/17, 2027')
  })

  it('explains where to send the e-Transfer, or that the address will follow', () => {
    expect(email.text).toContain(etransfer.email || 'We will send you the e-Transfer address in a separate email')
  })
})

describe('registration cancelled', () => {
  it('mentions a refund only when one was given', () => {
    expect(t.registrationCancelled(reg(), { refundCents: 15_830 }).text).toContain('A refund of $158.30 is on its way.')
    expect(t.registrationCancelled(reg(), { refundCents: 0 }).text).not.toContain('refund')
  })

  it('tells an unpaid student why they were removed', () => {
    const text = t.registrationCancelled(reg({ cancelReason: t.UNPAID_REASON }), {}).text
    expect(text).toContain('We did not receive your payment')
    expect(t.registrationCancelled(reg({ cancelReason: 'Asked to cancel' }), {}).text).not.toContain('did not receive your payment')
  })
})

describe('instructor class list', () => {
  const roster = [
    reg({ status: 'paid', student: { ...reg().student, firstName: 'Ada', familyName: 'Lee' }, hasGuide: true }),
    reg({ status: 'pending', student: { ...reg().student, firstName: 'Bo', familyName: 'Kim' }, friendName: 'Ada Lee' }),
    reg({ status: 'cancelled', student: { ...reg().student, firstName: 'Cy', familyName: 'Gone' } }),
  ]
  const email = t.instructorRoster({ id: 'w1', label: 'January 16/17, 2027' }, roster, { siteUrl: 'https://example.test' })

  it('lists only students who still have a seat', () => {
    expect(email.subject).toBe('Class list for January 16/17, 2027: 2 students')
    expect(email.text).toContain('Lee, Ada')
    expect(email.text).not.toContain('Gone, Cy')
  })

  it('flags unpaid students, guide needs and seating requests', () => {
    expect(email.text).toContain('Kim, Bo — CFSC course package (not paid yet) · needs guide · sit with Ada Lee')
    expect(email.text).toContain('Lee, Ada — CFSC course package\n')
  })

  it('handles an empty class', () => {
    const empty = t.instructorRoster({ id: 'w1', label: 'January 16/17, 2027' }, [], { siteUrl: 'https://example.test' })
    expect(empty.subject).toBe('Class list for January 16/17, 2027: 0 students')
    expect(empty.text).toContain('Nobody is registered yet.')
  })
})

describe('scheduleFor', () => {
  it('says which days each package attends', () => {
    expect(t.scheduleFor('cfsc')).toBe('Saturday (CFSC)')
    expect(t.scheduleFor('package')).toBe('Saturday (CFSC) and Sunday (CRFSC)')
    expect(t.scheduleFor('crfsc')).toBe('Sunday (CRFSC)')
    expect(t.scheduleFor('module')).toBe('Sunday (CRFSC)')
  })
})

describe('renderEmail', () => {
  it('escapes anything a visitor typed, so it cannot inject HTML', () => {
    const email = t.ownerNewMessage(
      { name: '<script>alert(1)</script>', email: 'x@example.test', comments: 'Hi <b>there</b> & "you"' },
      { siteUrl: 'https://example.test' },
    )
    expect(email.html).not.toContain('<script>')
    expect(email.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(email.html).toContain('Hi &lt;b&gt;there&lt;/b&gt; &amp; &quot;you&quot;')
    // The plain-text version keeps the words exactly as typed.
    expect(email.text).toContain('Hi <b>there</b> & "you"')
  })

  it('escapes button links', () => {
    const { html } = renderEmail({ subject: 'x', blocks: [{ button: { label: 'Go', url: 'https://example.test/?a="b"' } }] })
    expect(html).toContain('href="https://example.test/?a=&quot;b&quot;"')
  })

  it('leaves out empty detail rows', () => {
    const { text } = renderEmail({ subject: 'x', blocks: [{ details: [['Shown', 'yes'], ['Empty', ''], ['Missing', null]] }] })
    expect(text).toContain('Shown: yes')
    expect(text).not.toContain('Empty')
    expect(text).not.toContain('Missing')
  })
})
