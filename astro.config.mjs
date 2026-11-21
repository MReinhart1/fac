// @ts-check
import react from '@astrojs/react'
import sitemap from '@astrojs/sitemap'
import tailwindcss from '@tailwindcss/vite'
import cloudflare from '@astrojs/cloudflare'
import { cacheCloudflare } from '@astrojs/cloudflare/cache'
import { fileURLToPath } from 'node:url'
import { defineConfig, envField } from 'astro/config'

const shim = (name) => fileURLToPath(new URL(`./src/shims/${name}.js`, import.meta.url))

// `astro dev` only: give the MongoDB driver the runtime's global `process` instead of importing `node:process`,
// which makes the Cloudflare dev server log "no match for module: node:process" (see src/shims/process.js).
const devProcessShim = {
  name: 'dev-process-shim',
  hooks: {
    'astro:config:setup': ({ command, updateConfig }) => {
      if (command !== 'dev') return
      updateConfig({ vite: { resolve: { alias: [{ find: /^(node:)?process$/, replacement: shim('process') }] } } })
    },
  },
}

// The site's public address: used for canonical links, the sitemap and robots.txt. While it is the demo domain, search
// engines are told not to index the site (see LIVE_DOMAIN in src/data/site.js). At launch, change it to
// https://firearmsacademy.ca, along with BETTER_AUTH_URL and the routes in wrangler.jsonc.
const SITE_URL = 'https://mreinhart-fac-demo.com'

// https://docs.astro.build/en/reference/configuration-reference/
export default defineConfig({
  site: SITE_URL,
  // Clean URLs like /faq (no trailing slash), matching the links used throughout the site.
  trailingSlash: 'never',
  // Hosted on Cloudflare Workers (wrangler.jsonc). Static pages are served as assets; the registration API,
  // live date pages and staff portal run in the Worker. `redirects` below become a _redirects file (real 301s).
  // The site uses no images to transform and no Astro sessions, so neither needs a Cloudflare binding.
  adapter: cloudflare({ imageService: 'passthrough' }),
  session: false,
  // Pages that call Astro.cache.set() are cached at Cloudflare's edge (see src/lib/public-sessions.js).
  cache: { provider: cacheCloudflare() },
  integrations: [react(), sitemap({ filter: (page) => !new URL(page).pathname.startsWith('/admin') }), devProcessShim],
  // Server-only settings, read at runtime (never bundled into browser code). See .env.example.
  env: {
    schema: {
      MONGODB_URI: envField.string({ context: 'server', access: 'secret' }),
      MONGODB_DB: envField.string({ context: 'server', access: 'secret', default: 'fac' }),
      BETTER_AUTH_SECRET: envField.string({ context: 'server', access: 'secret' }),
      BETTER_AUTH_URL: envField.string({ context: 'server', access: 'secret', optional: true }),
      CRON_SECRET: envField.string({ context: 'server', access: 'secret', optional: true }),
      // Email (Resend). Without RESEND_API_KEY, emails are logged as "not sent" instead of being sent.
      RESEND_API_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
      RESEND_API_URL: envField.string({ context: 'server', access: 'secret', default: 'https://api.resend.com' }),
      EMAIL_FROM: envField.string({ context: 'server', access: 'secret', optional: true }),
      EMAIL_REPLY_TO: envField.string({ context: 'server', access: 'secret', optional: true }),
      OWNER_NOTIFY_EMAIL: envField.string({ context: 'server', access: 'secret', optional: true }),
    },
  },
  // Reject cross-site form posts to server-rendered pages (staff portal actions).
  security: { checkOrigin: true },
  vite: {
    plugins: [tailwindcss()],
    // In the Worker, use the runtime's own URL classes instead of the `whatwg-url` package. Its punycode
    // dependency can't load under `astro dev` in workerd (production builds already make this swap).
    resolve: { alias: { 'whatwg-url': shim('whatwg-url') } },
  },
  // Old PHP URLs, so existing links and search results keep working.
  redirects: {
    '/index.php': '/',
    '/courses.php': '/#courses',
    '/dates.php': '/dates',
    '/locations.php': '/locations',
    '/pricing.php': '/pricing',
    '/ohep.php': '/hunter-education',
    '/register.php': '/register',
    '/faq.php': '/faq',
    '/contact.php': '/contact',
    '/certified.php': '/certified',
    '/links.php': '/links',
    '/consent-form-2019.pdf': '/consent',
  },
})
