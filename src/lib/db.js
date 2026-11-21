// The site's database handle. Uses Astro's server env, so it is only for site code (pages, API routes).
import { MONGODB_DB, MONGODB_URI } from 'astro:env/server'
import { createClient, getClient } from './mongo.js'
import { requestScope } from './request-scope.js'
import { createStore } from './store.js'

/** This request's client (created on first use, closed by the middleware); a shared one outside a request. */
export const client = () => {
  const scope = requestScope.getStore()
  if (!scope) return getClient(MONGODB_URI)
  return (scope.client ??= createClient(MONGODB_URI))
}
export const db = () => client().db(MONGODB_DB)

export const store = () => createStore(db(), client())
