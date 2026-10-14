import { describe, expect, it } from 'vitest'
import { LIMITS } from '../config.ts'
import { CATEGORY_IDS } from '../domain/categories.ts'
import { addDays, cycleFor, isInCycle, shiftCycle } from '../domain/cycle.ts'
import {
  buildDemoSeed,
  CATEGORY_RANGES,
  currentTargetAgorot,
  DEMO,
  HISTORY,
  israelTimeToIso,
  mulberry32,
  PARTNER_EXPENSES,
} from './demoSeed.ts'

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

  it('names Noa and Dan in the language it is built in', () => {
    const seed = buildDemoSeed('2026-10-18', NOW('2026-10-18'), 'en')
    expect(seed.members.map((m) => m.displayName)).toEqual(['Noa', 'Dan'])
    expect(seed.seededLang).toBe('en')
    expect(buildDemoSeed('2026-10-18', NOW('2026-10-18'), 'he').seededLang).toBe('he')
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

    // Every expense belongs to the current cycle or one of the earlier ones, never in the future,
    // and never older than an expense date may be.
    const earlier = HISTORY.map((_, i) => shiftCycle(current, DEMO.cycleStartDay, -(i + 1)))
    const inEarlier = earlier.map((c) => seed.expenses.filter((e) => isInCycle(e.spentOn, c)))
    expect(cur.length + inEarlier.reduce((n, list) => n + list.length, 0)).toBe(seed.expenses.length)
    for (const e of seed.expenses) expect(e.spentOn <= today).toBe(true)
    for (const e of seed.expenses) expect(e.spentOn >= addDays(today, -LIMITS.maxPastDays)).toBe(true)

    // Earlier cycles: the planned count and share of the budget each, no amount at its category's
    // limit and no repeated amount in a category.
    HISTORY.forEach(({ share, count }, i) => {
      expect(inEarlier[i].length).toBe(count)
      const total = inEarlier[i].reduce((s, e) => s + e.amountAgorot, 0)
      expect(Math.abs(total - DEMO.budgetAgorot * share)).toBeLessThanOrEqual(100)
      for (const e of inEarlier[i]) expect(e.amountAgorot).toBeLessThan(CATEGORY_RANGES[e.category].max)
      for (const e of inEarlier[i]) expect(e.amountAgorot).toBeGreaterThan(CATEGORY_RANGES[e.category].min)
      expect(new Set(inEarlier[i].map((e) => `${e.category}:${e.amountAgorot}`)).size).toBe(count)
    })

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

  it('on the presentation day shows Oct 10 - Nov 9, with history back to Jan 10 - Feb 9', () => {
    const { seed, current } = split('2026-10-18')
    expect(current.start).toBe('2026-10-10')
    expect(current.lastDay).toBe('2026-11-09')
    const oldest = seed.expenses.map((e) => e.spentOn).sort()[0]
    expect(oldest >= '2026-01-10' && oldest <= '2026-02-09').toBe(true)
    expect(seed.household?.createdAt.slice(0, 10)).toBe('2026-01-10')
    expect(seed.seededOn).toBe('2026-10-18')
  })

  it('keeps the current cycle on target and the previous one at 97% of the budget', () => {
    const { cur, curTotal, prevTotal } = split('2026-10-04')
    expect(curTotal).toBe(810_000)
    expect(prevTotal).toBe(873_000)
    expect(cur.every((e) => e.id.startsWith('demo-cur-'))).toBe(true)
  })
})

describe('partner expenses (simulate)', () => {
  it('has 20, each different, starting with the SPEC ₪84 groceries', () => {
    expect(PARTNER_EXPENSES).toHaveLength(20)
    expect(PARTNER_EXPENSES[0]).toEqual({ category: 'groceries', agorot: 8400 })
    expect(new Set(PARTNER_EXPENSES.map((p) => `${p.category}:${p.agorot}`)).size).toBe(20)
  })

  it('never repeats a category twice in a row (also across the wrap) and uses every category', () => {
    PARTNER_EXPENSES.forEach((p, i) => {
      expect(p.category).not.toBe(PARTNER_EXPENSES[(i + 1) % PARTNER_EXPENSES.length].category)
      expect(Number.isInteger(p.agorot) && p.agorot > 0 && p.agorot <= LIMITS.maxAmountAgorot).toBe(true)
    })
    expect(new Set(PARTNER_EXPENSES.map((p) => p.category))).toEqual(new Set(CATEGORY_IDS))
  })
})

describe('israelTimeToIso', () => {
  it('uses UTC+3 in summer and UTC+2 in winter', () => {
    expect(israelTimeToIso('2026-09-10', 9, 30)).toBe('2026-09-10T06:30:00.000Z')
    expect(israelTimeToIso('2026-12-10', 9, 30)).toBe('2026-12-10T07:30:00.000Z')
  })
})
