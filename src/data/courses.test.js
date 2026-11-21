import { describe, expect, it } from 'vitest'
import { DEFAULT_PACKAGE_ID, findPackage, GUIDE_PRICE, money, needsPal, packages } from './courses.js'

describe('packages', () => {
  it('adds the student guide to every course price', () => {
    for (const item of packages) expect(item.total).toBe(item.coursePrice + GUIDE_PRICE)
  })

  it('charges the published prices, taxes included', () => {
    expect(Object.fromEntries(packages.map((item) => [item.id, money(item.total)]))).toEqual({
      cfsc: '$258.30',
      package: '$450.40',
      crfsc: '$258.30',
      module: '$213.10',
    })
  })

  it('has a default package that exists', () => {
    expect(findPackage(DEFAULT_PACKAGE_ID)).toBeDefined()
  })

  it('returns nothing for an unknown package', () => {
    expect(findPackage('free-course')).toBeUndefined()
  })
})

describe('needsPal', () => {
  it('asks for PAL course details only on restricted-only packages', () => {
    expect(needsPal('crfsc')).toBe(true)
    expect(needsPal('module')).toBe(true)
    expect(needsPal('cfsc')).toBe(false)
    expect(needsPal('package')).toBe(false)
    expect(needsPal('nope')).toBe(false)
  })
})

describe('money', () => {
  it('formats cents as Canadian dollars', () => {
    expect(money(0)).toBe('$0.00')
    expect(money(2100)).toBe('$21.00')
    expect(money(123_456)).toBe('$1,234.56')
  })
})
