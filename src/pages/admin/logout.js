// POST /admin/logout — ends the staff session and returns to the sign-in page.
import { getAuth } from '../../lib/auth.js'

export const prerender = false

export async function POST({ request }) {
  const result = await getAuth().api.signOut({ headers: request.headers, asResponse: true })
  const headers = new Headers({ Location: '/admin/login' })
  for (const cookie of result.headers.getSetCookie()) headers.append('Set-Cookie', cookie)
  return new Response(null, { status: 303, headers })
}
