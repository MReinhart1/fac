import { useState, useSyncExternalStore } from 'react'
import { DEFAULT_PACKAGE_ID, findPackage, GUIDE_PRICE, money, packages } from '../../data/courses.js'
import { booking, phone } from '../../data/site.js'
import { Checkbox, Field, FormStatus, Honeypot, SubmitButton } from './fields.jsx'
import PaymentInstructions from './PaymentInstructions.jsx'
import useFormSubmit from './useFormSubmit.js'

const formGrid = 'grid gap-x-4 gap-y-4 nav:grid-cols-2'
const policyHeading = 'mb-1.5 text-sm font-bold'
const policyList = 'mb-4 list-disc pl-5 text-sm leading-[1.65] text-muted'

// Browser-only values. The server snapshot is used for the server-rendered HTML and for hydration;
// React then re-renders with the browser value, so the page never mismatches.
const noSubscribe = () => () => {}
const useBrowserValue = (read, serverValue) => useSyncExternalStore(noSubscribe, read, () => serverValue)
const readParam = (name) => () => new URLSearchParams(window.location.search).get(name)
const readCourseParam = readParam('course')
const readDateParam = readParam('date')
// Local yyyy-mm-dd, so the PAL course date picker cannot go past today.
const readToday = () => new Date().toLocaleDateString('en-CA')

function Section({ number, title, children }) {
  return (
    <fieldset className="card relative m-0 min-w-0 px-5 pt-5 pb-6 nav:px-7 nav:pt-6 nav:pb-7">
      <legend className="sr-only">{title}</legend>
      <h2 className="mb-5 flex items-center gap-3 font-display text-lg font-bold" aria-hidden="true">
        <span className="grid size-8 place-items-center rounded-full bg-navy text-sm text-cream">{number}</span>
        {title}
      </h2>
      {children}
    </fieldset>
  )
}

/**
 * `sessions` are the upcoming course weekends, read live from the database by the page:
 * { id, start, label, full, seatsLeft }. The server re-checks seats and prices when the form is sent.
 */
