// POST /api/register — saves a registration, holds a seat, and returns the payment details.
import { z } from 'astro/zod'
import { needsPal } from '../../data/courses.js'
import { isValidDate, todayInToronto } from '../../data/dates.js'
import { store } from '../../lib/db.js'
import { refreshDatePages } from '../../lib/public-sessions.js'
import { notifyRegistration, safely } from '../../lib/email/notify.js'
import { errorResponse, firstIssue, json } from '../../lib/http.js'

export const prerender = false

const text = (max, label) => z.string({ error: `${label} is required.` }).trim().max(max, `${label} is too long.`)
const required = (max, label) => text(max, label).min(1, `${label} is required.`)
const optional = (max, label) => text(max, label).optional().default('')

const Registration = z
  .object({
    firstName: required(80, 'First name'),
    familyName: required(80, 'Family name'),
    nickname: optional(80, 'Nickname'),
    friendName: optional(120, 'Friend name'),
    phone: required(40, 'Phone'),
    phoneExt: optional(10, 'Extension'),
    eveningPhone: optional(40, 'Evening phone'),
    eveningPhoneExt: optional(10, 'Extension'),
    email: z.string().trim().toLowerCase().email('Please enter a valid email address.').max(200),
    confirmEmail: z.string().trim().toLowerCase(),
    comments: optional(2000, 'Comments'),
    courseId: z.string().min(1, 'Please choose a course package.'),
    courseSessionId: z.string().min(1, 'Please choose a course date.'),
    hasGuide: z.boolean().optional().default(false),
    waitlist: z.string().optional(),
    palCourseDate: optional(10, 'PAL course date'),
    palInstructor: optional(120, 'Instructor name'),
    agree: z.string({ error: 'Please agree to the policy.' }).min(1, 'Please agree to the policy.'),
  })
  .refine((data) => data.email === data.confirmEmail, { message: 'The email addresses do not match.' })
  .refine((data) => !needsPal(data.courseId) || (isValidDate(data.palCourseDate) && data.palCourseDate <= todayInToronto() && data.palInstructor), {
    message: 'Please enter the date you completed the PAL course and your instructor’s name.',
  })

export async function POST({ request, cache }) {
  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid request.' }, 400)
  }
  // Spam trap: bots fill every field. Pretend it worked.
  if (body?._gotcha) return json({ ok: true }, 200)

  const parsed = Registration.safeParse(body)
  if (!parsed.success) return json({ error: firstIssue(parsed) }, 400)
  const data = parsed.data

  try {
    const registration = await store().createRegistration({
      packageId: data.courseId,
      courseSessionId: data.courseSessionId,
      hasGuide: data.hasGuide,
      waitlistEarlier: Boolean(data.waitlist),
      friendName: data.friendName,
      comments: data.comments,
      pal: needsPal(data.courseId) ? { courseDate: data.palCourseDate, instructor: data.palInstructor } : null,
      student: {
        firstName: data.firstName,
        familyName: data.familyName,
        nickname: data.nickname,
        email: data.email,
        phone: data.phone,
        phoneExt: data.phoneExt,
        eveningPhone: data.eveningPhone,
        eveningPhoneExt: data.eveningPhoneExt,
      },
    })
    await refreshDatePages(cache)
    await safely(notifyRegistration(registration.id))
    return json(registration, 201)
  } catch (error) {
    return errorResponse(error)
  }
}
