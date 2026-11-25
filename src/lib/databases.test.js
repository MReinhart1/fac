import { describe, expect, it } from 'vitest'
import { databaseForScript, LIVE_DATABASE, TEST_DATABASE } from './databases.js'

describe('databaseForScript', () => {
  it('uses the test database when MONGODB_DB is not set', () => {
    expect(databaseForScript({})).toBe(TEST_DATABASE)
    expect(databaseForScript({ MONGODB_DB: '' })).toBe(TEST_DATABASE)
  })

  it('uses any other database it is given', () => {
    expect(databaseForScript({ MONGODB_DB: 'e2e' })).toBe('e2e')
  })

  it('refuses the live database on a computer', () => {
    expect(() => databaseForScript({ MONGODB_DB: LIVE_DATABASE })).toThrow(/Refusing to use the live database/)
    expect(() => databaseForScript({ MONGODB_DB: LIVE_DATABASE, GITHUB_ACTIONS: 'false' })).toThrow(/Refusing/)
  })

  it('allows the live database inside a GitHub Actions workflow', () => {
    expect(databaseForScript({ MONGODB_DB: LIVE_DATABASE, GITHUB_ACTIONS: 'true' })).toBe(LIVE_DATABASE)
  })
})
