// The contact form: messages are stored, emailed to the owner and shown in the staff portal.
import { OWNER_NOTIFY_EMAIL } from './env.js'
import { expect, test, waitForForms } from './fixtures.js'

test('a contact message reaches the owner and the staff portal', async ({ page, db, emails, signIn }) => {
  await page.goto('/contact')
  await waitForForms(page)
  const form = page.getByRole('form', { name: 'Contact form' })
  await form.getByLabel('Name').fill('Casey Contact')
  await form.getByLabel('Email').fill('casey@example.test')
  await form.getByLabel('Comments').fill('Do you have space in March?')
  await form.getByRole('button', { name: 'Send message' }).click()
  await expect(form.getByRole('status')).toContainText('Your message was sent')

  expect(await db.collection('messages').findOne({})).toMatchObject({ name: 'Casey Contact', email: 'casey@example.test', readAt: null })
  const [email] = await emails()
  expect(email.to).toEqual([OWNER_NOTIFY_EMAIL])
  expect(email.subject).toBe('New contact message from Casey Contact')

  await signIn('owner')
  await page.goto('/admin/messages')
  const message = page.getByRole('listitem').filter({ hasText: 'Casey Contact' })
  await expect(message).toContainText('Do you have space in March?')
  await message.getByRole('button', { name: 'Mark as read' }).click()
  await expect(page.getByRole('status')).toHaveText('Marked as read.')
  await expect(message).toContainText('Read by Olive Owner')
})

test('the contact form needs a message', async ({ page, db }) => {
  await page.goto('/contact')
  await waitForForms(page)
  const form = page.getByRole('form', { name: 'Contact form' })
  await form.getByLabel('Name').fill('Casey Contact')
  await form.getByLabel('Email').fill('casey@example.test')
  await form.getByRole('button', { name: 'Send message' }).click()
  // The browser blocks the empty required field, so nothing is sent.
  expect(await form.getByLabel('Comments').evaluate((field) => field.validity.valueMissing)).toBe(true)
  expect(await db.collection('messages').countDocuments()).toBe(0)
})
