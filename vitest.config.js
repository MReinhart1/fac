// Unit tests (Vitest): `npm test`. They sit next to the code they test as *.test.js.
// The end-to-end tests in e2e/ are Playwright's (`npm run test:e2e`), so they are left out here.
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.js'],
    environment: 'node',
    // The store tests start an in-memory MongoDB, which takes a few seconds (longer on the very first run).
    hookTimeout: 120_000,
  },
})
