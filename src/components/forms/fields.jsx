import { HONEYPOT } from './useFormSubmit.js'

/** A labelled input. Pass `as="textarea"` or `as="select"` for other controls. */
export function Field({ label, as: Control = 'input', className = '', children, ...props }) {
  return (
    <label className="field-label">
      {label}
      <Control className={`field ${className}`} {...props}>
        {children}
      </Control>
    </label>
  )
}

export function Checkbox({ children, ...props }) {
  return (
    <label className="mt-3 grid cursor-pointer grid-cols-[auto_1fr] items-start gap-3 text-sm leading-[1.5] font-semibold">
      <input className="mt-0.5 size-4.5 accent-red" type="checkbox" {...props} />
      <span>{children}</span>
    </label>
  )
}

/** Hidden from people and screen readers; bots fill it in. */
export function Honeypot() {
  return (
    <div className="absolute -left-[9999px]" aria-hidden="true">
      <label>
        Leave this field empty
        <input type="text" name={HONEYPOT} tabIndex={-1} autoComplete="off" />
      </label>
    </div>
  )
}

export function SubmitButton({ status, label, className = '' }) {
  const sending = status.state === 'sending'
  return (
    <button className={`btn ${className}`} type="submit" disabled={sending}>
      {sending ? 'Sending…' : label}
    </button>
  )
}

export function FormStatus({ status }) {
  if (status.state !== 'sent' && status.state !== 'error') return null
  const tone = status.state === 'sent' ? 'bg-success-soft text-success-ink' : 'bg-danger-soft text-danger-ink'

  return (
    <output className={`mt-3.5 block rounded-lg px-4 py-3 text-sm leading-normal ${tone}`}>
      {status.message}
    </output>
  )
}
