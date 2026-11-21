import { Field, FormStatus, Honeypot, SubmitButton } from './fields.jsx'
import useFormSubmit from './useFormSubmit.js'

export default function ContactForm() {
  const [status, submit] = useFormSubmit('/api/contact')

  return (
    <form aria-label="Contact form" className="card relative grid gap-4 p-6 nav:p-8" onSubmit={submit}>
      <h2 className="font-display text-xl font-bold">Send us a message</h2>
      <Field label="Name" name="realname" type="text" required autoComplete="name" />
      <Field label="Email" name="email" type="email" required autoComplete="email" />
      <Field label="Comments" as="textarea" name="comments" rows={6} required />
      <Honeypot />
      <SubmitButton status={status} label="Send message" />
      <FormStatus status={status} />
    </form>
  )
}
