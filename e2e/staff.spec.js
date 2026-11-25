// Staff logins: the owner's Staff page (add, role, reset password, access on and off) and Your account (change password).
import { BASE_URL } from './env.js'
import { expect, test } from './fixtures.js'

/** As the owner, add a login on /admin/staff and return the temporary password the page shows once. */
async function addStaff(page, { name = 'Nora New', email = 'nora@e2e.test', role = 'Instructor' } = {}) {
  await page.goto('/admin/staff')
  const form = page.getByRole('form', { name: 'Add a staff login' })
  await form.getByLabel('Name').fill(name)
  await form.getByLabel('Email').fill(email)
  await form.getByLabel('Role').selectOption({ label: role })
  await form.getByRole('button', { name: 'Add login' }).click()
  await expect(page.getByRole('heading', { name: `Login created for ${name}` })).toBeVisible()
  return (await page.locator('[data-temporary-password]').textContent()).trim()
}

async function signInAs(page, email, password) {
  await page.context().clearCookies()
  await page.goto('/admin/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
}

/** Sign in on a separate browser (its own cookies), as a second device would. */
async function secondDevice(browser, email, password) {
  const context = await browser.newContext({ baseURL: BASE_URL })
  const page = await context.newPage()
  await signInAs(page, email, password)
  await expect(page).toHaveURL('/admin')
  return page
}

/** Is this page's browser still signed in? */
async function stillSignedIn(page) {
  await page.goto('/admin')
  return new URL(page.url()).pathname === '/admin'
}

const row = (page, name) => page.getByRole('listitem').filter({ hasText: name })

test('the owner adds an instructor, who can sign in with the temporary password', async ({ page, db, signIn }) => {
  await signIn('owner')
  await page.getByRole('navigation', { name: 'Staff navigation' }).getByRole('link', { name: 'Staff' }).click()
  await expect(page).toHaveURL('/admin/staff')

  const password = await addStaff(page)
  expect(password).toMatch(/^[A-Za-z2-9]{4}(-[A-Za-z2-9]{4}){3}$/)
  await expect(row(page, 'Nora New')).toContainText('nora@e2e.test · Instructor')
  expect(await db.collection('auditLog').findOne({ action: 'staff.create' })).toMatchObject({ details: { email: 'nora@e2e.test', role: 'instructor' } })

  await signInAs(page, 'nora@e2e.test', password)
  await expect(page).toHaveURL('/admin')
  await expect(page.getByRole('navigation', { name: 'Staff navigation' }).getByRole('link', { name: 'Staff' })).toHaveCount(0)
  expect((await page.goto('/admin/staff')).status()).toBe(403)
})

test('a second login with the same email is refused', async ({ page, signIn }) => {
  await signIn('owner')
  await page.goto('/admin/staff')
  const form = page.getByRole('form', { name: 'Add a staff login' })
  await form.getByLabel('Name').fill('Ian Again')
  await form.getByLabel('Email').fill('instructor@e2e.test')
  await form.getByRole('button', { name: 'Add login' }).click()
  await expect(page.getByRole('alert')).toHaveText('There is already a login with that email address.')
})

test('the owner changes roles, turns access off and on, and resets passwords', async ({ page, signIn }) => {
  await signIn('owner')
  const firstPassword = await addStaff(page)

  // Make her an owner.
  await row(page, 'Nora New').getByLabel('Role for Nora New', { exact: true }).selectOption('owner')
  await row(page, 'Nora New').getByRole('button', { name: 'Save role for Nora New' }).click()
  await expect(page.getByRole('status')).toHaveText('Nora New is now an owner.')
  await expect(row(page, 'Nora New')).toContainText('Owner')

  // Turn access off: she cannot sign in.
  page.once('dialog', (dialog) => dialog.accept())
  await row(page, 'Nora New').getByRole('button', { name: 'Turn access off for Nora New' }).click()
  await expect(page.getByRole('status')).toContainText('can no longer sign in')
  await expect(row(page, 'Nora New')).toContainText('Access turned off')

  // Turn it back on.
  await row(page, 'Nora New').getByRole('button', { name: 'Turn access on for Nora New' }).click()
  await expect(page.getByRole('status')).toHaveText('Nora New can sign in again.')

  // Reset her password: the old one stops working, the new one works.
  page.once('dialog', (dialog) => dialog.accept())
  await row(page, 'Nora New').getByRole('button', { name: 'Reset password for Nora New' }).click()
  await expect(page.getByRole('heading', { name: 'New password for Nora New' })).toBeVisible()
  const newPassword = (await page.locator('[data-temporary-password]').textContent()).trim()
  expect(newPassword).not.toBe(firstPassword)

  await signInAs(page, 'nora@e2e.test', firstPassword)
  await expect(page.getByRole('alert')).toHaveText('Wrong email or password.')
  await signInAs(page, 'nora@e2e.test', newPassword)
  await expect(page).toHaveURL('/admin')
})

test('a login whose access is off cannot sign in', async ({ page, signIn }) => {
  await signIn('owner')
  const password = await addStaff(page)
  page.once('dialog', (dialog) => dialog.accept())
  await row(page, 'Nora New').getByRole('button', { name: 'Turn access off for Nora New' }).click()
  await expect(row(page, 'Nora New')).toContainText('Access turned off')

  await signInAs(page, 'nora@e2e.test', password)
  await expect(page).not.toHaveURL('/admin')
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/admin\/login/)
})

