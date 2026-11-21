// Course weekends and class lists: adding and editing weekends, moving and cancelling students.
import { addDaysTo, weekendParts } from '../src/data/dates.js'
import { expect, staffId, test } from './fixtures.js'

test('the owner adds a weekend and it opens for registration', async ({ page, signIn, weekends }) => {
  const startDate = addDaysTo(weekends.closed.startDate, 14)
  await signIn('owner')
  await page.goto('/admin/sessions')

  // Only Saturdays are accepted.
  await page.getByLabel('Saturday it starts').fill(addDaysTo(startDate, 1))
  await page.getByRole('button', { name: 'Add weekend' }).click()
  await expect(page.getByRole('alert')).toHaveText('Pick the Saturday the weekend starts on.')

  await page.getByLabel('Saturday it starts').fill(startDate)
  await page.getByLabel('Seats').fill('12')
  await page.getByRole('button', { name: 'Add weekend' }).click()
  await expect(page.getByRole('status')).toHaveText('Course weekend added. It now shows on the website.')
  await expect(page.getByText('0 of 12 seats taken')).toBeVisible()

  // A second weekend on the same date is refused.
  await page.goto('/admin/sessions')
  await page.getByLabel('Saturday it starts').fill(startDate)
  await page.getByRole('button', { name: 'Add weekend' }).click()
  await expect(page.getByRole('alert')).toHaveText('There is already a course weekend on that date.')

  await page.goto('/register')
  await expect(page.getByRole('option', { name: weekendParts(startDate).label, exact: true })).toBeEnabled()
})

test('seats cannot drop below the number already taken', async ({ page, signIn, weekends, register }) => {
  await register(weekends.open, { familyName: 'One' })
  await register(weekends.open, { familyName: 'Two' })
  await signIn('owner')
  await page.goto(`/admin/sessions/${weekends.open.id}`)
  await page.getByText('Edit weekend').click()
  await page.getByLabel('Seats').fill('1')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('alert')).toHaveText("Capacity can't be lower than the 2 seats already taken.")
})

test('closing or cancelling a weekend updates the public site', async ({ page, signIn, weekends }) => {
  await signIn('owner')
  for (const [status, expectation] of [
    ['closed', 'Full'],
    ['cancelled', null],
  ]) {
    await page.goto(`/admin/sessions/${weekends.open.id}`)
    await page.getByText('Edit weekend').click()
    await page.getByLabel('Status').selectOption(status)
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByRole('status')).toHaveText('Weekend updated.')

    await page.goto('/dates')
    const row = page.locator('li', { hasText: weekends.open.label })
    if (expectation) await expect(row.getByText(expectation)).toBeVisible()
    else await expect(row).toHaveCount(0)
  }
})

test('assigning an instructor gives them the class list', async ({ page, db, signIn, weekends, register }) => {
  await register(weekends.later)
  await signIn('owner')
  await page.goto(`/admin/sessions/${weekends.later.id}`)
  await page.getByText('Edit weekend').click()
  await page.getByLabel('Ian Instructor').check()
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('status')).toHaveText('Weekend updated.')
  const weekend = await db.collection('courseSessions').findOne({ startDate: weekends.later.startDate })
  expect(weekend.instructorIds).toEqual([await staffId(db, 'instructor')])

  await page.getByRole('button', { name: 'Sign out' }).click()
  await signIn('instructor')
  await page.goto(`/admin/sessions/${weekends.later.id}`)
  await expect(page.getByRole('heading', { name: 'Class list (1)' })).toBeVisible()
})

test('moving a student takes a seat on the new weekend and frees the old one', async ({ page, db, emails, signIn, weekends, register }) => {
  const { id } = await register(weekends.open)
  await signIn('owner')
  await page.goto(`/admin/registrations/${id}`)
  await page.getByRole('combobox').filter({ hasText: weekends.later.label }).selectOption({ label: `${weekends.later.label} (20 left)` })
  await page.getByRole('button', { name: 'Move', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText('Moved to the new weekend.')

  const seats = async (weekend) => (await db.collection('courseSessions').findOne({ startDate: weekend.startDate })).seatsTaken
  expect(await seats(weekends.open)).toBe(0)
  expect(await seats(weekends.later)).toBe(1)
  expect((await db.collection('registrations').findOne({})).startDate).toBe(weekends.later.startDate)
  expect((await emails()).some((email) => email.subject === `Your course date changed to ${weekends.later.label}`)).toBe(true)
})

test('cancelling a paid registration records the refund and frees the seat', async ({ page, db, signIn, weekends, register }) => {
  const { id } = await register(weekends.open)
  await signIn('owner')
  await page.goto(`/admin/registrations/${id}`)
  await page.getByRole('button', { name: 'Mark paid' }).click()
  await expect(page.getByRole('status')).toHaveText('Payment recorded and confirmation emailed.')

  await expect(page.getByRole('heading', { name: 'Cancel registration' })).toBeVisible()
  await page.getByLabel('Refund given ($, optional)').fill('158.30')
  await page.getByLabel('Reason').fill('Student asked to cancel')
  await page.getByRole('button', { name: 'Cancel and free the seat' }).click()
  await expect(page.getByRole('status')).toHaveText('Registration cancelled and the seat freed.')

  const reg = await db.collection('registrations').findOne({})
  expect(reg.status).toBe('cancelled')
  expect(reg.payments.map((p) => [p.kind, p.amountCents])).toEqual([
    ['payment', 25830],
    ['refund', 15830],
  ])
  expect((await db.collection('courseSessions').findOne({ startDate: weekends.open.startDate })).seatsTaken).toBe(0)
})

test('instructors can record course-day details', async ({ page, db, signIn, weekends, register }) => {
  const { id } = await register(weekends.open)
  await db.collection('courseSessions').updateOne({ startDate: weekends.open.startDate }, { $set: { instructorIds: [await staffId(db, 'instructor')] } })
  await signIn('instructor')
  await page.goto(`/admin/registrations/${id}`)
  await expect(page.getByRole('button', { name: 'Mark paid' })).toHaveCount(0)
  await page.getByLabel('Signed under-18 consent form received').check()
  await page.getByLabel('Attendance').selectOption('attended')
  await page.getByLabel('Staff notes').fill('Sat at the front')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText('Saved.')
  expect(await db.collection('registrations').findOne({})).toMatchObject({ consentReceived: true, attendance: 'attended', staffNotes: 'Sat at the front' })
})
