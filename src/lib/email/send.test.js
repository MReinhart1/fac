import { beforeEach, describe, expect, it, vi } from 'vitest'

// sendEmail reads its settings from Astro's env module and logs to MongoDB; both are stand-ins here.
vi.mock('astro:env/server', () => ({
  EMAIL_FROM: 'Bookings <bookings@example.test>',
  EMAIL_REPLY_TO: '',
  RESEND_API_KEY: 're_test',
  RESEND_API_URL: 'https://resend.example.test',
}))
const logged = []
vi.mock('../db.js', () => ({ db: () => ({ collection: () => ({ insertOne: async (doc) => logged.push(doc) }) }) }))

const { sendEmail } = await import('./send.js')

const email = (overrides = {}) => ({ to: 'pat@example.test', template: 'payment-confirmed', subject: 'Hi', html: '<p>Hi</p>', text: 'Hi', ...overrides })
const calendar = { filename: 'firearms-course.ics', content: 'QkVHSU46VkNBTEVOREFS', content_type: 'text/calendar' }

let fetchMock
beforeEach(() => {
  logged.length = 0
  fetchMock = vi.fn(async () => Response.json({ id: 'email_1' }))
  vi.stubGlobal('fetch', fetchMock)
})

const sentBody = () => JSON.parse(fetchMock.mock.calls[0][1].body)

describe('sendEmail attachments', () => {
  it('passes attachments to Resend as given', async () => {
    expect(await sendEmail(email({ attachments: [calendar] }))).toBe('sent')
    expect(sentBody().attachments).toEqual([calendar])
  })

  it('logs attachment names only, never their contents', async () => {
    await sendEmail(email({ attachments: [calendar] }))
    expect(logged).toHaveLength(1)
    expect(logged[0]).toMatchObject({ status: 'sent', providerId: 'email_1', attachments: ['firearms-course.ics'] })
    expect(JSON.stringify(logged[0])).not.toContain(calendar.content)
  })

  it('leaves attachments out of the request and the log when there are none', async () => {
    await sendEmail(email())
    await sendEmail(email({ attachments: [] }))
    for (const [, init] of fetchMock.mock.calls) expect(JSON.parse(init.body)).not.toHaveProperty('attachments')
    for (const entry of logged) expect(entry).not.toHaveProperty('attachments')
  })

  it('still logs the attachment names when the email is skipped or fails', async () => {
    await sendEmail(email({ to: '', attachments: [calendar] }))
    fetchMock.mockResolvedValueOnce(Response.json({ message: 'Attachment too large' }, { status: 422 }))
    await sendEmail(email({ attachments: [calendar] }))
    expect(logged).toEqual([
      expect.objectContaining({ status: 'skipped', attachments: ['firearms-course.ics'] }),
      expect.objectContaining({ status: 'failed', error: 'Attachment too large', attachments: ['firearms-course.ics'] }),
    ])
  })
})
