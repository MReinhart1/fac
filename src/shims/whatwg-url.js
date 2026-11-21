// Replaces the `whatwg-url` package inside the Worker (see astro.config.mjs). The MongoDB driver's connection-string
// parser only needs URL and URLSearchParams, which the Workers runtime has built in. Production builds already get
// this swap from Wrangler; this makes `astro dev` behave the same.
export const URL = globalThis.URL
export const URLSearchParams = globalThis.URLSearchParams
