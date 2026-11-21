// /robots.txt, built from the site's address in astro.config.mjs. The site's own domain (LIVE_DOMAIN) invites search
// engines; any other address asks them to stay away (BaseLayout adds a matching "noindex" tag to every page).
import { LIVE_DOMAIN } from '../data/site.js'

export function GET({ site }) {
  const live = site?.hostname === LIVE_DOMAIN
  const body = live
    ? `User-agent: *\nAllow: /\nDisallow: /admin\n\nSitemap: ${new URL('/sitemap-index.xml', site)}\n`
    : 'User-agent: *\nDisallow: /\n'
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
