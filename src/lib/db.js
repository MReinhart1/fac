// The site's database handle. Uses Astro's server env, so it is only for site code (pages, API routes).
import { MONGODB_DB, MONGODB_URI } from 'astro:env/server'
import { COLLECTIONS, createClient, getClient } from './mongo.js'
import { requestScope } from './request-scope.js'
import { createStore } from './store.js'

/** This request's client (created on first use, closed by the middleware); a shared one outside a request. */
export const client = () => {
  const scope = requestScope.getStore()
  if (!scope) return getClient(MONGODB_URI)
  return (scope.client ??= createClient(MONGODB_URI))
}
export const db = () => client().db(MONGODB_DB)

export const collections = () => {
  const d = db()
  return {
    courseSessions: d.collection(COLLECTIONS.courseSessions),
    registrations: d.collection(COLLECTIONS.registrations),
    messages: d.collection(COLLECTIONS.messages),
    auditLog: d.collection(COLLECTIONS.auditLog),
    emailLog: d.collection(COLLECTIONS.emailLog),
  }
}

export const store = () => createStore(db(), client())