test('the owner cannot change their own login on the Staff page', async ({ page, signIn }) => {
  await signIn('owner')
  await page.goto('/admin/staff')
  const own = row(page, 'Olive Owner')
  await expect(own).toContainText('(you)')
  await expect(own.getByRole('button')).toHaveCount(0)
  await expect(own.getByRole('link', { name: 'Change your password' })).toHaveAttribute('href', '/admin/account')
})

test('staff change their own password on Your account', async ({ page, signIn }) => {
  // Use a fresh login, so the standard test logins keep their passwords.
  await signIn('owner')
  const temporary = await addStaff(page, { role: 'Instructor' })
  await signInAs(page, 'nora@e2e.test', temporary)

  await page.getByRole('link', { name: /your account/i }).click()
  await expect(page).toHaveURL('/admin/account')
  await expect(page.getByText('nora@e2e.test')).toBeVisible()

  const change = async (current, next, again = next) => {
    await page.getByLabel('Current password').fill(current)
    await page.getByLabel('New password', { exact: true }).fill(next)
    await page.getByLabel('New password again').fill(again)
    // Let short passwords through the browser's own check, so the server's message can be tested.
    await page.evaluate(() => {
      for (const input of document.querySelectorAll('input[minlength]')) input.removeAttribute('minlength')
    })
    await page.getByRole('button', { name: 'Change password' }).click()
  }

  await change(temporary, 'short')
  await expect(page.getByRole('alert')).toHaveText('Use at least 12 characters for the new password.')
  await change(temporary, 'a-long-new-password-1', 'a-different-password-2')
  await expect(page.getByRole('alert')).toHaveText('The two new passwords do not match.')
  await change('not-the-current-one', 'a-long-new-password-1')
  await expect(page.getByRole('alert')).toHaveText('Your current password is not right.')

  await change(temporary, 'a-long-new-password-1')
  await expect(page.getByRole('status')).toHaveText('Password changed. Other devices have been signed out.')
  // Still signed in here.
  await page.goto('/admin')
  await expect(page).toHaveURL('/admin')

  await signInAs(page, 'nora@e2e.test', temporary)
  await expect(page.getByRole('alert')).toHaveText('Wrong email or password.')
  await signInAs(page, 'nora@e2e.test', 'a-long-new-password-1')
  await expect(page).toHaveURL('/admin')
})

test('the staff actions are recorded in the audit log', async ({ page, db, signIn }) => {
  await signIn('owner')
  await addStaff(page)
  const nora = await db.collection('user').findOne({ email: 'nora@e2e.test' })
  const id = nora._id.toString()

  await row(page, 'Nora New').getByLabel('Role for Nora New', { exact: true }).selectOption('owner')
  await row(page, 'Nora New').getByRole('button', { name: 'Save role for Nora New' }).click()
  await expect(page.getByRole('status')).toHaveText('Nora New is now an owner.')
  page.once('dialog', (dialog) => dialog.accept())
  await row(page, 'Nora New').getByRole('button', { name: 'Turn access off for Nora New' }).click()
  await expect(row(page, 'Nora New')).toContainText('Access turned off')
  await row(page, 'Nora New').getByRole('button', { name: 'Turn access on for Nora New' }).click()
  await expect(page.getByRole('status')).toHaveText('Nora New can sign in again.')
  page.once('dialog', (dialog) => dialog.accept())
  await row(page, 'Nora New').getByRole('button', { name: 'Reset password for Nora New' }).click()
  await expect(page.getByRole('heading', { name: 'New password for Nora New' })).toBeVisible()

  const entries = await db.collection('auditLog').find({}, { sort: { _id: 1 } }).toArray()
  expect(entries.map((entry) => entry.action)).toEqual(['staff.create', 'staff.role', 'staff.disable', 'staff.enable', 'staff.password-reset'])
  for (const entry of entries) expect(entry.target).toMatchObject({ type: 'user', id })
  expect(entries[1].details).toEqual({ role: 'owner' })
  // The temporary passwords are never written to the log.
  expect(JSON.stringify(entries)).not.toMatch(/[A-Za-z2-9]{4}-[A-Za-z2-9]{4}-[A-Za-z2-9]{4}-[A-Za-z2-9]{4}/)
})

