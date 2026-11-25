// The database name for a command-line script (see src/lib/databases.js): the test database on your computer, and
// the live one only inside a GitHub Actions workflow. Stops the script with a short message otherwise.
import { databaseForScript, LIVE_DATABASE } from '../src/lib/databases.js'

export function scriptDatabase() {
  try {
    return databaseForScript(process.env)
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }
}

/** "database "fac_test"", or "database "fac" (live site)", for the scripts' messages. */
export const describeDatabase = (name) => `database "${name}"${name === LIVE_DATABASE ? ' (live site)' : ''}`
