// POST /api/contact — stores a contact-form message for the staff portal.
import { z } from 'astro/zod'
import { store } from '../../lib/db.js'
import { notifyContactMessage, safely } from '../../lib/email/notify.js'
import { errorResponse, firstIssue, json } from '../../lib/http.js'

export const prerender = false

const Message = z.object({
  realname: z.string({ error: 'Name is required.' }).trim().min(1, 'Name is required.').max(120),
  email: z.string().trim().toLowerCase().email('Please enter a valid email address.').max(200),
  comments: z.string({ error: 'Please write a message.' }).trim().min(1, 'Please write a message.').max(4000, 'Message is too long.'),
})

export async function POST({ request }) {
  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid request.' }, 400)
  }
  if (body?._gotcha) return json({ ok: true }, 200)
  const parsed = Message.safeParse(body)
  if (!parsed.success) return json({ error: firstIssue(parsed) }, 400)
  try {
    const message = await store().createMessage({ name: parsed.data.realname, email: parsed.data.email, comments: parsed.data.comments })
    await safely(notifyContactMessage(message))
    return json({ ok: true }, 201)
  } catch (error) {
    return errorResponse(error)
  }
}