test('a login needs a name', async ({ page, db, signIn }) => {
  await signIn('owner')
  await page.goto('/admin/staff')
  const form = page.getByRole('form', { name: 'Add a staff login' })
  // Spaces get past the browser's own check; the server trims them and refuses.
  await form.getByLabel('Name').fill('   ')
  await form.getByLabel('Email').fill('nora@e2e.test')
  await form.getByRole('button', { name: 'Add login' }).click()
  await expect(page.getByRole('alert')).toHaveText('Please enter a name.')
  expect(await db.collection('user').findOne({ email: 'nora@e2e.test' })).toBeNull()
})

test('an instructor cannot use the Staff page, even by posting to it directly', async ({ page, db, signIn }) => {
  await signIn('instructor')
  const response = await page.request.post('/admin/staff', {
    headers: { Origin: BASE_URL },
    form: { action: 'create', name: 'Sneaky', email: 'sneaky@e2e.test', role: 'owner' },
  })
  expect(response.status()).toBe(403)
  expect(await response.text()).toContain('Only the owner can manage staff.')
  expect(await db.collection('user').findOne({ email: 'sneaky@e2e.test' })).toBeNull()
})

test('turning access off signs the person out on devices already signed in', async ({ page, browser, signIn }) => {
  await signIn('owner')
  const password = await addStaff(page)
  const nora = await secondDevice(browser, 'nora@e2e.test', password)

  page.once('dialog', (dialog) => dialog.accept())
  await row(page, 'Nora New').getByRole('button', { name: 'Turn access off for Nora New' }).click()
  await expect(row(page, 'Nora New')).toContainText('Access turned off')

  expect(await stillSignedIn(nora)).toBe(false)
  await nora.context().close()
})

test('resetting a password signs the person out on devices already signed in', async ({ page, browser, signIn }) => {
  await signIn('owner')
  const password = await addStaff(page)
  const nora = await secondDevice(browser, 'nora@e2e.test', password)

  page.once('dialog', (dialog) => dialog.accept())
  await row(page, 'Nora New').getByRole('button', { name: 'Reset password for Nora New' }).click()
  await expect(page.getByRole('heading', { name: 'New password for Nora New' })).toBeVisible()

  expect(await stillSignedIn(nora)).toBe(false)
  await nora.context().close()
})

test('Your account needs a signed-in staff member', async ({ page }) => {
  await page.goto('/admin/account')
  await expect(page).toHaveURL('/admin/login?next=%2Fadmin%2Faccount')
})

test('Your account shows the person their own details', async ({ page, signIn }) => {
  await signIn('instructor')
  await page.goto('/admin/account')
  await expect(page.getByRole('heading', { name: 'Your account', level: 1 })).toBeVisible()
  const details = page.getByRole('region', { name: 'Your details' })
  await expect(details).toContainText('Ian Instructor')
  await expect(details).toContainText('instructor@e2e.test')
  await expect(details).toContainText('Instructor')
  // The header link marks this as the current page.
  await expect(page.getByRole('link', { name: /your account/i })).toHaveAttribute('aria-current', 'page')
})

test('changing your password signs out your other devices, records it, and refuses reusing the old one', async ({ page, browser, db, signIn }) => {
  await signIn('owner')
  const temporary = await addStaff(page)
  const otherDevice = await secondDevice(browser, 'nora@e2e.test', temporary)
  await signInAs(page, 'nora@e2e.test', temporary)
  await page.goto('/admin/account')

  const change = async (current, next) => {
    await page.getByLabel('Current password').fill(current)
    await page.getByLabel('New password', { exact: true }).fill(next)
    await page.getByLabel('New password again').fill(next)
    await page.getByRole('button', { name: 'Change password' }).click()
  }

  await change(temporary, temporary)
  await expect(page.getByRole('alert')).toHaveText('Choose a new password that is different from the current one.')
  expect(await stillSignedIn(otherDevice)).toBe(true)

  await page.goto('/admin/account')
  await change(temporary, 'a-long-new-password-1')
  await expect(page.getByRole('status')).toHaveText('Password changed. Other devices have been signed out.')

  expect(await stillSignedIn(otherDevice)).toBe(false)
  expect(await stillSignedIn(page)).toBe(true)
  const nora = await db.collection('user').findOne({ email: 'nora@e2e.test' })
  expect(await db.collection('auditLog').findOne({ action: 'staff.password-change' })).toMatchObject({ target: { type: 'user', id: nora._id.toString() } })
  await otherDevice.context().close()
})
