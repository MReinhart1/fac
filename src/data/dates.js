// Date helpers for course weekends. The weekends themselves live in the database (courseSessions);
// scripts/seed-dates.mjs has the list that was loaded into it.

// Today's date in Toronto as YYYY-MM-DD, so comparisons don't depend on the server's or visitor's time zone.
export function todayInToronto(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto' }).format(now)
}

// A real calendar date as YYYY-MM-DD. The round trip rejects dates JavaScript would roll over, like 2027-02-30.
export const isValidDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) return false
  const date = new Date(`${value}T12:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

// label: "January 16/17, 2027" (or "January 31 / February 1, 2027" across a month boundary)
// plus short parts for date tiles: month "Jan", days "16–17", year 2027.
export function weekendParts(start) {
  const saturday = new Date(`${start}T12:00:00Z`)
  const sunday = new Date(saturday)
  sunday.setUTCDate(saturday.getUTCDate() + 1)
  const month = (date, style = 'long') => date.toLocaleDateString('en-CA', { month: style, timeZone: 'UTC' }).replace('.', '')
  const day = (date) => date.getUTCDate()
  const year = sunday.getUTCFullYear()
  const sameMonth = saturday.getUTCMonth() === sunday.getUTCMonth()

  return {
    label: sameMonth
      ? `${month(saturday)} ${day(saturday)}/${day(sunday)}, ${year}`
      : `${month(saturday)} ${day(saturday)} / ${month(sunday)} ${day(sunday)}, ${year}`,
    month: sameMonth ? month(saturday, 'short') : `${month(saturday, 'short')}/${month(sunday, 'short')}`,
    days: `${day(saturday)}–${day(sunday)}`,
    year,
  }
}

export const isSaturday = (start) => new Date(`${start}T12:00:00Z`).getUTCDay() === 6

/** YYYY-MM-DD plus a number of days. */
export function addDaysTo(start, days) {
  const date = new Date(`${start}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}
