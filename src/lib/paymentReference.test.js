import { afterEach, describe, expect, it, vi } from 'vitest'
import { makePaymentReference } from './paymentReference.js'

// Letters and digits that are easy to read back: no 0/O or 1/I.
const SHAPE = /^FAC-\d{4}-[A-Z]{1,7}-[A-HJ-NP-Z2-9]{3}$/

describe('makePaymentReference', () => {
  afterEach(() => vi.restoreAllMocks())

  it('combines the course date, family name and a random code', () => {
    const reference = makePaymentReference('Smith', '2027-01-16')
    expect(reference).toMatch(/^FAC-0116-SMITH-[A-HJ-NP-Z2-9]{3}$/)
  })

  it('keeps only the first six letters of the family name', () => {
    expect(makePaymentReference('Montgomery', '2027-01-16')).toMatch(/^FAC-0116-MONTGO-/)
  })

  it('drops accents, spaces and punctuation from the name', () => {
    expect(makePaymentReference('Bélanger-Côté', '2027-01-16')).toMatch(/^FAC-0116-BELANG-/)
    expect(makePaymentReference("O'Neil", '2027-01-16')).toMatch(/^FAC-0116-ONEIL-/)
  })

  it('falls back when the name has no usable letters or the date is missing', () => {
    expect(makePaymentReference('李', '2027-01-16')).toMatch(/^FAC-0116-STUDENT-/)
    expect(makePaymentReference('', '')).toMatch(/^FAC-0000-STUDENT-/)
    expect(makePaymentReference('Smith', 'next week')).toMatch(/^FAC-0000-SMITH-/)
  })

  it('never uses easily confused characters', () => {
    for (let i = 0; i < 500; i += 1) expect(makePaymentReference('Smith', '2027-01-16')).toMatch(SHAPE)
  })

  it('takes its random code from the secure random generator', () => {
    vi.spyOn(crypto, 'getRandomValues').mockImplementation((bytes) => bytes.fill(0))
    expect(makePaymentReference('Smith', '2027-01-16')).toBe('FAC-0116-SMITH-AAA')
  })
})
