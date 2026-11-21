// Courses (what is taught) and packages (what people buy). Prices are in cents and include taxes.

export const GUIDE_PRICE = 2100

const moneyFormat = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' })
export const money = (cents) => moneyFormat.format(cents / 100)

export const courses = [
  {
    code: 'CFSC',
    title: 'Canadian Firearms Safety Course',
    packageId: 'cfsc',
    bullets: ['8–10 hours, excluding breaks and exams', 'Non-restricted firearms (long guns)', 'No prerequisites'],
    details: [
      { label: 'Format', text: 'Lecture and hands-on instruction' },
      { text: 'Learn to load, unload, and safely handle common action types for rifles and shotguns.' },
      { text: 'Completion of the CFSC and exam is required to possess or purchase a firearm for any purpose in Canada.' },
      { text: 'The course covers safe handling, transportation, display, and storage of non-restricted firearms.' },
    ],
  },
  {
    code: 'CRFSC',
    title: 'Canadian Restricted Firearms Safety Course',
    packageId: 'crfsc',
    bullets: ['6–8 hours, excluding breaks and exams', 'Restricted firearms (handguns)', 'CFSC completion required'],
    details: [
      { label: 'Prerequisite', text: 'Successful completion of the CFSC and exam' },
      { label: 'Format', text: 'Lecture and hands-on instruction' },
      { text: 'Learn to load, unload, and safely handle common handgun action types.' },
      { text: 'Completion of the CRFSC and exam is required to possess or purchase a restricted firearm.' },
      { label: 'Age note', text: 'You must be 18 years old to take the CRFSC exam. Minors may take the course for educational purposes.' },
    ],
  },
]

const packageList = [
  {
    id: 'cfsc',
    title: 'CFSC course package',
    covers: 'Long guns',
    coursePrice: 23730,
    exams: 1,
  },
  {
    id: 'package',
    title: 'CFSC & CRFSC complete course package',
    covers: 'Long guns & handguns',
    coursePrice: 42940,
    exams: 2,
  },
  {
    id: 'crfsc',
    title: 'CRFSC',
    covers: 'Restricted only',
    coursePrice: 23730,
    exams: 1,
    note: 'You must have a valid PAL in order to take this course.',
    needsPal: true,
  },
  {
    id: 'module',
    title: 'CRFSC module',
    covers: 'Restricted only',
    coursePrice: 19210,
    exams: 1,
    note: 'Only if you completed the CFSC course and exam within the past 30 days.',
    needsPal: true,
  },
]

export const packages = packageList.map((item) => ({ ...item, total: item.coursePrice + GUIDE_PRICE }))

export const DEFAULT_PACKAGE_ID = 'package'

export const findPackage = (id) => packages.find((item) => item.id === id)

// Restricted-only bookings must tell us when, and with whom, the student took the non-restricted (PAL) course.
export const needsPal = (id) => Boolean(findPackage(id)?.needsPal)
