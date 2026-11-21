// GET /api/cron/hourly — the hourly job: class reminders to students and class lists to instructors.
// It never changes registrations or seats. See runHourlyJob in src/lib/email/notify.js.
import { CRON_SECRET } from 'astro:env/server'
import { runHourlyJob } from '../../../lib/email/notify.js'
import { errorResponse, json } from '../../../lib/http.js'

export const prerender = false

export async function GET({ request }) {
  if (!CRON_SECRET || request.headers.get('authorization') !== `Bearer ${CRON_SECRET}`) {
    return json({ error: 'Unauthorized' }, 401)
  }
  try {
    // Local testing only: ?at=<ISO time> runs the job as if it were that time. Ignored on the live site.
    const at = import.meta.env.DEV ? new URL(request.url).searchParams.get('at') : null
    return json(await runHourlyJob(at ? { now: new Date(at) } : {}))
  } catch (error) {
    return errorResponse(error)
  }
}
