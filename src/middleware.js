// Runs for every server-rendered request.
// 1. Opens a request scope so database work gets its own client, closed when the response is ready
//    (Cloudflare Workers can't share connections between requests; see src/lib/request-scope.js).
// 2. Protects the staff portal: every /admin page except the login page needs a signed-in staff member.
import { defineMiddleware } from 'astro:middleware'
import { requestScope } from './lib/request-scope.js'

export const onRequest = defineMiddleware((context, next) => {
  if (context.isPrerendered) return next()
  const scope = { client: null, auth: null }
  return requestScope.run(scope, async () => {
    try {
      return await handle(context, next)
    } finally {
      if (scope.client) {
        const waitUntil = context.locals.cfContext?.waitUntil?.bind(context.locals.cfContext)
        // Better Auth checks its indexes in the background when it starts; give that a moment to finish
        // before closing. waitUntil lets the response go out first, so visitors don't wait for this.
        const grace = scope.auth && waitUntil ? 2000 : 0
        const closing = new Promise((resolve) => setTimeout(resolve, grace)).then(() => scope.client.close()).catch(() => {})
        if (waitUntil) waitUntil(closing)
        else await closing
      }
    }
  })
})

async function handle(context, next) {
  const { pathname } = context.url
  if (!pathname.startsWith('/admin')) return next()

  // Imported here so public pages never load the auth code.
  const { getAuth } = await import('./lib/auth.js')
  const result = await getAuth().api.getSession({ headers: context.request.headers })
  context.locals.user = result?.user ?? null

  if (pathname === '/admin/login') return next()
  if (!result?.user || result.user.banned) {
    return context.redirect(`/admin/login?next=${encodeURIComponent(pathname + context.url.search)}`)
  }
  const response = await next()
  response.headers.set('Cache-Control', 'no-store')
  response.headers.set('X-Robots-Tag', 'noindex')
  return response
}
