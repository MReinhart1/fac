import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { SECURITY_HEADERS, withSecurityHeaders } from './security-headers.js'

describe('security headers', () => {
  it('are the same for pre-built pages (public/_headers) and on-demand pages (middleware)', () => {
    const fromFile = Object.fromEntries(
      readFileSync(new URL('../../public/_headers', import.meta.url), 'utf8')
        .split('\n')
        .filter((line) => /^\s+\S+:/.test(line))
        .map((line) => {
          const [name, ...value] = line.trim().split(':')
          return [name, value.join(':').trim()]
        }),
    )
    expect(fromFile).toEqual(SECURITY_HEADERS)
  })

  it('are added to an ordinary response', () => {
    const response = withSecurityHeaders(new Response('ok', { headers: { 'Content-Type': 'text/html' } }))
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) expect(response.headers.get(name)).toBe(value)
    expect(response.headers.get('Content-Type')).toBe('text/html')
  })

  it('are added to a redirect, whose headers are normally locked', () => {
    const response = withSecurityHeaders(Response.redirect('https://example.test/admin/login', 302))
    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe('https://example.test/admin/login')
    expect(response.headers.get('X-Frame-Options')).toBe('DENY')
  })

  it("add the framing policy next to a page's own Content-Security-Policy, without replacing it", () => {
    const response = withSecurityHeaders(new Response('ok', { headers: { 'Content-Security-Policy': "default-src 'self'" } }))
    const policy = response.headers.get('Content-Security-Policy')
    expect(policy).toContain("default-src 'self'")
    expect(policy).toContain("frame-ancestors 'none'")
  })
})
