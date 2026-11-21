// Public pages: navigation, live course dates, old URLs and the 404 page.
import { expect, test } from './fixtures.js'

test('home page shows the upcoming course dates from the database', async ({ page, weekends }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  const upcoming = page.locator('section', { has: page.getByRole('heading', { name: 'Upcoming course dates' }) })
  await expect(upcoming.getByText(weekends.open.label)).toBeVisible()
  await expect(upcoming.getByText(weekends.later.label)).toBeVisible()
})

test('dates page marks open weekends Available and closed ones Full', async ({ page, weekends }) => {
  await page.goto('/dates')
  const row = (weekend) => page.locator('li', { hasText: weekend.label })
  await expect(row(weekends.open).getByRole('link', { name: 'Available' })).toHaveAttribute('href', `/register?date=${weekends.open.startDate}`)
  await expect(row(weekends.closed).getByText('Full')).toBeVisible()
  // The one-seat weekend warns that seats are running out.
  await expect(row(weekends.small)).toContainText('1 seat left')
})

test('a weekend that fills up shows as Full', async ({ page, weekends, register }) => {
  await register(weekends.small)
  await page.goto('/dates')
  await expect(page.locator('li', { hasText: weekends.small.label }).getByText('Full')).toBeVisible()
})

test('main navigation reaches every section', async ({ page }) => {
  await page.goto('/')
  const nav = page.locator('#main-nav')
  for (const [label, path] of [
    ['Dates', '/dates'],
    ['Pricing', '/pricing'],
    ['Location', '/locations'],
    ['Hunter Ed', '/hunter-education'],
    ['FAQ', '/faq'],
    ['Contact', '/contact'],
  ]) {
    await nav.getByRole('link', { name: label, exact: true }).click()
    await expect(page).toHaveURL(path)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  }
})

test('old .php addresses redirect permanently to the new pages', async ({ request }) => {
  for (const [from, to] of [
    ['/index.php', '/'],
    ['/dates.php', '/dates'],
    ['/register.php', '/register'],
    ['/ohep.php', '/hunter-education'],
    ['/consent-form-2019.pdf', '/consent'],
  ]) {
    const response = await request.get(from, { maxRedirects: 0 })
    expect(response.status(), from).toBe(301)
    expect(new URL(response.headers().location, 'http://x').pathname, from).toBe(to)
  }
})

test('unknown pages return the 404 page', async ({ page }) => {
  const response = await page.goto('/no-such-page')
  expect(response.status()).toBe(404)
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
})
