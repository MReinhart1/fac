// Sends one email through Resend's REST API and records it in the email log, sent or not.
// Never throws: a failed email must not break a registration or a staff action.
import { EMAIL_FROM, EMAIL_REPLY_TO, RESEND_API_KEY, RESEND_API_URL } from 'astro:env/server'
import { db } from '../db.js'
import { COLLECTIONS } from '../mongo.js'

/**
 * @param {{ to: string | string[], template: string, subject: string, html: string, text: string,
 *           registrationId?: string, idempotencyKey?: string,
 *           attachments?: { filename: string, content: string, content_type?: string }[] }} email
 * @returns {Promise<'sent' | 'skipped' | 'failed'>}
 */
export async function sendEmail({ to, template, subject, html, text, registrationId, idempotencyKey, attachments }) {
  const recipients = (Array.isArray(to) ? to : [to]).filter(Boolean)
  const entry = { at: new Date(), to: recipients, template, subject, registrationId: registrationId ?? null }
  // The log keeps attachment names only, never their contents.
  if (attachments?.length) entry.attachments = attachments.map((file) => file.filename)

  let status = 'sent'
  let providerId = null
  let error = null
  if (!recipients.length) {
    status = 'skipped'
    error = 'No recipient address'
  } else if (!RESEND_API_KEY || !EMAIL_FROM) {
    status = 'skipped'
    error = 'Email is not set up (RESEND_API_KEY / EMAIL_FROM)'
  } else {
    try {
      const response = await fetch(`${RESEND_API_URL}/emails`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
          ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
        },
        body: JSON.stringify({
          from: EMAIL_FROM,
          to: recipients,
          subject,
          html,
          text,
          ...(EMAIL_REPLY_TO ? { reply_to: EMAIL_REPLY_TO } : {}),
          ...(attachments?.length ? { attachments } : {}),
          tags: [{ name: 'template', value: template.replaceAll(/[^a-zA-Z0-9_-]/g, '_') }],
        }),
        signal: AbortSignal.timeout(8000),
      })
      const body = await response.json().catch(() => ({}))
      if (response.ok) providerId = body.id ?? null
      else {
        status = 'failed'
        error = body.message || `Resend replied ${response.status}`
      }
    } catch (err) {
      status = 'failed'
      error = err?.name === 'TimeoutError' ? 'Resend did not answer in time' : String(err?.message ?? err)
    }
  }

  if (status !== 'sent') console.warn(`[email] ${template} to ${recipients.join(', ') || '(none)'}: ${status} — ${error}`)
  try {
    await db().collection(COLLECTIONS.emailLog).insertOne({ ...entry, status, providerId, error })
  } catch (logError) {
    console.error('[email] could not write the email log', logError)
  }
  return status
}
