// Astro.url.pathname is "/faq.html" in builds (build.format: 'file') and "/faq" in dev.
// Normalize both to "/faq", and the home page to "/".
export const cleanPath = (pathname) => pathname.replace(/(\/index)?\.html$/, '').replace(/\/$/, '') || '/'
