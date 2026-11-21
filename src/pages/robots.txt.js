// /robots.txt, built from the site's address in astro.config.mjs. Only the real domain invites search engines;
// the demo domain asks them to stay away (BaseLayout adds a matching "noindex" tag to every page).
import { LIVE_DOMAIN } from '../data/site.js'

export function GET({ site }) {
  const live = site?.hostname === LIVE_DOMAIN
  const body = live
    ? `User-agent: *\nAllow: /\nDisallow: /admin\n\nSitemap: ${new URL('/sitemap-index.xml', site)}\n`
    : 'User-agent: *\nDisallow: /\n'
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
