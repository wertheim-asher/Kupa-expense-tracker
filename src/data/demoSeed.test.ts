import { describe, expect, it } from 'vitest'
import { addDays, cycleFor, isInCycle, shiftCycle } from '../domain/cycle.ts'
import { buildDemoSeed, CATEGORY_RANGES, currentTargetAgorot, DEMO, israelTimeToIso, mulberry32 } from './demoSeed.ts'

const NOW = (today: string) => new Date(israelTimeToIso(today, 12, 0))

function split(today: string) {
  const seed = buildDemoSeed(today, NOW(today))
  const current = cycleFor(today, DEMO.cycleStartDay)
  const previous = shiftCycle(current, DEMO.cycleStartDay, -1)
  const cur = seed.expenses.filter((e) => isInCycle(e.spentOn, current))
  const prev = seed.expenses.filter((e) => isInCycle(e.spentOn, previous))
  const sum = (list: typeof cur) => list.reduce((s, e) => s + e.amountAgorot, 0)
  return { seed, current, previous, cur, prev, curTotal: sum(cur), prevTotal: sum(prev) }
}

describe('mulberry32', () => {
  it('is deterministic', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })
})

describe('buildDemoSeed', () => {
  it('is deterministic for the same day', () => {
    expect(buildDemoSeed('2026-10-04', NOW('2026-10-04'))).toEqual(buildDemoSeed('2026-10-04', NOW('2026-10-04')))
  })

  it('sets up Noa (current user, teal) and Dan (violet), ₪9,000, cycle day 10', () => {
    const { seed } = split('2026-10-04')
    expect(seed.household?.budgetAgorot).toBe(900_000)
    expect(seed.household?.cycleStartDay).toBe(10)
    expect(seed.members.map((m) => [m.displayName, m.color])).toEqual([
      ['נועה', 'teal'],
      ['דן', 'violet'],
    ])
    expect(seed.session?.memberId).toBe(DEMO.noaId)
  })

  it('on presentation day has about 28 current expenses about 8% ahead of pace', () => {
    const { cur, curTotal, current } = split('2026-10-04')
    expect(cur.length).toBeGreaterThanOrEqual(24)
    expect(cur.length).toBeLessThanOrEqual(34)
    // 25 of 30 days elapsed: 9000 x 25/30 x 1.08 = 8100
    expect(currentTargetAgorot('2026-10-04', current)).toBe(810_000)
    expect(curTotal).toBe(810_000)
  })

  const days = ['2026-09-10', '2026-09-11', '2026-09-25', '2026-10-02', '2026-10-04', '2026-10-08', '2026-10-09', '2027-01-03', '2027-02-20', '2028-03-01']

  it.each(days)('%s: totals in range, dates inside their cycles', (today) => {
    const { seed, current, previous, cur, prev, curTotal, prevTotal } = split(today)
    const target = currentTargetAgorot(today, current)

    // Every expense belongs to the current or the previous cycle, never in the future.
    expect(cur.length + prev.length).toBe(seed.expenses.length)
    for (const e of seed.expenses) expect(e.spentOn <= today).toBe(true)

    // Current cycle: exactly on target (whole shekels), never over budget.
    expect(Math.abs(curTotal - target)).toBeLessThanOrEqual(100)
    expect(curTotal).toBeLessThan(DEMO.budgetAgorot)

    // Previous cycle: about 30 expenses, slightly under budget.
    expect(prev.length).toBe(30)
    expect(prevTotal).toBeLessThan(DEMO.budgetAgorot)
    expect(prevTotal).toBeGreaterThan(DEMO.budgetAgorot * 0.9)
    for (const e of prev) expect(isInCycle(e.spentOn, previous)).toBe(true)

    if (today === current.start) {
      expect(cur.length).toBeGreaterThanOrEqual(1)
      expect(cur.length).toBeLessThanOrEqual(2)
      for (const e of cur) expect(e.spentOn).toBe(today)
    } else {
      for (const e of cur) expect(e.spentOn <= addDays(today, -1)).toBe(true)
    }
  })

  it.each(days)('%s: valid amounts, durations, payers and times', (today) => {
    const { seed, cur } = split(today)
    const now = NOW(today).toISOString()
    for (const e of seed.expenses) {
      expect(Number.isInteger(e.amountAgorot)).toBe(true)
      expect(e.amountAgorot).toBeGreaterThanOrEqual(CATEGORY_RANGES[e.category].min)
      expect(e.amountAgorot).toBeLessThanOrEqual(CATEGORY_RANGES[e.category].max)
      expect(e.logDurationMs).toBeGreaterThanOrEqual(2500)
      expect(e.logDurationMs).toBeLessThanOrEqual(9000)
      expect(e.createdAt < now).toBe(true)
      expect([DEMO.noaId, DEMO.danId]).toContain(e.memberId)
    }
    if (cur.length >= 10) {
      const counts = new Map<string, number>()
      for (const e of cur) counts.set(e.category, (counts.get(e.category) ?? 0) + 1)
      const groceries = counts.get('groceries') ?? 0
      for (const [category, n] of counts) if (category !== 'groceries') expect(groceries).toBeGreaterThanOrEqual(n)
      const noa = cur.filter((e) => e.memberId === DEMO.noaId).length / cur.length
      expect(noa).toBeGreaterThan(0.45)
      expect(noa).toBeLessThan(0.65)
    }
  })

  it('ids are unique', () => {
    const { seed } = split('2026-10-04')
    expect(new Set(seed.expenses.map((e) => e.id)).size).toBe(seed.expenses.length)
  })
})

describe('israelTimeToIso', () => {
  it('uses UTC+3 in summer and UTC+2 in winter', () => {
    expect(israelTimeToIso('2026-09-10', 9, 30)).toBe('2026-09-10T06:30:00.000Z')
    expect(israelTimeToIso('2026-12-10', 9, 30)).toBe('2026-12-10T07:30:00.000Z')
  })
})
