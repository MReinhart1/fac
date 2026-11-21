# Firearms Academy Canada — Roadmap

As of November 21, 2026. How the site works, and how to run, test and deploy it, is in the [README](../README.md). A longer
planning version is in the shared doc: https://claude.ai/artifact/4tHAajjWDcPkazLAGxgRnh (the two do not sync).

## Where the site stands

The website, database, staff portal and automatic emails are built, tested and live at https://mreinhart-fac-demo.com. It
is a demo, so search engines are asked not to list it. What is left is mostly the owner's content and settings.

## Left to do

- [ ] **e-Transfer address.** Set `etransfer.email` in `src/data/site.js`, ideally an address with Interac Autodeposit on.
  Until then, the payment page and emails say the address will be sent separately.
- [ ] **Booking rules.** The owner confirms seats per class (20 now) and how soon students are asked to pay (48 hours now).
- [ ] **Privacy policy answers.** Fill in `privacy` in `src/data/site.js`: how long records are kept, and a name and email
  for privacy questions. Until then `/privacy` shows "to be confirmed" and a draft notice. Worth a quick legal read.
- [ ] **Content check.** The owner reads every page, especially the home-page copy, prices, policy and hunter-education
  contacts, and checks the old external links on the Links page.
- [ ] **Photos and logo.** Real classroom photos and the FAC logo replace the text badge.
- [ ] **Email replies.** Set `EMAIL_REPLY_TO` to a real inbox, or forward `bookings@mreinhart-fac-demo.com` with Cloudflare
  Email Routing, and add a DMARC record so emails are less likely to be filed as spam.
- [ ] **Workers Paid.** Confirm the Cloudflare account is on Workers Paid (US$5/month); the free plan's CPU limit can
  make staff sign-in fail.
- [ ] **Optional:** a `www` redirect (Cloudflare → Rules → Redirect Rules, "Redirect from WWW to root").

Done: database and indexes, staff logins, Atlas network access, hosting on Cloudflare Workers, the domain with HTTPS,
email from the domain (verified in Resend), GitHub repository with automatic tests and deploys, privacy policy draft,
security headers, and accessibility and SEO checks in the test suite.

## Booking and payment rules

Every registration takes a seat straight away and carries one payment reference, which is how an e-Transfer is matched
to a student. An unpaid student keeps the seat until the owner removes them; nothing is released automatically.

![Registration lifecycle](roadmap/registration-lifecycle.png)

**Cancellation policy.** The owner applies these by hand: the refund is typed when cancelling, and no reschedule fee is
charged automatically.

| Situation | Rule from the current policy |
| --- | --- |
| Cancel 14+ days before | Refund minus the $100 non-refundable deposit |
| Cancel within 14 days | Only if the seat is filled from the waitlist |
| Cancel or reschedule within 48 hours | Not accepted |
| First reschedule, 7+ days before | Free |
| Second reschedule | $75 service charge |
| Reschedule under 7 days before | $100 service charge |
| No-show | Full fee forfeited |

