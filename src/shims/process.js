// Used only by `astro dev` (see astro.config.mjs). The MongoDB driver imports `process`; under `astro dev` the
// Workers runtime first asks Vite's module fallback service for `node:process`, and the Cloudflare plugin logs that
// lookup as an error before the built-in loads. The runtime already provides `process` as a global with
// nodejs_compat, so hand the driver that object directly. Production builds resolve `process` correctly on their own.
export default globalThis.process
