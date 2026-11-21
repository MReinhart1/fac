// Staff portal sign-in, sign-out, and what owners and instructors may see.
import { expect, staffId, test } from './fixtures.js'

test('the portal sends visitors to the sign-in page and back afterwards', async ({ page }) => {
  await page.goto('/admin/payments')
  await expect(page).toHaveURL('/admin/login?next=%2Fadmin%2Fpayments')
  await page.getByLabel('Email').fill('owner@e2e.test')
  await page.getByLabel('Password').fill('owner-e2e-password-1')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL('/admin/payments')
  await expect(page.getByRole('heading', { name: 'Payments', level: 1 })).toBeVisible()
})

test('a wrong password is refused', async ({ page }) => {
  await page.goto('/admin/login')
  await page.getByLabel('Email').fill('owner@e2e.test')
  await page.getByLabel('Password').fill('not-the-password')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('alert')).toHaveText('Wrong email or password.')
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/admin\/login/)
})

test('the sign-in page only returns to staff pages', async ({ page }) => {
  await page.goto('/admin/login?next=https://evil.example/steal')
  await page.getByLabel('Email').fill('owner@e2e.test')
  await page.getByLabel('Password').fill('owner-e2e-password-1')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL('/admin')
})

test('signing out ends the session', async ({ page, signIn }) => {
  await signIn('owner')
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL('/admin/login')
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/admin\/login/)
})

test('portal pages are not cached or indexed', async ({ page, signIn }) => {
  await signIn('owner')
  const response = await page.goto('/admin/sessions')
  expect(response.headers()['cache-control']).toBe('no-store')
  expect(response.headers()['x-robots-tag']).toBe('noindex')
})

test('the owner sees the whole portal', async ({ page, signIn, weekends, register }) => {
  await register(weekends.open)
  await signIn('owner')
  const nav = page.getByRole('navigation')
  for (const link of ['Dashboard', 'Course weekends', 'Payments', 'Messages', 'Emails']) {
    await expect(nav.getByRole('link', { name: link })).toBeVisible()
  }
  await expect(page.getByRole('link', { name: '1 unpaid registrations · $258.30 outstanding' })).toBeVisible()
})

test('instructors see only their own weekends and no money', async ({ page, db, signIn, weekends, register }) => {
  await register(weekends.open)
  await db.collection('courseSessions').updateOne({ startDate: weekends.open.startDate }, { $set: { instructorIds: [await staffId(db, 'instructor')] } })

  await signIn('instructor')
  await expect(page.getByRole('navigation').getByRole('link', { name: 'Payments' })).toHaveCount(0)
  await expect(page.getByText('outstanding')).toHaveCount(0)

  await page.goto('/admin/sessions')
  await expect(page.getByRole('link', { name: weekends.open.label })).toBeVisible()
  await expect(page.getByRole('link', { name: weekends.later.label })).toHaveCount(0)

  // Their class list shows the student and paid status, but not the amount or payment reference.
  await page.getByRole('link', { name: weekends.open.label }).click()
  await expect(page.getByRole('link', { name: 'Tester, Pat' })).toBeVisible()
  await expect(page.getByText('$258.30')).toHaveCount(0)

  // Owner-only pages and other weekends are refused.
  for (const path of ['/admin/payments', '/admin/messages', '/admin/emails', `/admin/sessions/${weekends.later.id}`]) {
    const response = await page.goto(path)
    expect(response.status(), path).toBe(403)
  }
})