**Cards (not built).** Only through the payment page of a processor that approves a firearms-training business in
writing (Stripe Checkout, or the old site's merchant account), so card numbers never touch the site. Stripe lists
firearms businesses as restricted, approved case by case, and Square's Canadian terms ban firearms sales
([Stripe](https://stripe.com/en-gb-ca/legal/restricted-businesses), [Square](https://squareup.com/ca/en/legal/general/ua)).

## Privacy and security

Storing student records makes the business responsible for them under PIPEDA. A starting checklist, not legal advice:

- **Collect only what is used:** name, contact details, course choice and, for restricted-only packages, the PAL course
  date and instructor. No date of birth, PAL number or ID scans.
- **Minors:** the portal records only whether a signed consent form was received; the paper form stays with the owner.
- **Access:** invite-only staff logins; instructors see only their own classes, without payment amounts; every change is
  written to the audit log. Two-factor login is not built yet.
- **Site security:** HTTPS only, strict security headers and Content-Security-Policy, no card data anywhere.
- **Storage and backups:** Atlas encrypts data at rest and in transit, takes a daily snapshot and keeps the last 8; the
  owner also keeps a monthly export. Choose a Canadian region if the tier offers one.
- **Retention:** delete or anonymize student records a set time after the course (the owner chooses the period; not
  automated yet).
- **Breaches:** PIPEDA requires reporting a breach that creates a real risk of significant harm to the Privacy
  Commissioner and to affected people, and keeping a record of every breach for 24 months.
- **Emails** are transactional, so they need no marketing consent under Canada's anti-spam law (CASL). A newsletter would
  need opt-in consent and an unsubscribe link.

## Costs

About **US$15 a month, roughly CA$21**, assuming up to 30 students a month, 5 staff logins and 150–300 emails a month.
Prices were checked on each provider's pricing page on November 20, 2026.

| Provider | Used for | Plan | Monthly |
| --- | --- | --- | --- |
| Cloudflare Workers | Hosting, server code, edge cache, hourly job | Workers Paid: US$5 minimum, including 10 million requests and 30 million CPU ms | US$5 |
| MongoDB Atlas | Database | Flex: US$8 up to 100 operations a second (5 GB), capped at US$30 | US$8 |
| Better Auth | Staff login | Open-source library, stored in Atlas | US$0 |
| Resend | Emails | Free: 3,000 a month, 100 a day. Pro is US$20 for 50,000 | US$0 |
| Domain | mreinhart-fac-demo.com | Cloudflare Registrar | about US$1 (not checked) |
| **Total** | | | **about US$15** |

**Card payments, if added:** Stripe's Canadian rate is 2.9% + CA$0.30 per payment, about CA$7.79 on a $258.30 package and
CA$13.36 on a $450.40 one; at 20 card payments a month, roughly CA$160–270. Receiving e-Transfers is usually free, but some
business accounts charge per transfer. Not included: development time, photography, legal review of the privacy policy.

Sources: [Cloudflare Workers](https://developers.cloudflare.com/workers/platform/pricing/),
[Atlas Flex](https://mongodb.com/docs/atlas/billing/atlas-flex-costs),
[Atlas Flex backups](https://mongodb.com/docs/atlas/backup/cloud-backup/flex-cluster-backup),
[Resend](https://resend.com/pricing), [Stripe Canada](https://support.stripe.com/questions/2024-pricing-update-for-canadian-businesses).

## Later

Roughly in order of usefulness; none blocks launch.

| Item | What it adds |
| --- | --- |
| Staff page | Owner adds, removes and resets instructor logins in the portal instead of the command line |
| Two-factor login | Extra protection for the owner account |
| Waitlist | Full weekends take waitlist sign-ups; a "seat open" email goes out when a seat frees up |
| Policy helpers | Portal suggests the refund or reschedule fee from the cancellation policy; owner confirms |
| Class tools | CSV export of a class list; email the whole class |
| Record retention | Automatically anonymize student records after the chosen period |
| Packages and prices in the portal | Owner edits prices without a code change |
| Card payments | After written approval from a processor (about a week of work) |
| Exam results | Written and practical scores per student |

## Open questions for the owner

- [ ] Which email address receives e-Transfers, and is Autodeposit on?
- [ ] How many seats per class? Is capacity different for Saturday (CFSC) and Sunday (CRFSC)?
- [ ] How soon should students pay after registering (48 hours now), and how long does the owner wait before removing an unpaid student?
- [ ] How many instructors need logins?
- [ ] How long should student records be kept after a course?
- [ ] Are photos of classes available, and is the FAC logo available as a vector file?
- [ ] Which company processes cards on the old site today? An existing approved merchant account avoids a new approval.
- [ ] Is cash accepted on course day? (The portal can already record cash payments.)
- [ ] Should exam results be recorded in the system?
