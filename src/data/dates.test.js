import { describe, expect, it } from 'vitest'
import { addDaysTo, isSaturday, isValidDate, todayInToronto, weekendParts } from './dates.js'

describe('todayInToronto', () => {
  it('uses Toronto time, not UTC, near midnight', () => {
    // 3 a.m. UTC on the 21st is still 10 p.m. on the 20th in Toronto.
    expect(todayInToronto(new Date('2026-11-21T03:00:00Z'))).toBe('2026-11-20')
    expect(todayInToronto(new Date('2026-11-21T05:30:00Z'))).toBe('2026-11-21')
  })

  it('follows daylight saving time', () => {
    // In July Toronto is UTC−4, so 3:30 a.m. UTC is 11:30 p.m. the day before.
    expect(todayInToronto(new Date('2027-07-15T03:30:00Z'))).toBe('2027-07-14')
  })
})

describe('isValidDate', () => {
  it.each(['2027-01-16', '2028-02-29'])('accepts %s', (date) => expect(isValidDate(date)).toBe(true))
  it.each(['', null, undefined, '2027-1-16', '16/01/2027', '2027-13-01', '2027-01-16T00:00', '2027-02-29', '2027-02-30', '2027-04-31'])('rejects %s', (date) => {
    expect(isValidDate(date)).toBe(false)
  })
})

describe('weekendParts', () => {
  it('labels a weekend inside one month', () => {
    expect(weekendParts('2027-01-16')).toEqual({ label: 'January 16/17, 2027', month: 'Jan', days: '16–17', year: 2027 })
  })

  it('labels a weekend that crosses into the next month', () => {
    expect(weekendParts('2027-07-31')).toEqual({ label: 'July 31 / August 1, 2027', month: 'Jul/Aug', days: '31–1', year: 2027 })
  })

  it("uses Sunday's year for a weekend over New Year", () => {
    expect(weekendParts('2022-12-31').label).toBe('December 31 / January 1, 2023')
  })
})

describe('isSaturday', () => {
  it('knows Saturdays from other days', () => {
    expect(isSaturday('2027-01-16')).toBe(true)
    expect(isSaturday('2027-01-15')).toBe(false)
    expect(isSaturday('2027-01-17')).toBe(false)
  })
})

describe('addDaysTo', () => {
  it('adds and subtracts days across month and year ends', () => {
    expect(addDaysTo('2027-01-30', 3)).toBe('2027-02-02')
    expect(addDaysTo('2026-12-30', 3)).toBe('2027-01-02')
    expect(addDaysTo('2027-03-01', -1)).toBe('2027-02-28')
    expect(addDaysTo('2028-02-28', 1)).toBe('2028-02-29')
  })

  it('is not thrown off by the daylight saving change', () => {
    expect(addDaysTo('2027-03-13', 1)).toBe('2027-03-14')
    expect(addDaysTo('2027-11-06', 1)).toBe('2027-11-07')
  })
})
