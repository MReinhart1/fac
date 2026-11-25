// Which database each part of the project may use.
//
//   fac       the live site: real students, payments and staff. Only GitHub touches it: the deploy (which points the
//             site at it) and the "Live database" workflow (.github/workflows/live-database.yml).
//   fac_test  everything on your computer: `npm run dev`, `npm run preview` and the scripts. The default everywhere.
//
// This keeps a slip on a laptop (a stray MONGODB_DB=fac) from changing real data. It is a guard, not a lock: the lock is
// a MongoDB login for your computer that can only reach fac_test (see "Database and staff portal" in the README).
export const LIVE_DATABASE = 'fac'
export const TEST_DATABASE = 'fac_test'

/** True inside a GitHub Actions run (GitHub sets GITHUB_ACTIONS=true on its runners). */
export const onGitHubActions = (env) => env.GITHUB_ACTIONS === 'true'

/**
 * The database a command-line script should use: MONGODB_DB, or the test database when it is not set.
 * Throws for the live database unless the script is running in a GitHub Actions workflow.
 */
export function databaseForScript(env) {
  const name = env.MONGODB_DB || TEST_DATABASE
  if (name === LIVE_DATABASE && !onGitHubActions(env)) {
    throw new Error(
      `Refusing to use the live database ("${LIVE_DATABASE}") from this computer. Scripts here use "${TEST_DATABASE}". ` +
        'To change live data, run the "Live database" workflow on GitHub (Actions tab), or use the staff portal.',
    )
  }
  return name
}
