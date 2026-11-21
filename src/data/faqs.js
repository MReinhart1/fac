import { FSESO_URL } from './site.js'

export const faqs = [
  {
    question: 'What is the CFSC?',
    answer: 'The mandatory Canadian Firearms Safety Course (CFSC) provides basic training to those who wish to obtain a firearms licence in order to possess non-restricted firearms.'
  },
  {
    question: 'What is the CRFSC?',
    answer: 'The Canadian Restricted Firearms Safety Course (CRFSC) provides basic training to those who wish to possess restricted firearms. The CFSC is a prerequisite for taking the CRFSC.'
  },
  {
    question: 'How do I pay?',
    answer: 'By Interac e-Transfer. After you submit the registration form, you will see the amount to send, where to send it and a payment reference to put in the e-Transfer message. Your space is reserved once your payment is received, and we email your confirmation within about one business day.',
    link: '/register',
    linkText: 'Register for a course'
  },
  {
    question: 'Can I download the manuals?',
    answer: 'Yes, manuals are available for download from the Government of Canada publications archive. You must use a print version during the course because electronic devices are not allowed in the classroom.',
    link: 'https://publications.gc.ca/site/archivee-archived.html?url=https://publications.gc.ca/collections/collection_2015/grc-rcmp/PS99-2-2-1-2014-eng.pdf',
    linkText: 'Download manual information'
  },
  {
    question: 'Can I just order the Student manual?',
    answer: 'No. You can pick up a manual at our Legion Hall location on a teaching date, but please contact us ahead of time to ensure supplies are available.',
    link: '/contact',
    linkText: 'Contact us'
  },
  {
    question: 'Do I need any prior firearms experience?',
    answer: 'No. We accept students with all levels of experience.'
  },
  {
    question: 'I am under 18 years old. Can I take the CFSC and Exam?',
    answer: "Yes. We require a consent form signed by a parent or legal guardian. Although you must be at least 18 years old to possess a firearm, younger students may apply for a Minor's Permit to use a firearm while under supervision. Completion of the CFSC is required to apply for the Minor's Permit. Students under 18 are not eligible to take the CRFSC exam, but may take the course for educational purposes.",
    link: '/consent',
    linkText: 'Open the consent form'
  },
  {
    question: 'I am not a Canadian citizen or resident. Can I take the CFSC and Exam?',
    answer: 'Yes. There are no restrictions on who can take the course.'
  },
  {
    question: 'What is the FSESO?',
    answer: 'The Firearm Safety Education Service of Ontario (FSESO) is an association of instructors in Ontario who are designated by the Chief Provincial Firearms Office to teach the CFSC and CRFSC.',
    link: '/certified',
    linkText: 'About FSESO certification'
  },
  {
    question: 'What is the difference between the Hunter Safety Course and the CFSC?',
    answer: 'Hunting is administered by the provinces and territories, each of which has its own hunter education or safety course. If you want to go hunting with a firearm, prior completion of the CFSC is required.',
    link: '/hunter-education',
    linkText: 'Ontario Hunter Education Program'
  },
  {
    question: 'Can I take the test without taking the course?',
    answer: 'No. The CFSC and CRFSC are mandatory for the possession of firearms in Canada.'
  },
  {
    question: 'What can I expect from the exam?',
    answer: 'The exams have written and practical sections. The written exam consists of 50 true or false and multiple-choice questions. For the practical section, you will demonstrate and apply the material learned in the course. You must achieve at least 80% in both sections.'
  },
  {
    question: 'What if I fail the exam?',
    answer: 'You do not need to retake the course, but you must retake the full exam, including both the written and practical sections.'
  },
  {
    question: 'Are your courses wheelchair accessible?',
    answer: 'Unfortunately, our Legion Hall location is not wheelchair accessible. Contact us if special access arrangements may be required.',
    link: '/contact',
    linkText: 'Contact us'
  },
  {
    question: 'In what languages is the CFSC available?',
    answer: 'We offer the course in English and it is also available in French. Strong written and verbal comprehension of the language used is encouraged.'
  },
  {
    question: 'Can I take the CFSC course elsewhere?',
    answer: 'Yes. You can find other instructors through the Firearm Safety Education Service of Ontario.',
    link: FSESO_URL,
    linkText: 'Visit the FSESO website'
  },
]
