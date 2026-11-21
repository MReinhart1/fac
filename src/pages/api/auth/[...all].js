// Better Auth's own endpoints (sign-in, sign-out, session). Public sign-up is disabled in auth-config.js.
import { getAuth } from '../../../lib/auth.js'

export const prerender = false
export const ALL = ({ request }) => getAuth().handler(request)
