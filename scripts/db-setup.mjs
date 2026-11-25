// Creates the indexes and loads the course weekends that are not in the database yet.
// Safe to run more than once: existing weekends are left exactly as they are.
// Usage: npm run db:setup   (the test database, fac_test; the live one only through the "Live database" workflow)
import { booking } from '../src/data/site.js'
import { ensureIndexes, getClient, getDb } from '../src/lib/mongo.js'
import { describeDatabase, scriptDatabase } from './database.mjs'
import { seedDates } from './seed-dates.mjs'

const uri = process.env.MONGODB_URI
const dbName = scriptDatabase()
const client = getClient(uri)

try {
  const db = getDb(uri, dbName)
  await ensureIndexes(db)
  const now = new Date()
  let added = 0
  for (const { startDate, status = 'open' } of seedDates) {
    const result = await db.collection('courseSessions').updateOne(
      { startDate },
      {
        $setOnInsert: {
          startDate,
          capacity: booking.defaultCapacity,
          seatsTaken: 0,
          status,
          instructorIds: [],
          notes: '',
          createdAt: now,
          updatedAt: now,
        },
      },
      { upsert: true },
    )
    if (result.upsertedCount) added += 1
  }
  const total = await db.collection('courseSessions').countDocuments()
  console.log(`${describeDatabase(dbName)}: indexes ready; added ${added} course weekend(s); ${total} in total.`)
} finally {
  await client.close()
}
