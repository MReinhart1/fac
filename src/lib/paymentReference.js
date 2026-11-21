// Payment reference (generated on the server when a registration is saved) for matching an e-Transfer to a registration, e.g. "FAC-0116-SMITH-K7Q".
// Course date (MMDD) + up to 6 letters of the family name + 3 random characters to avoid collisions.
// Ambiguous characters (0/O, 1/I) are left out so it is easy to read back and type.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function makePaymentReference(familyName = '', courseStart = '') {
  const name =
    familyName
      .normalize('NFD')
      .replace(/[^A-Za-z]/g, '')
      .toUpperCase()
      .slice(0, 6) || 'STUDENT'
  const mmdd = /^\d{4}-\d{2}-\d{2}$/.test(courseStart) ? courseStart.slice(5).replace('-', '') : '0000'
  const random = Array.from(crypto.getRandomValues(new Uint8Array(3)), (byte) => ALPHABET[byte % ALPHABET.length]).join('')
  return `FAC-${mmdd}-${name}-${random}`
}
