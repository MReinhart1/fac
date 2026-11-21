// The site's Better Auth instance (server only), one per request because it holds that request's database client.
import { BETTER_AUTH_SECRET, BETTER_AUTH_URL } from 'astro:env/server'
import { createAuth } from './auth-config.js'
import { client, db } from './db.js'
import { requestScope } from './request-scope.js'

const build = () => createAuth({ db: db(), client: client(), secret: BETTER_AUTH_SECRET, baseURL: BETTER_AUTH_URL })

export function getAuth() {
  const scope = requestScope.getStore()
  if (!scope) return build()
  return (scope.auth ??= build())
}
