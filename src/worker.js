// Cloudflare Worker entry (wrangler.jsonc "main"). Astro handles every web request;
// the hourly cron trigger runs the same job as GET /api/cron/hourly by sending that route an internal request.
import { handle } from '@astrojs/cloudflare/handler'

async function runHourlyCron(env, ctx) {
  const request = new Request('https://scheduled.internal/api/cron/hourly', {
    headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
  })
  const response = await handle(request, env, ctx)
  const body = await response.text()
  if (response.ok) console.info(`[cron] hourly job: ${body}`)
  else console.error(`[cron] hourly job failed (${response.status}): ${body}`)
}

export default {
  fetch: handle,

  scheduled(_controller, env, ctx) {
    ctx.waitUntil(runHourlyCron(env, ctx))
  },
}
