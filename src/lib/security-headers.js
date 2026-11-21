// Security headers sent with every response. Pages built ahead of time get them from public/_headers (Cloudflare reads
// it for static files); pages rendered on demand get them from src/middleware.js. A unit test keeps the two in step.
// The Content-Security-Policy for scripts, styles and the rest is added by Astro to each page (security.csp in
// astro.config.mjs); the header below only covers what a page cannot set for itself.
export const SECURITY_HEADERS = {
  // Always use HTTPS for this domain and its subdomains, for a year.
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  // Browsers must not guess file types (stops a file being run as a script it was never meant to be).
  'X-Content-Type-Options': 'nosniff',
  // No other site may show these pages inside a frame (stops click-jacking). Old browsers read X-Frame-Options.
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
  // Other sites see only our domain, never full addresses (which could include a payment reference).
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  // The site never needs these browser features.
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
}

/** The response with the security headers added (redirect responses have locked headers, so those are copied). */
export function withSecurityHeaders(response) {
  let target = response
  try {
    response.headers.set('X-Content-Type-Options', SECURITY_HEADERS['X-Content-Type-Options'])
  } catch {
    target = new Response(response.body, response)
  }
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    // Astro sends its own page policy (scripts, styles, …) as a header on on-demand pages. Ours is added alongside it
    // as a second policy rather than replacing it; browsers enforce both.
    if (name === 'Content-Security-Policy' && target.headers.has(name)) target.headers.append(name, value)
    else target.headers.set(name, value)
  }
  return target
}
