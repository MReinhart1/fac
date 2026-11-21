// Accessibility checks with axe-core: WCAG 2.0, 2.1 and 2.2 (levels A and AA) plus axe's best-practice rules, on every
// page and in the states people actually see (open menu, form errors, confirmations, staff messages). Runs at desktop
// and phone size. Automated checks find roughly half of all accessibility problems; the rest still need a person.
import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, waitForForms } from './fixtures.js'

const PUBLIC_PAGES = ['/', '/dates', '/pricing', '/locations', '/hunter-education', '/faq', '/contact', '/register', '/certified', '/consent', '/links', '/privacy', '/no-such-page']

async function violations(page, where = '') {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa', 'best-practice'])
    // The Google map is Google's own page in a frame; it is not ours to fix.
    .exclude('iframe[src*="google.com/maps"]')
    .analyze()
  return results.violations.map(
    (v) => `${where}${v.id} (${v.impact}): ${v.help} — ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`,
  )
}

for (const path of PUBLIC_PAGES) {
  test(`${path} passes the accessibility check`, async ({ page }) => {
    await page.goto(path)
    await waitForForms(page)
    expect(await violations(page)).toEqual([])
  })
}

test('the open mobile menu passes the accessibility check', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Menu' }).click()
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Menu' })).toHaveAttribute('aria-expanded', 'true')
  expect(await violations(page)).toEqual([])
  // Escape closes it and returns focus to the button.
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Menu' })).toBeFocused()
  await expect(page.getByRole('button', { name: 'Menu' })).toHaveAttribute('aria-expanded', 'false')
})

test('form messages pass the accessibility check', async ({ page, weekends }) => {
  const problems = []

  // Registration: an error message, the PAL fields, then the confirmation.
  await page.goto(`/register?course=cfsc&date=${weekends.open.startDate}`)
  await waitForForms(page)
  await page.getByLabel('First name').fill('Pat')
  await page.getByLabel('Family name').fill('Tester')
  await page.getByLabel('Daytime / primary phone').fill('416-555-0100')
  await page.getByLabel('Email address', { exact: true }).fill('pat@example.test')
  await page.getByLabel('Confirm email address').fill('typo@example.test')
  await page.getByLabel('I have read and agree to the policy').check()
  await page.getByRole('button', { name: 'Submit registration' }).click()
  await expect(page.getByRole('status')).toHaveText('The email addresses do not match.')
  problems.push(...(await violations(page, 'register error: ')))

  await page.getByLabel(/^CRFSC \(/).check()
  await expect(page.getByLabel('Date you completed the PAL course')).toBeVisible()
  problems.push(...(await violations(page, 'register PAL fields: ')))

  await page.getByLabel(/CFSC course package/).check()
  await page.getByLabel('Confirm email address').fill('pat@example.test')
  await page.getByRole('button', { name: 'Submit registration' }).click()
  await expect(page.getByText('Registration received, Pat')).toBeVisible()
  problems.push(...(await violations(page, 'register confirmation: ')))

  // Contact: the success message.
  await page.goto('/contact')
  await waitForForms(page)
  const form = page.getByRole('form', { name: 'Contact form' })
  await form.getByLabel('Name').fill('Casey Contact')
  await form.getByLabel('Email').fill('casey@example.test')
  await form.getByLabel('Comments').fill('A question about dates.')
  await form.getByRole('button', { name: 'Send message' }).click()
  await expect(form.getByRole('status')).toContainText('Your message was sent')
  problems.push(...(await violations(page, 'contact sent: ')))

  expect(problems).toEqual([])
})

test('the "Skip to content" link is the first thing the keyboard reaches', async ({ page }) => {
  await page.goto('/faq')
  await page.keyboard.press('Tab')
  const skip = page.getByRole('link', { name: 'Skip to content' })
  await expect(skip).toBeFocused()
  await expect(skip).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/#main$/)
})

test('the staff portal passes the accessibility check', async ({ page, request, signIn, weekends, register }) => {
  const { id } = await register(weekends.open)
  await request.post('/api/contact', { data: { realname: 'Casey Contact', email: 'casey@example.test', comments: 'Hello' } })
  const problems = []

  // Sign-in page, also with its error message.
  await page.goto('/admin/login')
  problems.push(...(await violations(page, '/admin/login: ')))
  await page.getByLabel('Email').fill('owner@e2e.test')
  await page.getByLabel('Password').fill('wrong-password')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  problems.push(...(await violations(page, '/admin/login error: ')))

  await signIn('owner')
  for (const path of ['/admin', '/admin/sessions', `/admin/sessions/${weekends.open.id}`, `/admin/registrations/${id}`, '/admin/payments', '/admin/messages', '/admin/emails']) {
    await page.goto(path)
    problems.push(...(await violations(page, `${path}: `)))
  }

  // Success and error messages after staff actions, and an expanded section.
  await page.goto(`/admin/sessions/${weekends.open.id}`)
  await page.getByText('Edit weekend').click()
  problems.push(...(await violations(page, 'edit weekend open: ')))
  await page.getByLabel('Seats').fill('0')
  await page.getByLabel('Seats').evaluate((input) => input.removeAttribute('min'))
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  problems.push(...(await violations(page, 'staff error message: ')))
  await page.goto('/admin/payments')
  await page.getByRole('row').filter({ hasText: 'Tester, Pat' }).getByRole('button', { name: 'Mark paid' }).click()
  await expect(page.getByRole('status')).toBeVisible()
  problems.push(...(await violations(page, 'staff success message: ')))

  expect(problems).toEqual([])
})

test('the instructor view passes the accessibility check', async ({ page, db, signIn, weekends, register }) => {
  const { id } = await register(weekends.open)
  const instructor = await db.collection('user').findOne({ email: 'instructor@e2e.test' })
  await db.collection('courseSessions').updateOne({ startDate: weekends.open.startDate }, { $set: { instructorIds: [instructor._id.toString()] } })
  await signIn('instructor')
  const problems = []
  for (const path of ['/admin', '/admin/sessions', `/admin/sessions/${weekends.open.id}`, `/admin/registrations/${id}`]) {
    await page.goto(path)
    problems.push(...(await violations(page, `${path}: `)))
  }
  expect(problems).toEqual([])
})

