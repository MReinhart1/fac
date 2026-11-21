// Cloudflare Worker entry (wrangler.jsonc "main"). Astro handles every web request;
// the hourly cron trigger runs the same job as GET /api/cron/hourly by sending that route an internal request.
import { handle } from '@astrojs/cloudflare/handler'

export default {
  fetch: handle,

  async scheduled(_controller, env, ctx) {
    const request = new Request('https://scheduled.internal/api/cron/hourly', {
      headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
    })
    ctx.waitUntil(
      handle(request, env, ctx).then(async (response) => {
        const body = await response.text()
        if (!response.ok) console.error(`[cron] hourly job failed (${response.status}): ${body}`)
        else console.log(`[cron] hourly job: ${body}`)
      }),
    )
  },
}
