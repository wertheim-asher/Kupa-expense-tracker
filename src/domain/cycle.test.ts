import { describe, expect, it } from 'vitest'
import { addDays, cycleFor, daysLeft, diffDays, isInCycle, isValidIsoDate, shiftCycle, todayInIsrael } from './cycle.ts'

describe('cycleFor and daysLeft (SPEC section 5 table)', () => {
  const cases: Array<[number, string, string, string, number]> = [
    // D, today, start, last day, daysLeft
    [10, '2026-09-05', '2026-08-10', '2026-09-09', 5],
    [10, '2026-09-09', '2026-08-10', '2026-09-09', 1],
    [10, '2026-09-10', '2026-09-10', '2026-10-09', 30],
    [1, '2026-02-15', '2026-02-01', '2026-02-28', 14],
    [28, '2026-03-01', '2026-02-28', '2026-03-27', 27],
    [15, '2026-01-03', '2025-12-15', '2026-01-14', 12],
    [10, '2026-12-20', '2026-12-10', '2027-01-09', 21],
  ]

  it.each(cases)('D=%i today=%s → start %s, last day %s, %i days left', (d, today, start, lastDay, left) => {
    const cycle = cycleFor(today, d)
    expect(cycle.start).toBe(start)
    expect(cycle.lastDay).toBe(lastDay)
    expect(cycle.endExclusive).toBe(addDays(lastDay, 1))
    expect(daysLeft(today, cycle)).toBe(left)
  })
})

describe('todayInIsrael', () => {
  it('uses the Israel date, not UTC (UTC+3 in September)', () => {
    expect(todayInIsrael(new Date('2026-09-09T22:30:00Z'))).toBe('2026-09-10')
  })

  it('handles winter time (UTC+2)', () => {
    expect(todayInIsrael(new Date('2026-12-31T21:59:00Z'))).toBe('2026-12-31')
    expect(todayInIsrael(new Date('2026-12-31T22:00:00Z'))).toBe('2027-01-01')
  })

  it('returns YYYY-MM-DD', () => {
    expect(todayInIsrael(new Date('2026-03-05T10:00:00Z'))).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('isInCycle', () => {
  it('an expense on 2026-09-09 with D=10 belongs to the cycle starting 2026-08-10', () => {
    expect(cycleFor('2026-09-09', 10).start).toBe('2026-08-10')
    expect(isInCycle('2026-09-09', cycleFor('2026-08-20', 10))).toBe(true)
    expect(isInCycle('2026-09-09', cycleFor('2026-09-10', 10))).toBe(false)
  })

  it('start is inclusive and endExclusive is exclusive', () => {
    const cycle = cycleFor('2026-09-15', 10)
    expect(isInCycle('2026-09-10', cycle)).toBe(true)
    expect(isInCycle('2026-10-09', cycle)).toBe(true)
    expect(isInCycle('2026-10-10', cycle)).toBe(false)
    expect(isInCycle('2026-09-09', cycle)).toBe(false)
  })
})

describe('shiftCycle', () => {
  it('-1 from the 2026-09-10 cycle (D=10) gives 2026-08-10 to 2026-09-09', () => {
    const prev = shiftCycle(cycleFor('2026-09-10', 10), 10, -1)
    expect(prev).toEqual({ start: '2026-08-10', endExclusive: '2026-09-10', lastDay: '2026-09-09' })
  })

  it('crosses year boundaries both ways', () => {
    const jan = cycleFor('2026-01-20', 15)
    expect(shiftCycle(jan, 15, -1).start).toBe('2025-12-15')
    expect(shiftCycle(jan, 15, 12).start).toBe('2027-01-15')
    expect(shiftCycle(cycleFor('2026-12-20', 10), 10, 1).start).toBe('2027-01-10')
  })

  it('offset 0 returns the same cycle', () => {
    const c = cycleFor('2026-02-28', 28)
    expect(shiftCycle(c, 28, 0)).toEqual(c)
  })
})

describe('start day validation', () => {
  it.each([0, 29, 31, -1, 10.5, Number.NaN])('rejects start day %s', (d) => {
    expect(() => cycleFor('2026-09-10', d)).toThrow(RangeError)
    expect(() => shiftCycle(cycleFor('2026-09-10', 10), d, -1)).toThrow(RangeError)
  })

  it('accepts 1 and 28', () => {
    expect(() => cycleFor('2026-02-28', 1)).not.toThrow()
    expect(() => cycleFor('2026-02-28', 28)).not.toThrow()
  })
})

describe('first and last day of a cycle', () => {
  it('last day has 1 day left, first day has the full length', () => {
    const cycle = cycleFor('2026-10-09', 10)
    expect(daysLeft('2026-10-09', cycle)).toBe(1)
    expect(daysLeft('2026-09-10', cycle)).toBe(30)
  })

  it('February cycles are shorter', () => {
    const cycle = cycleFor('2026-02-10', 10)
    expect(cycle.lastDay).toBe('2026-03-09')
    expect(daysLeft('2026-02-10', cycle)).toBe(28)
  })

  it('leap year February', () => {
    expect(cycleFor('2028-02-29', 1).lastDay).toBe('2028-02-29')
  })
})

describe('date helpers', () => {
  it('addDays and diffDays round-trip', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(diffDays('2026-09-10', '2026-10-09')).toBe(29)
  })

  it('validates ISO dates', () => {
    expect(isValidIsoDate('2026-02-29')).toBe(false)
    expect(isValidIsoDate('2028-02-29')).toBe(true)
    expect(isValidIsoDate('2026-9-1')).toBe(false)
    expect(() => cycleFor('2026-13-01', 10)).toThrow(RangeError)
  })
})
