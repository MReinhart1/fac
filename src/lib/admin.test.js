import { describe, expect, it, vi } from 'vitest'
import { canSee, centsFrom, messageFor, nullIfNotFound, redirectWith, statusOf, weekendStatus } from './admin.js'
import { ROLES } from './auth-config.js'
import { errorResponse, firstIssue } from './http.js'
import { StoreError } from './store.js'

describe('centsFrom', () => {
  it.each([
    ['258.30', 25830],
    ['258.3', 25830],
    ['$258.30', 25830],
    ['1,258.30', 125830],
    [' 200 ', 20000],
    ['19.99', 1999],
    ['0', 0],
    ['1,250', 125000],
    // A French-style decimal comma is a decimal point, not a thousands separator.
    ['258,30', 25830],
    ['158,3', 15830],
  ])('reads %j as %i cents', (typed, cents) => expect(centsFrom(typed)).toBe(cents))

  it.each(['', null, undefined, 'abc', '12.345', '-5', '1.2.3', '12,34,56', '1,25.00', ',50'])('refuses %j', (typed) => expect(centsFrom(typed)).toBeNull())
})

describe('redirectWith', () => {
  const redirect = (url, status) => ({ url, status })

  it('redirects with a 303 and the message in the address', () => {
    expect(redirectWith(redirect, '/admin/payments', 'Marked paid; email sent.')).toEqual({
      url: '/admin/payments?ok=Marked+paid%3B+email+sent.',
      status: 303,
    })
  })

  it('marks errors so the page shows them as alerts', () => {
    expect(redirectWith(redirect, '/admin/sessions', 'Pick a Saturday.', 'error').url).toBe('/admin/sessions?error=Pick+a+Saturday.')
  })

  it('cannot be turned into a redirect to another site', () => {
    expect(redirectWith(redirect, '//evil.example/x', 'hi').url).toBe('/x?ok=hi')
  })
})

describe('messageFor', () => {
  it('shows a store error as written', () => {
    expect(messageFor(new StoreError('full', 'That weekend is full.'))).toBe('That weekend is full.')
  })

  it('hides unexpected errors behind a generic message and logs them', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(messageFor(new Error('connection string leaked'))).toBe('Something went wrong. Please try again.')
    expect(log).toHaveBeenCalled()
    log.mockRestore()
  })
})

describe('nullIfNotFound', () => {
  it('turns "not found" into null', () => {
    expect(nullIfNotFound(new StoreError('not_found', 'Not found.'))).toBeNull()
  })

  it('lets other errors through', () => {
    expect(() => nullIfNotFound(new StoreError('conflict', 'Changed.'))).toThrow('Changed.')
    expect(() => nullIfNotFound(new Error('database down'))).toThrow('database down')
  })
})

describe('statusOf and weekendStatus', () => {
  it('labels registration statuses for staff', () => {
    expect(statusOf('pending').label).toBe('Unpaid')
    expect(statusOf('paid').label).toBe('Paid')
    expect(statusOf('cancelled').label).toBe('Cancelled')
    expect(statusOf('mystery').label).toBe('mystery')
  })

  it('shows an open weekend with no seats left as full', () => {
    expect(weekendStatus({ status: 'open', full: true })).toBe('full')
    expect(weekendStatus({ status: 'open', full: false })).toBe('open')
    expect(weekendStatus({ status: 'closed', full: true })).toBe('closed')
  })
})

describe('canSee', () => {
  const weekend = { instructorIds: ['ian'] }

  it('lets the owner see every weekend', () => {
    expect(canSee({ id: 'olive', role: ROLES.owner }, weekend)).toBe(true)
  })

  it('lets instructors see only the weekends they teach', () => {
    expect(canSee({ id: 'ian', role: ROLES.instructor }, weekend)).toBe(true)
    expect(canSee({ id: 'sam', role: ROLES.instructor }, weekend)).toBe(false)
  })
})

describe('API error responses', () => {
  it('maps store errors to HTTP statuses', async () => {
    const full = errorResponse(new StoreError('full', 'Sorry, that date just filled up.'))
    expect(full.status).toBe(409)
    expect(await full.json()).toEqual({ error: 'Sorry, that date just filled up.', code: 'full' })
    expect(errorResponse(new StoreError('not_found', 'Gone.')).status).toBe(404)
    expect(errorResponse(new StoreError('invalid', 'Bad.')).status).toBe(400)
  })

  it('never shows visitors the details of an unexpected error', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const response = errorResponse(new Error('MongoServerError: auth failed for user fac'))
    expect(response.status).toBe(500)
    expect(await response.text()).not.toContain('Mongo')
    log.mockRestore()
  })

  it('reports the first validation problem', () => {
    expect(firstIssue({ error: { issues: [{ message: 'First name is required.' }, { message: 'Phone is required.' }] } })).toBe('First name is required.')
    expect(firstIssue({ error: { issues: [] } })).toBe('Please check the form and try again.')
  })
})
