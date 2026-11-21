# Firearms Academy Canada — website

Website for [firearmsacademy.ca](https://firearmsacademy.ca), built with [Astro](https://astro.build) and Tailwind CSS 4,
hosted on Cloudflare Workers with a MongoDB Atlas database. It has three parts:

- **Public pages.** Most are static HTML. The home and dates pages read course weekends live from the database. Only the
  contact and registration forms load JavaScript (React).
- **Registration and contact API** (`/api/*`). It stores registrations and messages, takes seats, and sends emails.
- **Staff portal** (`/admin`). Owner and instructor logins for course weekends, class lists, payments and messages.

Requires Node 22.23.4 or newer.

```bash
npm install
npm run dev           # http://localhost:4321 (needs .env, see below)
npm run build         # outputs dist/
npm run preview       # serve the built site locally
npm run lint
npm test              # unit tests, a few seconds (see below)
npm run test:e2e      # end-to-end tests in a browser (see below)
npm run db:setup      # create database indexes and load the starting course weekends
npm run db:seed-test  # refill the test database with sample data (see below)
npm run staff:create  # add a staff login (see below)
npm run deploy        # build and upload to Cloudflare
```

## Where things live

| What | File |
|------|------|
| Phone, address, e-Transfer address, booking rules (how soon students are asked to pay, default seats) | `src/data/site.js` |
| Course descriptions, packages, prices | `src/data/courses.js` (prices in cents, taxes included; totals are calculated) |
| Course weekends, registrations, payments, messages | MongoDB Atlas (database `fac`), managed in the staff portal at `/admin` |
| Database rules (seat counting, payments, cancellations) | `src/lib/store.js` |
| Staff login | `src/lib/auth-config.js` (Better Auth; owner = `admin` role, instructor = `user` role) |
| Privacy policy settings (how long records are kept, privacy contact) | `privacy` in `src/data/site.js` (page: `src/pages/privacy.astro`) |
| FAQ | `src/data/faqs.js` |
| External links page | `src/data/links.js` |
| Colours ([Coolors palette](https://coolors.co/palette/780000-c1121f-fdf0d5-003049-669bbc)), fonts, shared classes (`btn`, `card`, `field`, `link`…) | `src/styles/global.css` |
| Page shell, `<head>`, SEO tags | `src/layouts/BaseLayout.astro` |
| Pages (one file per URL) | `src/pages/` (staff portal in `src/pages/admin/`, API in `src/pages/api/`) |
| Forms (React islands) | `src/components/forms/` |

## Database and staff portal

There are two databases in the same Atlas cluster:

| Database | Used by | Contents |
| --- | --- | --- |
| `fac` | The live site (`MONGODB_DB` in `wrangler.jsonc`) | Real students, payments and staff |
| `fac_test` | `npm run dev` and the scripts on your computer (`MONGODB_DB` in `.env`) | Sample data to try things on |

`npm run db:seed-test` wipes the test database and refills it with sample data, dated relative to today:
- **Weekends:** two finished weekends with attendance, a nearly full next weekend, a full one, one closed early, one
  cancelled, and open weekends further out.
- **Registrations:** about 60, paid by e-Transfer, cash or part payment, with some unpaid, removed, refunded or moved;
  every package, PAL details, seating requests, consent forms and staff notes.
- **Also:** contact messages (read and unread) and an email log.

It also creates three test-only logins: `owner@fac.test`, `ian@fac.test` and `ivy@fac.test`, with passwords in
`scripts/seed-test-data.mjs`. Run it again whenever you want a fresh copy. It refuses to run against `fac`.

To run a script against the live database instead, prefix it, for example
`MONGODB_DB=fac npm run staff:create -- --email … --name "…"`.

1. Copy `.env.example` to `.env` and fill it in (MongoDB connection string, a generated `BETTER_AUTH_SECRET`,
   `CRON_SECRET`). `npm run dev` and the scripts read it. For the live site, store the same values as Cloudflare
   secrets (see Deploying).
2. `npm run db:setup` creates the indexes and loads any missing course weekends from `scripts/seed-dates.mjs`.
   It is safe to run again. For the test database, `npm run db:seed-test` does this and adds the sample data.
3. Create the owner login, then one per instructor. A temporary password is printed once:

   ```bash
   npm run staff:create -- --email owner@example.com --name "Owner Name" --role owner
   ```

4. Sign in at `/admin`. The owner sees everything: dashboard, course weekends (add, edit seats, close, cancel, assign
   instructors), class lists, payments (search by reference, mark paid, remove unpaid students, refunds, moving a student to another weekend)
   and contact messages. Instructors see only the weekends they are assigned to, without payment amounts.

How bookings work: a registration takes a seat straight away and keeps it until staff change it. Students are asked to
pay within `booking.payWithinHours` (48) hours, but nothing happens automatically when they don't. The owner sees every
unpaid registration, with the date it was made, on the portal's **Payments** page and removes students who haven't paid
(**Remove** there, or on the registration's own page). That cancels the registration, frees the seat and emails the
student. Seats are taken and returned in the same database transaction as the registration, so a weekend can never be
oversold.

Payment is by Interac e-Transfer. After registering, the student sees the amount, the e-Transfer address and a payment
reference such as `FAC-0116-SMITH-K7Q`; the owner finds that reference in the portal and marks it paid. Set the receiving
address in `etransfer.email` in `src/data/site.js` (Interac Autodeposit recommended).

Forms include a hidden `_gotcha` spam-trap field, and the portal rejects form posts from other websites.

## Emails

Automatic emails are sent through [Resend](https://resend.com). Set `RESEND_API_KEY`, `EMAIL_FROM` (an address on a domain
verified in Resend), optionally `EMAIL_REPLY_TO`, and `OWNER_NOTIFY_EMAIL` (see `.env.example`). Until they are set the site
works normally and every email is recorded as “Not sent” in the portal’s **Emails** page, which also previews each one.

| Email | To | When |
| --- | --- | --- |
| Registration received, with e-Transfer details and reference | Student | They register |
| New registration | Owner | Someone registers |
| New contact message | Owner | Contact form sent |
| Course confirmation (dates, which day(s), address, map, what to know) | Student | Owner marks paid (optional on the registration page) |
| Moved / cancelled (with refund amount, or a "not paid" note when the owner removes an unpaid student) | Student | Owner moves, cancels or removes (optional on the registration page) |
| Class reminder | Student (paid) | 3 days before the course, after 9 a.m. Toronto time |
| Class list | Instructors assigned to the weekend | 2 days before the course, after 9 a.m. |

Templates are in `src/lib/email/templates.js`. Emails use inline styles because email apps ignore stylesheets (the one
exception to the site's Tailwind-only styling). A failed email never blocks a registration or a staff action; it shows as
“Failed” in the email log. The two scheduled emails (class reminder and class list) come from an hourly Cloudflare cron
trigger (`wrangler.jsonc` → `src/worker.js` → `/api/cron/hourly`). It only sends those emails; it never changes
registrations or seats. Each email is marked in the database before it is sent, so it can never go out twice.

## Unit tests (Vitest)

```bash
npm test             # run once
npm run test:watch   # rerun on every save
```

Unit tests sit next to the code they check, as `*.test.js`, and run in a few seconds. They cover the rules where a
mistake would cost money or seats, or garble an email:

| File | Covers |
| --- | --- |
| `src/data/dates.test.js` | Toronto dates near midnight and across daylight saving, weekend labels, impossible dates |
| `src/data/courses.test.js` | Package totals and prices, which packages need PAL details |
| `src/lib/paymentReference.test.js` | Reference format, accented and unusual names, no easily confused characters |
| `src/lib/admin.test.js` | Reading typed dollar amounts (including "158,30"), redirects, access rules, error messages |
| `src/lib/email/templates.test.js` | Email wording, class lists, HTML escaping of anything a visitor typed |
| `src/lib/store.test.js` | Booking rules against an in-memory MongoDB: server-side prices, never overselling, payments, cancelling, moving, claiming each scheduled email once |

## End-to-end tests (Playwright)

```bash
npx playwright install chromium   # once, downloads the test browser
npm run test:e2e                  # build the site and run every test
npm run test:e2e:ui               # the same, in Playwright's interactive window
```

The tests never touch the real database or send real email. `npm run test:e2e` starts `e2e/server.mjs`, which runs:

- an in-memory MongoDB (downloaded automatically the first time);
- a fake Resend service that records emails instead of sending them;
- the built site in Cloudflare's local runtime at http://127.0.0.1:4390.

It also creates two test-only staff logins, listed in `e2e/env.js`. Before each test, `e2e/fixtures.js` resets the
database to four known course weekends and empties the fake inbox. Because the tests share one database, they run one at
a time. Every test runs at desktop size, and the public pages and forms run again at phone size (about a minute in all,
including the build).

To keep the test server running between runs, start it in one terminal with `npm run test:e2e:server`; the tests reuse it.
Set `E2E_SKIP_BUILD=1` to skip the build when only tests changed. After rebuilding the site, restart the test server:
it cannot pick up a new build while running.

| File | Covers |
| --- | --- |
| `e2e/public.spec.js` | Home and dates pages read live weekends; Full labels; navigation (and the phone menu); old `.php` redirects; 404; privacy policy links |
| `e2e/registration.spec.js` | Registering, payment instructions, emails, guide discount, PAL details, full and closed weekends, the race for the last seat, spam trap |
| `e2e/contact.spec.js` | Contact form to owner email and the portal's messages |
| `e2e/admin-access.spec.js` | Sign in and out, safe redirects, no caching, owner vs instructor access |
| `e2e/admin-payments.spec.js` | Unpaid list, Mark paid, Remove (with its confirmation), reference search, cash payments |
| `e2e/admin-weekends.spec.js` | Adding and editing weekends, closing and cancelling, assigning instructors, moving and cancelling students, course-day details |
| `e2e/emails-and-cron.spec.js` | Email log and previews; the hourly job's secret, and that it never changes seats |

## Deploying (Cloudflare Workers)

The site runs on Cloudflare Workers (`@astrojs/cloudflare`, configured in `wrangler.jsonc`). Static pages are served as
files; the date pages, registration API, staff portal and hourly job run in the Worker (`src/worker.js`).

Use the **Workers Paid** plan (US$5/month): the free plan allows only about 10 ms of CPU per request, which is not
enough for checking staff passwords at sign-in.

1. **MongoDB Atlas → Network Access:** allow `0.0.0.0/0`. Cloudflare Workers have no fixed IP addresses, so Atlas
   cannot be limited to them; the database user's strong password is the protection. For `npm run dev` on your own
   computer, your current IPv4 address must also be allowed (Cloudflare's local runtime connects over IPv4).
2. `npx wrangler login`, then store each secret once:

   ```bash
   npx wrangler secret put MONGODB_URI
   ```

   Repeat for `BETTER_AUTH_SECRET`, `CRON_SECRET` and, when email is ready, `RESEND_API_KEY`, `EMAIL_FROM`,
   `EMAIL_REPLY_TO`, `OWNER_NOTIFY_EMAIL`. `MONGODB_DB` and `BETTER_AUTH_URL` are set in `wrangler.jsonc`.
3. Deploys normally happen on GitHub (see below). `npm run deploy` still builds and uploads straight from your computer
   when needed.
4. Add `firearmsacademy.ca` as a custom domain on the Worker. The domain's DNS must be on Cloudflare: copy all
   existing records, especially MX (email), before switching nameservers.

Old `.php` URLs are listed under `redirects` in `astro.config.mjs`; the build turns them into a `_redirects` file that
Cloudflare serves as real 301s. The home and dates pages are cached at Cloudflare's edge for 60 seconds and refreshed
whenever seats change.

Two things to know when working on the site:
- **One database connection per request.** Workers can't reuse a connection across requests, so `src/middleware.js`
  gives each request its own MongoDB client (`src/lib/request-scope.js`) and closes it afterwards.
- **`npm run dev` runs pages in Cloudflare's runtime** (workerd), so it behaves like the live site.
  Two small files in `src/shims/` keep the MongoDB driver happy there. `whatwg-url.js` stands in for a driver
  dependency that can't load in workerd. `process.js`, used by `astro dev` only, avoids a harmless but noisy
  "no match for module: node:process" error.

### Automatic tests and deploys (GitHub Actions)

`.github/workflows/ci.yml` runs on GitHub:
- **Every pull request:** lint, unit tests and end-to-end tests. The result shows on the pull request.
- **Every merge (push) to `main`:** the same checks, then, only if they all pass, a build and `wrangler deploy` to
  Cloudflare. Both appear under the repository's **Actions** tab. A failing test blocks the deploy.

One-time setup:
1. **Cloudflare API token.** In the Cloudflare dashboard, go to My Profile → API Tokens → Create Token, and use the
   **Edit Cloudflare Workers** template for your account.
2. **GitHub secrets.** In GitHub, go to Settings → Secrets and variables → Actions → New repository secret, and add:
   - `CLOUDFLARE_API_TOKEN`: the token from step 1;
   - `CLOUDFLARE_ACCOUNT_ID`: shown on the Workers & Pages overview page in Cloudflare.
3. **Protect `main` (optional; private repositories need GitHub Pro or Team).** In GitHub, go to Settings → Branches →
   Add rule for `main`, then tick "Require a pull request before merging" and "Require status checks to pass",
   choosing **Lint and test**. GitHub then refuses to merge failing pull requests. Without it, failing code can still
   be merged into `main`, but it is never deployed.

Don't also connect Cloudflare's own Git integration (Workers Builds): the site would deploy twice on every push, and
without waiting for the tests. If a test fails on GitHub, open the failed run: a `playwright-report` download holds
screenshots and a trace of each failed browser test.

## Roadmap

What is built, what is left before launch, what could come later, and monthly costs: [docs/ROADMAP.md](docs/ROADMAP.md).
