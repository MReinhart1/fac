// Business details used across the site. Change them here, not in pages.

// The site's domain. On any other address (a preview or test copy) the site asks search engines not to index it.
export const LIVE_DOMAIN = 'mreinhart-fac-demo.com'

// Whether search engines may list the site. Off: this is a demo, and it should not show up in search results where
// people could mistake it for the real business. Every page then carries a "noindex" tag. Turn it on only for a real
// launch on the business's own domain.
export const allowSearchEngines = false

export const site = {
  name: 'Firearms Academy Canada',
  shortName: 'FAC',
  tagline: 'Toronto Firearms Courses',
  description: 'Certified Canadian Firearms Safety courses (CFSC and CRFSC) in Toronto and the GTA.',
}

export const phone = {
  display: '416-966-GUNS (4867)',
  href: 'tel:+14169664867',
  e164: '+14169664867',
}

export const location = {
  name: 'Legion Hall Branch 31',
  area: 'Weston Road',
  street: '1050 Weston Rd',
  city: 'York',
  region: 'ON',
  postalCode: 'M6N 3S2',
  country: 'CA',
  get address() {
    return `${this.street}, ${this.city}, ${this.region} ${this.postalCode}`
  },
  get mapEmbedUrl() {
    return `https://www.google.com/maps?q=${encodeURIComponent(this.address)}&output=embed`
  },
}

// The federal Canadian Firearms Program. We are not the CFP; we point people to it.
export const cfp = {
  url: 'http://www.rcmp-grc.gc.ca/cfp-pcaf/index-eng.htm',
  phoneDisplay: '1-800-731-4000',
  phoneHref: 'tel:+18007314000',
}

// Interac e-Transfer details shown to students after they register.
// TODO before launch: set the address that receives e-Transfers (ideally with Autodeposit turned on).
// While it is empty, students are told the address will be emailed to them.
export const etransfer = {
  email: '',
}

// Booking rules. payWithinHours and defaultCapacity are placeholders until the owner confirms them (see docs/ROADMAP.md).
export const booking = {
  // How soon students are asked to pay. Nothing happens automatically: the owner cancels unpaid registrations in the portal.
  payWithinHours: 48,
  // Seats per course weekend when a new weekend is added.
  defaultCapacity: 20,
}

// Privacy policy (/privacy). TODO before launch: the owner fills in the two missing answers.
// While either is empty, the page shows "to be confirmed" in its place and a draft notice at the top.
export const privacy = {
  // How long student records are kept after the course, as it should read in a sentence, e.g. '2 years'.
  keepRecordsFor: '',
  // Who answers privacy questions and requests: a name or role, and an email address.
  contactName: '',
  contactEmail: '',
  // Change this date whenever the policy changes.
  lastUpdated: '2026-11-20',
}

export const FSESO_URL = 'http://www.fseso.org/'

export const isExternal = (url) => /^https?:\/\//.test(url)