export default function RegisterForm({ sessions = [], unavailable = false }) {
  // ?course= and ?date= come from the Register links on course, pricing and date listings.
  const requestedCourse = useBrowserValue(readCourseParam, null)
  const requestedDate = useBrowserValue(readDateParam, null)
  const today = useBrowserValue(readToday, undefined)
  const [chosenCourse, setChosenCourse] = useState(null)
  const [chosenSession, setChosenSession] = useState(null)
  const [hasGuide, setHasGuide] = useState(false)
  // The server's reply once registration succeeds; switches the form to payment instructions.
  const [registration, setRegistration] = useState(null)

  const bookable = sessions.filter((item) => !item.full)
  const courseId = chosenCourse ?? (findPackage(requestedCourse) ? requestedCourse : DEFAULT_PACKAGE_ID)
  const requestedSession = bookable.find((item) => item.start === requestedDate)
  const sessionId = chosenSession ?? requestedSession?.id ?? ''
  const selectedDate = sessions.find((item) => item.id === sessionId)
  const selected = findPackage(courseId)
  const total = selected.total - (hasGuide ? GUIDE_PRICE : 0)

  const [status, submit] = useFormSubmit('/api/register', {
    extra: () => ({ hasGuide }),
    validate: (data) =>
      data.email.trim().toLowerCase() !== data.confirmEmail.trim().toLowerCase() ? 'The email addresses do not match.' : null,
    onSent: (reply) => {
      setRegistration(reply.reference ? reply : null)
      setChosenCourse(null)
      setChosenSession('')
      setHasGuide(false)
    },
  })

  if (registration) {
    return <PaymentInstructions registration={registration} onRegisterAnother={() => setRegistration(null)} />
  }

  return (
    <form className="grid items-start gap-6 nav:grid-cols-[1fr_340px]" onSubmit={submit} aria-label="Course registration">
      <div className="grid min-w-0 gap-5">
        <Section number="1" title="Choose a course">
          <div className="grid gap-2.5">
            {packages.map((option) => (
              <label
                className={`grid cursor-pointer grid-cols-[auto_1fr] items-center gap-3.5 rounded-xl border px-4 py-4 transition-colors nav:grid-cols-[auto_1fr_auto] ${
                  courseId === option.id ? 'border-navy bg-paper ring-1 ring-navy' : 'border-line hover:border-navy/40'
                }`}
                key={option.id}
              >
                <input
                  className="size-4.5 accent-red"
                  type="radio"
                  name="courseId"
                  value={option.id}
                  checked={courseId === option.id}
                  onChange={() => setChosenCourse(option.id)}
                />
                <span className="grid gap-0.5">
                  <strong className="text-[15px]">
                    {option.title} <span className="font-semibold text-muted">({option.covers.toLowerCase()})</span>
                  </strong>
                  <small className="text-[13px] text-muted">{option.note ?? 'Course materials, test fee and taxes included.'}</small>
                </span>
                <b className="col-start-2 font-display text-lg nav:col-start-auto">{money(option.total)}</b>
              </label>
            ))}
          </div>

          <div className={`${formGrid} mt-5`}>
            <Field
              label="Course date"
              as="select"
              name="courseSessionId"
              required
              value={sessionId}
              onChange={(event) => setChosenSession(event.target.value)}
            >
              <option value="" disabled>
                {bookable.length ? 'Select a date' : unavailable ? `Dates unavailable — please call ${phone.display}` : 'No dates open — please contact us'}
              </option>
              {sessions.map((item) => (
                <option key={item.id} value={item.id} disabled={item.full}>
                  {item.label}
                  {item.full ? ' (full)' : item.seatsLeft <= 5 ? ` (${item.seatsLeft} ${item.seatsLeft === 1 ? 'seat' : 'seats'} left)` : ''}
                </option>
              ))}
            </Field>
          </div>

          {selected.needsPal && (
            <div className="mt-5 rounded-xl border border-line bg-paper px-4 pt-3.5 pb-4">
              <p className="mb-3 text-sm leading-normal text-muted">
                Restricted-only bookings: tell us when you took the non-restricted (PAL) course and who taught it.
              </p>
              <div className={formGrid}>
                <Field label="Date you completed the PAL course" name="palCourseDate" type="date" required max={today} />
                <Field label="Name of your instructor" name="palInstructor" required />
              </div>
            </div>
          )}

          <Checkbox name="waitlist">Waitlist me for an earlier class if a space opens (requires a booked and paid course).</Checkbox>
          <p className="small-note">
            Course materials are normally delivered at the class. To receive them ahead of time, pick them up at the Legion Hall on a course
            day; please{' '}
            <a className="link" href="/contact">
              contact us
            </a>{' '}
            first. Class sizes are limited. Spaces are allocated only after payment is received.
          </p>
          <p className="small-note">Booking for more than one person? Please fill in a separate form for each person; each pays separately.</p>
        </Section>

        <Section number="2" title="Your details">
          <div className={formGrid}>
            <Field label="First name" name="firstName" required autoComplete="given-name" />
            <Field label="Family name" name="familyName" required autoComplete="family-name" />
            <Field label="Nickname" name="nickname" placeholder="What should the instructor call you?" />
            <Field label="Friend / colleague name" name="friendName" placeholder="So we can seat you together" />
            <Field label="Daytime / primary phone" name="phone" type="tel" required autoComplete="tel" placeholder="e.g. 416-966-4867" />
            <Field label="Extension" name="phoneExt" inputMode="numeric" />
            <Field label="Evening phone (if different)" name="eveningPhone" type="tel" />
            <Field label="Extension" name="eveningPhoneExt" inputMode="numeric" />
            <Field label="Email address" name="email" type="email" required autoComplete="email" />
            <Field label="Confirm email address" name="confirmEmail" type="email" required autoComplete="email" />
          </div>
          <div className="mt-4">
            <Field label="Comments" as="textarea" className="resize-y" name="comments" rows={3} />
          </div>
          <p className="small-note">
            Your course confirmation will be emailed to this address, so make sure it is valid. See our{' '}
            <a className="link" href="/privacy">
              privacy policy
            </a>{' '}
            for how we use your details.
          </p>
          <Honeypot />
        </Section>

        <Section number="3" title="Cancellation & reschedule policy">
          <h3 className={policyHeading}>Cancellations</h3>
          <ul className={policyList}>
            <li>Accepted up to 2 weeks (14 calendar days) before a scheduled course. There is a $100 non-refundable deposit.</li>
            <li>Within the 2-week window, accepted only if we are able to fill your seat.</li>
            <li>Not accepted within 48 hours of a session.</li>
            <li>If you do not show up for a class, the full fee is forfeited.</li>
          </ul>
          <h3 className={policyHeading}>Reschedules</h3>
          <ul className={`${policyList} mb-0`}>
            <li>Freely accepted up to 1 week (7 calendar days) before a session; a second reschedule carries a $75 service charge.</li>
            <li>Requests less than 1 week (7 calendar days) before a session carry a $100 service charge.</li>
            <li>Not accepted within 48 hours of a session.</li>
            <li>If you do not show up without prior notification, the full fee is forfeited.</li>
          </ul>
        </Section>
      </div>

      <aside className="overflow-hidden rounded-2xl border border-navy bg-white shadow-lg nav:sticky nav:top-28" aria-label="Registration summary">
        <div className="bg-navy px-6 py-5 text-cream">
          <p className="eyebrow-dark mb-1">Your registration</p>
          <p className="font-display text-lg leading-snug font-bold">{selected.title}</p>
          <p className="mt-1 text-sm text-cream/75">{selectedDate ? selectedDate.label : 'No date selected yet'}</p>
        </div>
        <div className="px-6 pt-4 pb-6">
          <dl className="text-sm">
            <div className="flex justify-between gap-4 border-b border-line py-2.5">
              <dt className="text-muted">Course, including {selected.exams > 1 ? 'exams' : 'exam'}</dt>
              <dd className="font-bold">{money(selected.coursePrice)}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-line py-2.5">
              <dt className="text-muted">Student guide</dt>
              <dd className="font-bold">{hasGuide ? '—' : money(GUIDE_PRICE)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 pt-3.5">
              <dt className="font-bold">Total</dt>
              <dd className="font-display text-[28px] font-extrabold">{money(total)}</dd>
            </div>
          </dl>
          <p className="mt-0.5 text-right text-xs text-muted">Taxes included</p>

          <Checkbox checked={hasGuide} onChange={(event) => setHasGuide(event.target.checked)}>
            I already have the student guide (−{money(GUIDE_PRICE)})
          </Checkbox>
          <Checkbox name="agree" required>
            I have read and agree to the policy. A portion of my registration fee is non-refundable.
          </Checkbox>

          <SubmitButton status={status} label="Submit registration" className="mt-5 w-full" />
          <FormStatus status={status} />
          <p className="mt-4 rounded-lg bg-paper px-3.5 py-3 text-[13px] leading-[1.55] text-navy">
            <strong>Pay by Interac e-Transfer.</strong> After you submit, you will get the amount, where to send it and your payment reference.
          </p>
          <p className="small-note">
            Please send your payment within {booking.payWithinHours} hours of registering. Your seat is confirmed once payment is received,
            and unpaid registrations may be cancelled. It takes about one business day to process your payment and email your confirmation. Electronic devices are not permitted in our classrooms.
          </p>
        </div>
      </aside>
    </form>
  )
}
