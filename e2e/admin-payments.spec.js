// Payments: finding a reference, marking paid, and removing students who have not paid.
import { expect, test } from './fixtures.js'

const unpaidRow = (page, name) => page.getByRole('row').filter({ hasText: name })

test('unpaid students keep their seat until the owner acts', async ({ page, db, signIn, weekends, register }) => {
  await register(weekends.open)
  // Even long after registering, nothing releases the seat on its own.
  await db.collection('registrations').updateOne({}, { $set: { createdAt: new Date(Date.now() - 30 * 86_400_000) } })

  await signIn('owner')
  await page.goto('/admin/payments')
  await expect(page.getByRole('heading', { name: 'Unpaid registrations (1)' })).toBeVisible()
  await expect(unpaidRow(page, 'Tester, Pat')).toBeVisible()
  const weekend = await db.collection('courseSessions').findOne({ startDate: weekends.open.startDate })
  expect(weekend.seatsTaken).toBe(1)
})

test('"Mark paid" records the payment and emails the confirmation', async ({ page, db, emails, signIn, weekends, register }) => {
  const { reference } = await register(weekends.open)
  await signIn('owner')
  await page.goto('/admin/payments')
  await unpaidRow(page, 'Tester, Pat').getByRole('button', { name: 'Mark paid' }).click()

  await expect(page.getByRole('status')).toHaveText(`${reference} marked paid; confirmation emailed.`)
  await expect(page.getByRole('heading', { name: 'Unpaid registrations (0)' })).toBeVisible()
  const reg = await db.collection('registrations').findOne({ reference })
  expect(reg.status).toBe('paid')
  expect(reg.payments).toEqual([expect.objectContaining({ kind: 'payment', method: 'e-Transfer', amountCents: 25830 })])
  const confirmation = (await emails()).find((email) => email.subject.startsWith("You're confirmed"))
  expect(confirmation.to).toEqual(['pat@example.test'])
})

test('"Remove" cancels an unpaid registration, frees the seat and tells the student', async ({ page, db, emails, signIn, weekends, register }) => {
  const { reference } = await register(weekends.small)
  await signIn('owner')
  await page.goto('/admin/payments')

  page.once('dialog', (dialog) => {
    expect(dialog.message()).toContain(`Remove Pat Tester from ${weekends.small.label}?`)
    dialog.accept()
  })
  await unpaidRow(page, 'Tester, Pat').getByRole('button', { name: 'Remove' }).click()

  await expect(page.getByRole('status')).toHaveText('Pat Tester removed; seat freed and student emailed.')
  const reg = await db.collection('registrations').findOne({ reference })
  expect(reg).toMatchObject({ status: 'cancelled', cancelReason: 'Not paid' })
  const weekend = await db.collection('courseSessions').findOne({ startDate: weekends.small.startDate })
  expect(weekend.seatsTaken).toBe(0)
  const notice = (await emails()).find((email) => email.subject.startsWith('Registration cancelled'))
  expect(notice.to).toEqual(['pat@example.test'])
  expect(notice.text).toContain('We did not receive your payment')

  // The freed seat can be booked again straight away.
  await register(weekends.small, { familyName: 'Next' })
})

test('cancelling the "Remove" prompt changes nothing', async ({ page, db, signIn, weekends, register }) => {
  await register(weekends.open)
  await signIn('owner')
  await page.goto('/admin/payments')
  page.once('dialog', (dialog) => dialog.dismiss())
  await unpaidRow(page, 'Tester, Pat').getByRole('button', { name: 'Remove' }).click()
  await expect(unpaidRow(page, 'Tester, Pat')).toBeVisible()
  expect((await db.collection('registrations').findOne({})).status).toBe('pending')
})

test('a payment reference can be looked up', async ({ page, signIn, weekends, register }) => {
  const { reference } = await register(weekends.open)
  await signIn('owner')
  // The dashboard search box goes to the payments page.
  await page.getByLabel('Find a payment reference').fill(reference.toLowerCase())
  await page.getByRole('button', { name: 'Find' }).click()
  await expect(page).toHaveURL(/\/admin\/payments\?ref=/)
  await expect(page.getByRole('link', { name: 'Pat Tester' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Record payment' })).toBeVisible()

  await page.getByLabel('Payment reference from the e-Transfer message').fill('FAC-0000-NOBODY-XXX')
  await page.getByRole('button', { name: 'Find' }).click()
  await expect(page.getByText('No registration has the reference')).toBeVisible()
})

test('a cash payment of a different amount is recorded without an email', async ({ page, db, emails, signIn, weekends, register }) => {
  const { id } = await register(weekends.open)
  await signIn('owner')
  await page.goto(`/admin/registrations/${id}`)
  await page.getByLabel('Method').selectOption('Cash')
  await page.getByLabel('Amount received ($)').fill('200')
  await page.getByLabel('Note (optional)').fill('Paid at the door')
  await page.getByLabel('Email the student their course confirmation').uncheck()
  await page.getByRole('button', { name: 'Mark paid' }).click()

  await expect(page.getByRole('status')).toHaveText('Payment recorded.')
  const reg = await db.collection('registrations').findOne({})
  expect(reg.payments).toEqual([expect.objectContaining({ method: 'Cash', amountCents: 20000, note: 'Paid at the door' })])
  expect((await emails()).filter((email) => email.subject.startsWith("You're confirmed"))).toHaveLength(0)
})
