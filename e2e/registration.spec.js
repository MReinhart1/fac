// The public registration form: saving a registration, taking a seat, payment instructions and emails.
import { OWNER_NOTIFY_EMAIL } from './env.js'
import { expect, registrationBody, test, waitForForms } from './fixtures.js'

async function fillDetails(page, { firstName = 'Pat', familyName = 'Tester', email = 'pat@example.test', confirmEmail = email } = {}) {
  await page.getByLabel('First name').fill(firstName)
  await page.getByLabel('Family name').fill(familyName)
  await page.getByLabel('Daytime / primary phone').fill('416-555-0100')
  await page.getByLabel('Email address', { exact: true }).fill(email)
  await page.getByLabel('Confirm email address').fill(confirmEmail)
  await page.getByLabel('I have read and agree to the policy').check()
}

test('registering takes a seat and shows e-Transfer instructions', async ({ page, db, weekends, emails }) => {
  await page.goto(`/register?course=cfsc&date=${weekends.open.startDate}`)
  await waitForForms(page)
  // The links on the dates and pricing pages preselect the course and the weekend.
  await expect(page.getByLabel(/CFSC course package/)).toBeChecked()
  await expect(page.getByLabel('Course date')).toHaveValue(weekends.open.id)

  await fillDetails(page)
  await page.getByRole('button', { name: 'Submit registration' }).click()

  await expect(page.getByRole('heading', { name: 'Registration received, Pat' })).toBeVisible()
  const instructions = page.getByRole('region', { name: 'Registration received, Pat' })
  await expect(instructions).toContainText('$258.30')
  await expect(instructions).toContainText(/FAC-\d{4}-TESTER-[A-Z2-9]{3}/)
  await expect(instructions).toContainText('within 48 hours')

  const reg = await db.collection('registrations').findOne({ 'student.familyName': 'Tester' })
  expect(reg).toMatchObject({ status: 'pending', packageId: 'cfsc', amountDueCents: 25_830, startDate: weekends.open.startDate })
  expect(reg).not.toHaveProperty('holdExpiresAt')
  const weekend = await db.collection('courseSessions').findOne({ startDate: weekends.open.startDate })
  expect(weekend.seatsTaken).toBe(1)

  const sent = await emails()
  expect(sent.map((email) => email.to[0]).toSorted()).toEqual([OWNER_NOTIFY_EMAIL, 'pat@example.test'].toSorted())
  const studentEmail = sent.find((email) => email.to[0] === 'pat@example.test')
  expect(studentEmail.subject).toContain(reg.reference)
  expect(studentEmail.text).toContain('$258.30')
})

test('owning the student guide lowers the price', async ({ page, db, weekends }) => {
  await page.goto(`/register?course=cfsc&date=${weekends.open.startDate}`)
  await waitForForms(page)
  const summary = page.getByRole('complementary', { name: 'Registration summary' })
  await expect(summary).toContainText('$258.30')
  await page.getByLabel(/I already have the student guide/).check()
  await expect(summary).toContainText('$237.30')

  await fillDetails(page)
  await page.getByRole('button', { name: 'Submit registration' }).click()
  await expect(page.getByText('Registration received, Pat')).toBeVisible()
  const reg = await db.collection('registrations').findOne({})
  expect(reg).toMatchObject({ amountDueCents: 23_730, hasGuide: true })
})

test('mismatched email addresses are caught before anything is saved', async ({ page, db, weekends }) => {
  await page.goto(`/register?date=${weekends.open.startDate}`)
  await waitForForms(page)
  await fillDetails(page, { email: 'pat@example.test', confirmEmail: 'typo@example.test' })
  await page.getByRole('button', { name: 'Submit registration' }).click()
  await expect(page.getByRole('status')).toHaveText('The email addresses do not match.')
  expect(await db.collection('registrations').countDocuments()).toBe(0)
})

test('restricted-only packages ask for the PAL course details', async ({ page, db, weekends }) => {
  await page.goto(`/register?date=${weekends.open.startDate}`)
  await waitForForms(page)
  await expect(page.getByLabel('Date you completed the PAL course')).toHaveCount(0)
  await page.getByLabel(/^CRFSC \(/).check()
  await page.getByLabel('Date you completed the PAL course').fill('2026-01-10')
  await page.getByLabel('Name of your instructor').fill('Jane Instructor')
  await fillDetails(page)
  await page.getByRole('button', { name: 'Submit registration' }).click()
  await expect(page.getByText('Registration received, Pat')).toBeVisible()
  const reg = await db.collection('registrations').findOne({})
  expect(reg).toMatchObject({ packageId: 'crfsc', pal: { courseDate: '2026-01-10', instructor: 'Jane Instructor' } })
})

test('the server rejects a restricted-only booking without PAL details', async ({ request, db, weekends }) => {
  const response = await request.post('/api/register', { data: registrationBody(weekends.open, { courseId: 'crfsc' }) })
  expect(response.status()).toBe(400)
  expect((await response.json()).error).toMatch(/PAL course/)
  expect(await db.collection('registrations').countDocuments()).toBe(0)
})

test('a full weekend cannot be booked', async ({ page, request, db, weekends, register }) => {
  await register(weekends.small, { familyName: 'First' })

  // The form shows the weekend as full and will not let you pick it.
  await page.goto('/register')
  await waitForForms(page)
  await expect(page.getByRole('option', { name: `${weekends.small.label} (full)` })).toBeDisabled()

  // The server refuses it too, and the seat count never goes over capacity.
  const response = await request.post('/api/register', { data: registrationBody(weekends.small, { familyName: 'Second' }) })
  expect(response.status()).toBe(409)
  expect((await response.json()).error).toMatch(/just filled up/)
  const weekend = await db.collection('courseSessions').findOne({ startDate: weekends.small.startDate })
  expect(weekend.seatsTaken).toBe(1)
})

test('closed weekends cannot be booked', async ({ request, db, weekends }) => {
  const response = await request.post('/api/register', { data: registrationBody(weekends.closed) })
  expect(response.status()).toBe(409)
  expect(await db.collection('registrations').countDocuments()).toBe(0)
})

test('two people racing for the last seat: only one gets it', async ({ request, db, weekends }) => {
  const attempts = await Promise.all(
    ['Ada', 'Bo', 'Cy', 'Di', 'Ed'].map((name) =>
      request.post('/api/register', { data: registrationBody(weekends.small, { familyName: name }) }),
    ),
  )
  expect(attempts.map((response) => response.status()).toSorted()).toEqual([201, 409, 409, 409, 409])
  expect(await db.collection('registrations').countDocuments()).toBe(1)
  const weekend = await db.collection('courseSessions').findOne({ startDate: weekends.small.startDate })
  expect(weekend.seatsTaken).toBe(1)
})

test('spam-trap submissions look successful but save nothing', async ({ request, db, weekends, emails }) => {
  const response = await request.post('/api/register', { data: registrationBody(weekends.open, { _gotcha: 'bot' }) })
  expect(response.status()).toBe(200)
  expect(await db.collection('registrations').countDocuments()).toBe(0)
  expect(await emails()).toHaveLength(0)
})
