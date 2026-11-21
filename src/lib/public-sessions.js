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

// Cloudflare's local runtime (`npm run dev`, `wrangler dev`, the end-to-end tests) has no cache purge, and caches nothing
// for it to purge. Once that is detected, stop trying, after saying so once.
let purgeUnavailable = false

/** Drop cached date pages. `cache` is Astro.cache (pages) or context.cache (API routes). Never throws. */
export async function refreshDatePages(cache) {
  if (!cache?.enabled || purgeUnavailable) return
  try {
    await cache.invalidate({ tags: ['course-dates'] })
  } catch (error) {
    if (error instanceof TypeError && /purge is not a function/.test(error.message)) {
      purgeUnavailable = true
      console.info('Cache purge is not available in the local runtime; skipping it (nothing is cached locally).')
      return
    }
    // On the live site this would leave the dates pages up to 60 seconds out of date, so make it visible.
    console.warn('Could not refresh cached date pages:', error?.message ?? error)
  }
}
