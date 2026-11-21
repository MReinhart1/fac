// /robots.txt. When search engines may list the site (allowSearchEngines and LIVE_DOMAIN in src/data/site.js), it
// points them to the sitemap. Otherwise it still lets them read the pages, on purpose: each page carries a "noindex"
// tag (BaseLayout), and a crawler that is blocked from a page never sees that tag, so it could list the address anyway.
import { allowSearchEngines, LIVE_DOMAIN } from '../data/site.js'

export function GET({ site }) {
  const indexable = allowSearchEngines && site?.hostname === LIVE_DOMAIN
  const lines = ['User-agent: *', 'Allow: /', 'Disallow: /admin']
  if (indexable) lines.push('', `Sitemap: ${new URL('/sitemap-index.xml', site)}`)
  return new Response(`${lines.join('\n')}\n`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
