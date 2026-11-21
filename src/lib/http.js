import { StoreError } from './store.js'

export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers } })

const STATUS_FOR = { invalid: 400, not_found: 404, full: 409, conflict: 409, duplicate: 409 }

/** Turn an error into a JSON response; unexpected errors are logged and hidden from the visitor. */
export function errorResponse(error) {
  if (error instanceof StoreError) return json({ error: error.message, code: error.code }, STATUS_FOR[error.code] ?? 400)
  console.error(error)
  return json({ error: 'Something went wrong on our side.', code: 'server' }, 500)
}

/** First validation message from a zod error, worded for the visitor. */
export const firstIssue = (result) => result.error.issues[0]?.message ?? 'Please check the form and try again.'
