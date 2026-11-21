// End-to-end tests (e2e/). `npm run test:e2e` builds the site and starts a throwaway test server
// (e2e/server.mjs: in-memory MongoDB, fake email service, the site in Cloudflare's local runtime).
import { defineConfig, devices } from '@playwright/test'
import { BASE_URL } from './e2e/env.js'

export default defineConfig({
  testDir: './e2e',
  // The tests share one database, which each test resets (e2e/fixtures.js), so they run one at a time.
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    // The public pages and forms again at phone size (menu button, stacked layout). The staff portal is desktop-only.
    { name: 'phone', use: { ...devices['Pixel 7'] }, testMatch: ['public.spec.js', 'registration.spec.js', 'contact.spec.js', 'accessibility.spec.js'] },
  ],
  webServer: {
    command: 'node e2e/server.mjs',
    url: `${BASE_URL}/faq`,
    // Building the site and starting MongoDB (downloaded on the first run) can take a while.
    timeout: 300_000,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
  },
})
