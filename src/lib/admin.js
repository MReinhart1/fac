// Helpers for staff portal pages.
import { isOwner, roleLabel } from './auth-config.js'
import { StoreError } from './store.js'

export { isOwner, roleLabel }

/** The signed-in staff member as the store records them in the audit log. */
export const actorOf = (user) => ({ id: user.id, name: user.name, role: user.role })

/** Read a POSTed form as a plain object (single values). */
export async function readForm(request) {
  const form = await request.formData()
  return Object.fromEntries([...form.entries()].map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]))
}

/** Redirect after a POST with a short message, so a reload never repeats the action. */
export const redirectWith = (redirect, path, message, kind = 'ok') => {
  const url = new URL(path, 'http://x')
  url.searchParams.set(kind, message)
  return redirect(url.pathname + url.search, 303)
}

/** For `.catch()` when loading a record: "not found" becomes null so the page can answer 404; other errors still throw. */
export function nullIfNotFound(error) {
  if (error instanceof StoreError && error.code === 'not_found') return null
  throw error
}

/** A course weekend's status as staff see it: an open weekend with no seats left shows as "full". */
export const weekendStatus = (weekend) => (weekend.full && weekend.status === 'open' ? 'full' : weekend.status)

/** A message the person can act on, or a generic one for unexpected errors (which are logged). */
export function messageFor(error) {
  if (error instanceof StoreError) return error.message
  console.error(error)
  return 'Something went wrong. Please try again.'
}

/**
 * Dollars typed by staff to cents; null when empty or unclear. Accepts "258.30", "$258.30", "1,258.30" (comma between
 * thousands) and "258,30" (French-style decimal comma). Anything else with a comma, like "12,34,56", is refused.
 */
export function centsFrom(value) {
  let clean = String(value ?? '').replace(/[$\s]/g, '')
  if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(clean)) clean = clean.replaceAll(',', '')
  else if (/^\d+,\d{1,2}$/.test(clean)) clean = clean.replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null
  return Math.round(Number(clean) * 100)
}

export const formatDateTime = (date) =>
  date
    ? new Intl.DateTimeFormat('en-CA', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Toronto' }).format(new Date(date))
    : ''

const STATUS = {
  pending: { label: 'Unpaid', tone: 'bg-cream text-maroon' },
  paid: { label: 'Paid', tone: 'bg-steel-soft text-navy' },
  cancelled: { label: 'Cancelled', tone: 'bg-navy/10 text-navy/70' },
}
export const statusOf = (status) => STATUS[status] ?? { label: status, tone: 'bg-navy/10 text-navy' }

/** All staff logins (owner only: uses the admin plugin with the owner's session). */
export async function listStaff(auth, headers) {
  const result = await auth.api.listUsers({ headers, query: { limit: 100, sortBy: 'name' } })
  return result.users ?? []
}

/** Can this user see this course weekend? Owners see all; instructors only weekends they are assigned to. */
export const canSee = (user, weekend) => isOwner(user) || weekend.instructorIds.includes(user.id)
