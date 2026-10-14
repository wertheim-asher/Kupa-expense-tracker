// Demo data (SPEC section 12), generated relative to today and deterministic:
// the same `today` always gives the same household, expenses and totals.
// The demo starts again from a new seed each day (LocalStoreRepo), so it always shows today's cycle,
// and after a language switch, so the names match the language.

import { TIME_ZONE } from '../config.ts'
import { LANG, type Lang } from '../i18n/lang.ts'
import type { CategoryId } from '../domain/categories.ts'
import { addDays, cycleFor, diffDays, shiftCycle, type Cycle } from '../domain/cycle.ts'
import type { Expense, Household, IsoDate, Member } from '../domain/types.ts'
import type { StoreData } from './store.ts'

export const DEMO = {
  budgetAgorot: 900_000,
  cycleStartDay: 10,
  householdId: 'demo-household',
  noaId: 'demo-member-noa',
  danId: 'demo-member-dan',
  inviteCode: 'NOA7DX',
  /** Current cycle spending runs this far ahead of an even pace. */
  aheadOfPace: 1.08,
  /** Never seed the current cycle over this share of the budget. */
  maxCurrentShare: 0.97,
  /** The previous cycle ends slightly under budget. */
  previousShare: 0.97,
  previousCount: 30,
} as const

/**
 * Earlier cycles with expenses, most recent first: share of the budget spent, how many expenses,
 * and the generator seed (picked so no amount sits at its category's limit and none repeats,
 * which would look made up). The first is the previous cycle (SPEC: about 30, slightly under
 * budget). On the presentation day (2026-10-18) they reach back to Jan 10 - Feb 9.
 * Some end over budget (summer, Passover), as real months do.
 */
export const HISTORY: ReadonlyArray<{ share: number; count: number; seed: number }> = [
  { share: DEMO.previousShare, count: DEMO.previousCount, seed: 19 },
  { share: 1.05, count: 34, seed: 1 },
  { share: 0.98, count: 31, seed: 33 },
  { share: 0.92, count: 29, seed: 3 },
  { share: 0.94, count: 30, seed: 18 },
  { share: 0.9, count: 28, seed: 16 },
  { share: 1.03, count: 33, seed: 7 },
  { share: 0.95, count: 30, seed: 5 },
  { share: 0.99, count: 32, seed: 9 },
]

/**
 * "Simulate partner expense" (demo): each tap adds the next one, by the partner, dated today.
 * The first is the SPEC's ₪84 groceries; after the last it starts over.
 */
export const PARTNER_EXPENSES: ReadonlyArray<{ category: CategoryId; agorot: number }> = [
  { category: 'groceries', agorot: 8_400 },
  { category: 'eating_out', agorot: 12_600 },
  { category: 'transport', agorot: 4_800 },
  { category: 'kids', agorot: 4_500 },
  { category: 'home', agorot: 18_900 },
  { category: 'health', agorot: 6_200 },
  { category: 'fun', agorot: 9_800 },
  { category: 'groceries', agorot: 23_700 },
  { category: 'other', agorot: 3_500 },
  { category: 'eating_out', agorot: 5_800 },
  { category: 'transport', agorot: 28_000 },
  { category: 'kids', agorot: 14_000 },
  { category: 'groceries', agorot: 11_200 },
  { category: 'fun', agorot: 17_500 },
  { category: 'home', agorot: 7_400 },
  { category: 'health', agorot: 3_900 },
  { category: 'eating_out', agorot: 21_400 },
  { category: 'groceries', agorot: 36_800 },
  { category: 'other', agorot: 9_000 },
  { category: 'transport', agorot: 3_300 },
]

/** Ids of simulated partner expenses: the prefix plus 1, 2, 3... in the order they were added. */
export const PARTNER_ID_PREFIX = 'demo-partner-'

