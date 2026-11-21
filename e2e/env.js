// Fixed settings for the end-to-end tests, shared by the test server (e2e/server.mjs) and the tests.
// Everything here is local and throwaway: an in-memory MongoDB, a fake email service and test-only logins.

export const E2E = {
  sitePort: 4390,
  dbPort: 27_032,
  mailPort: 4391,
  dbName: 'e2e',
  cronSecret: 'e2e-cron-secret',
}

export const BASE_URL = `http://127.0.0.1:${E2E.sitePort}`
export const MONGO_URI = `mongodb://127.0.0.1:${E2E.dbPort}/?replicaSet=e2e`
export const MAIL_URL = `http://127.0.0.1:${E2E.mailPort}`

export const OWNER_NOTIFY_EMAIL = 'owner-inbox@e2e.test'

// Test-only staff logins, created in the in-memory database each time the test server starts.
export const STAFF = {
  owner: { email: 'owner@e2e.test', name: 'Olive Owner', password: 'owner-e2e-password-1', role: 'owner' },
  instructor: { email: 'instructor@e2e.test', name: 'Ian Instructor', password: 'instructor-e2e-password-1', role: 'instructor' },
}
