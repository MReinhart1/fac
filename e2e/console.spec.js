// Every page loads without browser errors or warnings (failed requests, script errors, React hydration problems…).
import { expect, test } from './fixtures.js'

const PUBLIC_PAGES = ['/', '/dates', '/pricing', '/locations', '/hunter-education', '/faq', '/contact', '/register', '/certified', '/consent', '/links', '/privacy']
const STAFF_PAGES = ['/admin', '/admin/sessions', '/admin/payments', '/admin/messages', '/admin/emails']

function watchConsole(page) {
  const problems = []
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') problems.push(`${message.type()}: ${message.text()}`)
  })
  page.on('pageerror', (error) => problems.push(`uncaught: ${error.message}`))
  page.on('requestfailed', (request) => {
    // Third-party embeds (the Google map) may be blocked or slow in tests; anything from the site itself must load.
    if (new URL(request.url()).hostname === '127.0.0.1') problems.push(`request failed: ${request.url()} (${request.failure()?.errorText})`)
  })
  return problems
}

test('public pages have no console errors or warnings', async ({ page }) => {
  const problems = watchConsole(page)
  for (const path of PUBLIC_PAGES) {
    await page.goto(path)
    await page.waitForLoadState('networkidle')
  }
  expect(problems).toEqual([])
})

test('staff pages have no console errors or warnings', async ({ page, signIn, weekends, register }) => {
  const { id } = await register(weekends.open)
  await signIn('owner')
  const problems = watchConsole(page)
  for (const path of [...STAFF_PAGES, `/admin/sessions/${weekends.open.id}`, `/admin/registrations/${id}`]) {
    await page.goto(path)
    await page.waitForLoadState('networkidle')
  }
  expect(problems).toEqual([])
})