/** mulberry32: small, fast, deterministic PRNG. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Ranges in ₪ and share of expenses per category. Groceries is the most frequent.
const MIX: Array<{ id: CategoryId; min: number; max: number; weight: number }> = [
  { id: 'groceries', min: 120, max: 650, weight: 0.3 },
  { id: 'eating_out', min: 45, max: 260, weight: 0.15 },
  { id: 'transport', min: 60, max: 380, weight: 0.12 },
  { id: 'home', min: 40, max: 900, weight: 0.1 },
  { id: 'kids', min: 30, max: 400, weight: 0.1 },
  { id: 'health', min: 25, max: 180, weight: 0.07 },
  { id: 'fun', min: 40, max: 300, weight: 0.1 },
  { id: 'other', min: 20, max: 150, weight: 0.06 },
]

/** Average expense in agorot under MIX, used to pick how many expenses fit a target. */
const AVERAGE_AGOROT = Math.round(MIX.reduce((sum, c) => sum + c.weight * ((c.min + c.max) / 2), 0) * 100)

function int(rand: () => number, min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1))
}

function shuffle<T>(items: T[], rand: () => number): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Splits n across weights with the largest remainder method (exact total). */
function allocate(n: number, weights: number[]): number[] {
  const total = weights.reduce((s, w) => s + w, 0)
  const raw = weights.map((w) => (w / total) * n)
  const counts = raw.map(Math.floor)
  const order = raw.map((r, i) => ({ i, rest: r - Math.floor(r) })).sort((a, b) => b.rest - a.rest || a.i - b.i)
  const missing = n - counts.reduce((s, c) => s + c, 0)
  for (let k = 0; k < missing; k++) counts[order[k].i] += 1
  return counts
}

const offsetFormat = new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, timeZoneName: 'longOffset' })

/** UTC instant for a wall-clock time in Israel. */
export function israelTimeToIso(date: IsoDate, hour: number, minute: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const wall = Date.UTC(y, m - 1, d, hour, minute)
  const offsetAt = (ms: number) => {
    const name = offsetFormat.formatToParts(new Date(ms)).find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+02:00'
    const match = /GMT([+-])(\d{2}):?(\d{2})?/.exec(name)
    if (!match) return 0
    const sign = match[1] === '-' ? -1 : 1
    return sign * (Number(match[2]) * 60 + Number(match[3] ?? 0)) * 60_000
  }
  const firstGuess = wall - offsetAt(wall)
  return new Date(wall - offsetAt(firstGuess)).toISOString()
}

interface Draft {
  category: CategoryId
  agorot: number
}

/**
 * n expenses following MIX, scaled so they add up to exactly `targetAgorot` (whole shekels),
 * with every amount kept inside its category's range.
 */
function draftAmounts(n: number, targetAgorot: number, rand: () => number): Draft[] {
  const counts = allocate(
    n,
    MIX.map((c) => c.weight),
  )
  const categories = shuffle(
    MIX.flatMap((c, i) => Array.from({ length: counts[i] }, () => c)),
    rand,
  )
  const drafts = categories.map((c) => ({ mix: c, agorot: int(rand, c.min, c.max) * 100 }))
  const sum = drafts.reduce((s, d) => s + d.agorot, 0)
  const target = Math.round(targetAgorot / 100) * 100
  const factor = target / sum
  const clamp = (d: (typeof drafts)[number], agorot: number) => Math.min(d.mix.max * 100, Math.max(d.mix.min * 100, agorot))
  for (const d of drafts) d.agorot = clamp(d, Math.round((d.agorot * factor) / 100) * 100)
  // Spread what is left, one shekel at a time, over expenses that still have room in their range.
  let diff = target - drafts.reduce((s, d) => s + d.agorot, 0)
  const step = diff > 0 ? 100 : -100
  while (diff !== 0) {
    let moved = false
    for (const d of drafts) {
      if (diff === 0) break
      const next = clamp(d, d.agorot + step)
      if (next !== d.agorot) {
        d.agorot = next
        diff -= step
        moved = true
      }
    }
    if (!moved) break
  }
  return drafts.map((d) => ({ category: d.mix.id, agorot: d.agorot }))
}

/** Category ranges in agorot, for tests. */
export const CATEGORY_RANGES = Object.fromEntries(MIX.map((c) => [c.id, { min: c.min * 100, max: c.max * 100 }])) as Record<
  CategoryId,
  { min: number; max: number }
>

