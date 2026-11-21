// One database client (and login instance) per incoming request.
// Cloudflare Workers do not allow a network connection opened during one request to be used by another,
// so the site cannot keep a single shared MongoDB client the way a Node server would. The middleware
// opens a scope per request; src/lib/db.js and src/lib/auth.js create what they need inside it, and the
// middleware closes the client once the response is ready.
import { AsyncLocalStorage } from 'node:async_hooks'

export const requestScope = new AsyncLocalStorage()
