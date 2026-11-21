// GET /admin/emails/preview/<template> — shows one email with sample data (owner only; /admin is signed-in only).
// Add ?format=text to see the plain-text version.
import { isOwner } from '../../../../lib/admin.js'
import { previews } from '../../../../lib/email/samples.js'

export const prerender = false

export function GET({ params, url, locals }) {
  if (!isOwner(locals.user)) return new Response('Only the owner can preview emails.', { status: 403 })
  const preview = previews(url.origin)[params.template ?? '']
  if (!preview) return new Response('No such email.', { status: 404 })
  const asText = url.searchParams.get('format') === 'text'
  return new Response(asText ? preview.email.text : preview.email.html, {
    headers: { 'Content-Type': `${asText ? 'text/plain' : 'text/html'}; charset=utf-8`, 'Cache-Control': 'no-store' },
  })
}
