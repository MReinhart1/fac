# Old Site Sitemap — firearmsacademy.ca

No `sitemap.xml` exists on the old site (404). Pages below were discovered from site navigation, in-page links, and URL probing. Verified 2026-11-18.

## Pages

| # | Old URL | Title | Linked from | New site route | Status |
|---|---------|-------|-------------|----------------|--------|
| 1 | `/index.php` (also `/`) | Home | Brand link on every page | `/` | Built |
| 2 | `/courses.php` | Course Descriptions | Home page "Learn more" buttons | `/#courses` (cards on home) | Built (section on home; no standalone page) |
| 3 | `/register.php` | Register | Global nav/footer | `/register` | Built (form with course/date selection, policy, estimated total; needs a submission endpoint and payment handling, see below) |
| 4 | `/faq.php` | FAQ | Global nav/footer | `/faq` | Built |
| 5 | `/contact.php` | Contact Us | Global nav/footer | `/contact` | Built (needs a submission endpoint) |
| 6 | `/certified.php` | FSESO Certified | Home page "CFO designated instructors" | `/certified` | Built |
| 7 | `/dates.php` | Course Dates | Global nav ("When") | `/dates` | Built |
| 8 | `/locations.php` | Course Location (Legion Hall Branch 31, 1050 Weston Rd, York, ON M6N 3S2) | Global nav ("Where") | `/locations` | Built |
| 9 | `/links.php` | Links (external resources) | Not linked from nav | `/links` (footer) | Built |
| 10 | `/ohep.php` | Ontario Hunter Education Program | Global nav ("Hunter Education") | `/hunter-education` | Built |
| 11 | `/pricing.php` | Pricing | Global nav ("How Much") | `/pricing` | Built |

## Files / Assets

| Old URL | Description | Status |
|---------|-------------|--------|
| `/consent-form-2019.pdf` | Parental consent form for under-18 students (linked from FAQ) | Returns 404 on the old site now; replaced by a printable page at `/consent` |
| `/faclogoc.jpg` | FAC logo (used on register page) | Not used; new site uses a text "FAC" mark |
| `/images/fseso-logo-trans-1.png` | FSESO logo (certified page) | Not used |

## Global Navigation (old site)

- Toronto Firearms Courses (home)
- Descriptions (`courses.php`)
- When (`dates.php`)
- Where (`locations.php`)
- How Much (`pricing.php`)
- Hunter Education (`ohep.php`)
- Register
- FAQ
- Contact Us

## Excluded by robots.txt

`/css/`, `/fac/`, `/images/`, `/includes/`, `/js/`

## Confirmed Not Present (404)

`about.php`, `schedule.php`, `privacy.php`, `terms.php`, `location.php`, `policy.php`, `thankyou.php`, `instructors.php`, `exam.php`, `hunter.php`, `directions.php`, `pal.php`, `cfsc.php`, `crfsc.php`, `gallery.php`, `news.php`, `sitemap.xml`

## Remaining Work

1. Registrations and contact messages are stored in MongoDB and shown in the staff portal (`/admin`); see README.
2. Payment is by Interac e-Transfer (see README). Set `etransfer.email` in `src/data/site.js` before launch. Card payments would need a processor that approves firearms training.
3. Course weekends are managed in the staff portal; past weekends hide themselves.

Every old URL above redirects to its new route (`redirects` in `astro.config.mjs`, written to `_redirects` and served as 301s by Cloudflare).
