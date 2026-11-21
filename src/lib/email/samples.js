// Sample data for previewing every email template in the staff portal (/admin/emails).
import { ObjectId } from 'mongodb'
import { findPackage } from '../../data/courses.js'
import { addDaysTo, isSaturday, todayInToronto, weekendParts } from '../../data/dates.js'
import * as t from './templates.js'

function sample(packageId = 'package') {
  const pkg = findPackage(packageId)
  // The first Saturday at least 30 days out.
  let startDate = addDaysTo(todayInToronto(), 30)
  while (!isSaturday(startDate)) startDate = addDaysTo(startDate, 1)
  return {
    _id: new ObjectId('000000000000000000000001'),
    reference: 'FAC-0116-SAMPLE-K7Q',
    startDate,
    packageId,
    packageTitle: pkg.title,
    amountDueCents: pkg.total,
    hasGuide: false,
    status: 'pending',
    student: { firstName: 'Jordan', familyName: 'Sample', nickname: '', email: 'jordan@example.com', phone: '416-555-0100', phoneExt: '' },
    friendName: 'Alex Sample',
    comments: 'First time taking the course.',
    pal: null,
  }
}

export const previews = (siteUrl) => {
  const reg = sample()
  const weekend = { id: 'sample', label: weekendParts(reg.startDate).label }
  return {
    'registration-received': { label: 'Registration received (student)', email: t.registrationReceived(reg) },
    'payment-confirmed': { label: 'Course confirmation after payment (student)', email: t.paymentConfirmed({ ...reg, status: 'paid' }, { siteUrl }) },
    'class-reminder': { label: 'Class reminder, 3 days before (student)', email: t.classReminder({ ...reg, status: 'paid' }) },
    'registration-moved': { label: 'Moved to another weekend (student)', email: t.registrationMoved(reg, { fromStartDate: addDaysTo(reg.startDate, -28) }) },
    'registration-cancelled': { label: 'Cancelled (student)', email: t.registrationCancelled(reg, { refundCents: 35040 }) },
    'registration-removed-unpaid': { label: 'Removed for not paying (student)', email: t.registrationCancelled({ ...reg, cancelReason: t.UNPAID_REASON }, {}) },
    'owner-new-registration': { label: 'New registration (owner)', email: t.ownerNewRegistration(reg, { siteUrl }) },
    'owner-new-message': { label: 'New contact message (owner)', email: t.ownerNewMessage({ name: 'Jordan Sample', email: 'jordan@example.com', comments: 'Do you have space in March?' }, { siteUrl }) },
    'instructor-roster': { label: 'Class list, 2 days before (instructors)', email: t.instructorRoster(weekend, [reg, { ...sample('cfsc'), student: { ...reg.student, firstName: 'Sam', familyName: 'Example' }, status: 'paid', hasGuide: true, friendName: '' }], { siteUrl }) },
  }
}
