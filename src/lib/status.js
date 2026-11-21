// Status names for registrations and course weekends, shared by the database code, pages and emails.
// No database imports here, so anything can use it.

export const REGISTRATION_STATUS = { pending: 'pending', paid: 'paid', cancelled: 'cancelled' }
export const SESSION_STATUS = { open: 'open', closed: 'closed', cancelled: 'cancelled' }

/** Unpaid and paid registrations take up a seat; cancelled ones do not. */
export const holdsSeat = (reg) => reg.status === REGISTRATION_STATUS.pending || reg.status === REGISTRATION_STATUS.paid

export const isUnpaid = (reg) => reg.status === REGISTRATION_STATUS.pending
