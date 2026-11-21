import { useEffect, useRef, useState } from 'react'
import { booking, etransfer, phone } from '../../data/site.js'

function CopyButton({ value, label }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard can be blocked; the value is still on screen to select by hand.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="shrink-0 cursor-pointer rounded-md border border-line bg-white px-2.5 py-1 text-xs font-bold text-navy transition-colors hover:border-navy print:hidden"
      aria-label={`Copy ${label}`}
    >
      <span aria-live="polite">{copied ? 'Copied' : 'Copy'}</span>
    </button>
  )
}

function Detail({ label, value, copyValue = value, large = false }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line py-3 last:border-0">
      <div className="min-w-0">
        <dt className="text-xs font-semibold text-muted">{label}</dt>
        <dd className={`font-bold break-all ${large ? 'font-display text-2xl font-extrabold' : 'text-[15px]'}`}>{value}</dd>
      </div>
      <CopyButton value={copyValue} label={label.toLowerCase()} />
    </div>
  )
}

/** One numbered step of the payment instructions. */
function Step({ number, title, children }) {
  return (
    <li className="grid grid-cols-[auto_1fr] gap-3.5">
      <span className="grid size-7 place-items-center rounded-full bg-cream text-sm font-bold text-red">{number}</span>
      <div>
        <p className="font-semibold">{title}</p>
        {children}
      </div>
    </li>
  )
}

/** Shown in place of the registration form once it has been sent. */
export default function PaymentInstructions({ registration, onRegisterAnother }) {
  const headingRef = useRef(null)
  const { reference, amountDue, course, courseDate, firstName, email, payWithinHours = booking.payWithinHours } = registration

  // Move focus (and scroll) to the confirmation so keyboard and screen reader users land on it.
  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  return (
    <section className="mx-auto grid max-w-[760px] gap-5" aria-labelledby="payment-heading">
      <div className="rounded-2xl bg-navy p-6 text-cream nav:p-8">
        <div className="flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-steel text-navy" aria-hidden="true">
            <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </span>
          <div>
            <h2 id="payment-heading" ref={headingRef} tabIndex={-1} className="font-display text-2xl font-extrabold outline-none">
              Registration received{firstName ? `, ${firstName}` : ''}
            </h2>
            <p className="mt-1.5 text-cream/80">
              {course}
              {courseDate ? ` · ${courseDate}` : ''}
            </p>
          </div>
        </div>
        <p className="mt-5 rounded-lg bg-cream/10 px-4 py-3 text-sm text-cream">
          <strong>Please send your payment within {payWithinHours} hours.</strong> Your seat is confirmed once it arrives; unpaid
          registrations may be cancelled so the seat can go to someone else.
        </p>
      </div>

      <div className="card p-6 nav:p-8">
        <p className="eyebrow">Pay by Interac e-Transfer</p>
        <h3 className="font-display text-xl font-bold">Send your payment from your bank</h3>

        <ol className="mt-5 grid gap-5">
          <Step number={1} title="Send this amount to this address">
            <dl className="mt-2 rounded-xl border border-line bg-paper px-4">
              {/* Banks expect a plain number, so copy "237.30" rather than "$237.30". */}
              <Detail label="Amount" value={amountDue} copyValue={amountDue.replace(/[^\d.]/g, '')} large />
              {etransfer.email ? (
                <Detail label="Send to" value={etransfer.email} />
              ) : (
                <div className="py-3 text-sm text-muted">We will email you the e-Transfer address with your registration details.</div>
              )}
            </dl>
          </Step>
          <Step number={2} title="Put this reference in the e-Transfer message">
            <dl className="mt-2 rounded-xl border border-line bg-paper px-4">
              <Detail label="Reference" value={reference} />
            </dl>
            <p className="small-note">
              If your bank asks for a security question, use “Registration reference” as the question and your reference code as the answer.
            </p>
          </Step>
          <Step number={3} title="Watch for your confirmation">
            <p className="body-text text-sm">
              Once your payment arrives, we will email your course confirmation to <strong className="text-navy">{email}</strong>. It takes about
              one business day. If you have not heard from us within 2 business days, call {phone.display}.
            </p>
          </Step>
        </ol>

        <p className="small-note mt-6 border-t border-line pt-4">
          Keep this page or note your reference code. If you are paying for more than one person, register each person separately.
        </p>
        <div className="mt-5 flex flex-wrap gap-3 print:hidden">
          <button type="button" className="btn btn-outline" onClick={() => window.print()}>
            Print these instructions
          </button>
          <button type="button" className="btn btn-navy" onClick={onRegisterAnother}>
            Register another person
          </button>
        </div>
      </div>
    </section>
  )
}
