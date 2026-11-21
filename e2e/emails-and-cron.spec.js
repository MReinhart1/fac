// The email log and previews in the portal, and the hourly job's endpoint.
import { E2E } from './env.js'
import { expect, test } from './fixtures.js'

test('every email the site sends is listed in the email log', async ({ page, signIn, weekends, register }) => {
  await register(weekends.open)
  await signIn('owner')
  await page.goto('/admin/emails')
  await expect(page.getByRole('heading', { name: 'Email is set up' })).toBeVisible()
  const log = page.getByRole('table')
  await expect(log.getByRole('row').filter({ hasText: 'Registration received' })).toContainText('Sent')
  await expect(log.getByRole('row').filter({ hasText: 'New registration: Pat Tester' })).toContainText('Sent')
})

test('each email template has a working preview', async ({ page, signIn }) => {
  await signIn('owner')
  await page.goto('/admin/emails')
  const previews = page.getByRole('link', { name: 'Preview' })
  const count = await previews.count()
  expect(count).toBe(9)
  for (let i = 0; i < count; i += 1) {
    const href = await previews.nth(i).getAttribute('href')
    const response = await page.request.get(href)
    expect(response.status(), href).toBe(200)
    expect(await response.text(), href).toContain('Firearms Academy')
  }
})

test('the hourly job needs its secret', async ({ request }) => {
  expect((await request.get('/api/cron/hourly')).status()).toBe(401)
  expect((await request.get('/api/cron/hourly', { headers: { Authorization: 'Bearer wrong' } })).status()).toBe(401)
})

test('the hourly job only sends reminders and never touches seats', async ({ request, db, weekends, register }) => {
  await register(weekends.open)
  const response = await request.get('/api/cron/hourly', { headers: { Authorization: `Bearer ${E2E.cronSecret}` } })
  expect(response.status()).toBe(200)
  expect(Object.keys(await response.json()).sort()).toEqual(['classReminders', 'rosters'])
  expect((await db.collection('registrations').findOne({})).status).toBe('pending')
  expect((await db.collection('courseSessions').findOne({ startDate: weekends.open.startDate })).seatsTaken).toBe(1)
})
