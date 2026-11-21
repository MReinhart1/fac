// Course weekends for public pages, read live from the database.
// If the database can't be reached the page still renders, with a "call us" note instead of dates.
import { store } from './db.js'

export async function loadPublicSessions() {
  try {
    return { sessions: await store().listPublicSessions(), unavailable: false }
  } catch (error) {
    console.error('Could not load course dates', error)
    return { sessions: [], unavailable: true }
  }
}

// Pages showing course dates are cached at Cloudflare's edge for a minute (Astro.cache.set(PUBLIC_CACHE)).
// Anything that changes seats calls refreshDatePages(), so visitors see the change straight away.
export const PUBLIC_CACHE = { maxAge: 60, swr: 300, tags: ['course-dates'] }

/** Drop cached date pages. `cache` is Astro.cache (pages) or context.cache (API routes). Never throws. */
export async function refreshDatePages(cache) {
  try {
    if (cache?.enabled) await cache.invalidate({ tags: ['course-dates'] })
  } catch (error) {
    // Local `wrangler dev` cannot purge the edge cache; cached pages then simply expire after 60 seconds.
    console.warn('Could not refresh cached date pages:', error?.message ?? error)
  }
}
