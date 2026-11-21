// MongoDB connection shared by the site (via db.js) and the command-line scripts.
// No Astro imports here, so scripts can use it directly with `node --env-file=.env`.
import { MongoClient } from 'mongodb'

/** A new client. The site makes one per request (see request-scope.js); scripts use getClient(). */
export function createClient(uri) {
  if (!uri) throw new Error('MONGODB_URI is not set')
  return new MongoClient(uri, { appName: 'fac-website', maxPoolSize: 3, serverSelectionTimeoutMS: 8000 })
}

// Command-line scripts (Node) share one client for the whole run.
const cache = globalThis.__facMongo ?? (globalThis.__facMongo = new Map())

/** @returns {MongoClient} */
export function getClient(uri) {
  let client = cache.get(uri)
  if (!client) {
    client = createClient(uri)
    cache.set(uri, client)
  }
  return client
}

export const getDb = (uri, dbName) => getClient(uri).db(dbName)

// Collection names in one place.
export const COLLECTIONS = {
  courseSessions: 'courseSessions',
  registrations: 'registrations',
  messages: 'messages',
  auditLog: 'auditLog',
  emailLog: 'emailLog',
}

/** Indexes the app relies on. Safe to run repeatedly. */
export async function ensureIndexes(db) {
  const c = COLLECTIONS
  await db.collection(c.courseSessions).createIndex({ startDate: 1 }, { unique: true })
  await db.collection(c.registrations).createIndexes([
    { key: { reference: 1 }, unique: true, name: 'reference_unique' },
    { key: { courseSessionId: 1, status: 1 }, name: 'by_session_status' },
    { key: { status: 1, startDate: 1 }, name: 'by_status_start' },
    { key: { 'student.email': 1 }, name: 'by_student_email' },
  ])
  // Left over from when unpaid seats were released automatically.
  await db.collection(c.registrations).dropIndex('by_status_hold').catch(() => {})
  await db.collection(c.messages).createIndex({ createdAt: -1 })
  await db.collection(c.auditLog).createIndex({ at: -1 })
  await db.collection(c.emailLog).createIndexes([
    { key: { at: -1 }, name: 'by_time' },
    { key: { registrationId: 1, at: -1 }, name: 'by_registration' },
  ])
}
