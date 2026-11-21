import { useState } from 'react'
import { phone } from '../../data/site.js'

// Name of the hidden spam-trap field. Real people never fill it.
export const HONEYPOT = '_gotcha'

const SENT_MESSAGE = 'Thank you. Your message was sent. Please allow about one business day for a reply.'

async function sendForm(endpoint, payload) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(body.error || 'failed')
    error.fromServer = Boolean(body.error) && response.status < 500
    throw error
  }
  return body
}

/**
 * Handles validation, sending and status for a form posting JSON to one of the site's /api endpoints.
 * `options.extra` adds fields to the payload (an object, or a function of the form data),
 * `options.validate(data)` returns an error message or null (the server checks again),
 * and `options.onSent(response)` runs after a successful send with the server's reply.
 */
export default function useFormSubmit(endpoint, { extra, validate, onSent } = {}) {
  const [status, setStatus] = useState({ state: 'idle', message: '' })

  const submit = async (event) => {
    event.preventDefault()
    const form = event.currentTarget
    const { [HONEYPOT]: trap, ...data } = Object.fromEntries(new FormData(form).entries())

    const succeed = (response) => {
      form.reset()
      onSent?.(response)
      setStatus({ state: 'sent', message: SENT_MESSAGE })
    }

    // Bots fill every field; quietly pretend it worked.
    if (trap) return succeed({})

    const problem = validate?.(data)
    if (problem) {
      setStatus({ state: 'error', message: problem })
      return
    }

    setStatus({ state: 'sending', message: '' })
    try {
      const payload = { ...data, ...(typeof extra === 'function' ? extra(data) : extra) }
      succeed(await sendForm(endpoint, payload))
    } catch (error) {
      setStatus({
        state: 'error',
        message: error.fromServer
          ? error.message
          : `Something went wrong sending the form. Please try again or call ${phone.display}.`,
      })
    }
  }

  return [status, submit]
}