function buildExpenses(
  drafts: Draft[],
  dates: IsoDate[],
  rand: () => number,
  idPrefix: string,
  timeFor: (date: IsoDate) => string,
): Expense[] {
  const noaCount = Math.round(drafts.length * 0.55)
  const payers = shuffle(
    drafts.map((_, i) => (i < noaCount ? DEMO.noaId : DEMO.danId)),
    rand,
  )
  return drafts.map((d, i) => {
    const createdAt = timeFor(dates[i])
    return {
      id: `${idPrefix}-${String(i + 1).padStart(2, '0')}`,
      householdId: DEMO.householdId,
      memberId: payers[i],
      amountAgorot: d.agorot,
      category: d.category,
      spentOn: dates[i],
      logDurationMs: int(rand, 2500, 9000),
      createdAt,
      updatedAt: createdAt,
      deletedAt: null,
    }
  })
}

function randomDates(n: number, from: IsoDate, to: IsoDate, rand: () => number): IsoDate[] {
  const span = diffDays(from, to)
  return Array.from({ length: n }, () => addDays(from, int(rand, 0, span))).sort()
}

/** Target total for the current cycle: elapsed share x budget x 1.08, capped under budget. */
export function currentTargetAgorot(today: IsoDate, cycle: Cycle): number {
  const length = diffDays(cycle.start, cycle.endExclusive)
  const elapsed = diffDays(cycle.start, today) + 1
  const share = Math.min((elapsed / length) * DEMO.aheadOfPace, DEMO.maxCurrentShare)
  return Math.round((DEMO.budgetAgorot * share) / 100) * 100
}

export function buildDemoSeed(today: IsoDate, now: Date, lang: Lang = LANG): StoreData {
  const rand = mulberry32(42)
  const current = cycleFor(today, DEMO.cycleStartDay)
  const firstDay = today === current.start

  // Seeded times stay strictly in the past, so a new expense always sorts first.
  const pastTime = (r: () => number) => (date: IsoDate) => israelTimeToIso(date, int(r, 7, 21), int(r, 0, 59))
  const earlierToday = () => {
    const midnight = Date.parse(israelTimeToIso(today, 0, 0))
    let ms = Math.max(now.getTime() - int(rand, 20, 90) * 60_000, midnight)
    if (ms >= now.getTime()) ms = now.getTime() - 1000
    return new Date(ms).toISOString()
  }

  // Current cycle: dated from the start to yesterday; on the first day, 1 or 2 from earlier today.
  const target = currentTargetAgorot(today, current)
  const count = firstDay ? int(rand, 1, 2) : Math.min(34, Math.max(2, Math.round(target / AVERAGE_AGOROT)))
  const curDrafts = draftAmounts(count, target, rand)
  const curDates = firstDay
    ? curDrafts.map(() => today)
    : randomDates(curDrafts.length, current.start, addDays(today, -1), rand)
  const curExpenses = buildExpenses(curDrafts, curDates, rand, 'demo-cur', firstDay ? earlierToday : pastTime(rand))

  // Earlier cycles, each from its own generator. The previous one keeps its old id prefix.
  const earlier: Expense[] = []
  let oldest = current
  HISTORY.forEach(({ share, count: n, seed }, i) => {
    const back = i + 1
    const cycle = shiftCycle(current, DEMO.cycleStartDay, -back)
    const r = mulberry32(seed)
    const drafts = draftAmounts(n, DEMO.budgetAgorot * share, r)
    const dates = randomDates(drafts.length, cycle.start, cycle.lastDay, r)
    earlier.push(...buildExpenses(drafts, dates, r, back === 1 ? 'demo-prev' : `demo-h${back}`, pastTime(r)))
    oldest = cycle
  })

  const createdAt = israelTimeToIso(oldest.start, 9, 0)
  const household: Household = {
    id: DEMO.householdId,
    budgetAgorot: DEMO.budgetAgorot,
    cycleStartDay: DEMO.cycleStartDay,
    inviteCode: DEMO.inviteCode,
    createdAt,
    updatedAt: createdAt,
  }
  const members: Member[] = [
    { id: DEMO.noaId, householdId: DEMO.householdId, displayName: lang === 'en' ? 'Noa' : 'נועה', color: 'teal', createdAt },
    { id: DEMO.danId, householdId: DEMO.householdId, displayName: lang === 'en' ? 'Dan' : 'דן', color: 'violet', createdAt },
  ]

  return {
    version: 1,
    seededOn: today,
    seededLang: lang,
    session: { householdId: DEMO.householdId, memberId: DEMO.noaId },
    household,
    members,
    expenses: [...earlier, ...curExpenses],
    events: [],
    nextEventId: 1,
  }
}
