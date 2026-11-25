// The site's database handle. Uses Astro's server env, so it is only for site code (pages, API routes).
import { MONGODB_DB, MONGODB_URI } from 'astro:env/server'
import { LIVE_DATABASE, TEST_DATABASE } from './databases.js'
import { createClient, getClient } from './mongo.js'
import { requestScope } from './request-scope.js'
import { createStore } from './store.js'

/** This request's client (created on first use, closed by the middleware); a shared one outside a request. */
export const client = () => {
  const scope = requestScope.getStore()
  if (!scope) return getClient(MONGODB_URI)
  return (scope.client ??= createClient(MONGODB_URI))
}
export const db = () => {
  // `npm run dev` never touches live data (see databases.js). The live site gets MONGODB_DB=fac from its deploy.
  if (import.meta.env.DEV && MONGODB_DB === LIVE_DATABASE) {
    throw new Error(`npm run dev refuses the live database ("${LIVE_DATABASE}"). Set MONGODB_DB=${TEST_DATABASE} in .env.`)
  }
  return client().db(MONGODB_DB)
}

export const store = () => createStore(db(), client())
