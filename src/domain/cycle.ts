// Billing cycle math (SPEC section 5). Pure functions only.
// Dates are local Israel calendar dates as YYYY-MM-DD strings. Day arithmetic
// runs on UTC midnights, which is plain calendar math with no DST effects.

import { LIMITS, TIME_ZONE } from '../config.ts'
import type { IsoDate } from './types.ts'

export interface Cycle {
  start: IsoDate
  endExclusive: IsoDate
  lastDay: IsoDate
}

const DAY_MS = 86_400_000
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/

const israelDateFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Today's date in Israel, never derived from UTC. */
export function todayInIsrael(now: Date = new Date()): IsoDate {
  const parts = israelDateFormat.formatToParts(now)
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

export function isValidIsoDate(value: string): boolean {
  const m = ISO_RE.exec(value)
  if (!m) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const t = new Date(Date.UTC(y, mo - 1, d))
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d
}

function parse(date: IsoDate): { y: number; m: number; d: number } {
  const match = ISO_RE.exec(date)
  if (!match || !isValidIsoDate(date)) throw new RangeError(`Invalid date: ${date}`)
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) }
}

/** Builds a date from a possibly out-of-range month (13 → January next year). */
function fromParts(y: number, m: number, d: number): IsoDate {
  return toIso(new Date(Date.UTC(y, m - 1, d)))
}

function toIso(t: Date): IsoDate {
  const y = String(t.getUTCFullYear()).padStart(4, '0')
  const m = String(t.getUTCMonth() + 1).padStart(2, '0')
  const d = String(t.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function toUtcMs(date: IsoDate): number {
  const { y, m, d } = parse(date)
  return Date.UTC(y, m - 1, d)
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return toIso(new Date(toUtcMs(date) + days * DAY_MS))
}

/** Whole days from a to b (b - a). */
export function diffDays(a: IsoDate, b: IsoDate): number {
  return Math.round((toUtcMs(b) - toUtcMs(a)) / DAY_MS)
}

export function isValidStartDay(startDay: number): boolean {
  return Number.isInteger(startDay) && startDay >= LIMITS.minCycleDay && startDay <= LIMITS.maxCycleDay
}

function assertStartDay(startDay: number): void {
  if (!isValidStartDay(startDay)) {
    throw new RangeError(`Cycle start day must be an integer from 1 to 28, got ${startDay}`)
  }
}

/** The cycle that contains `date` for a cycle starting on day `startDay`. */
export function cycleFor(date: IsoDate, startDay: number): Cycle {
  assertStartDay(startDay)
  const { y, m, d } = parse(date)
  const startMonth = d >= startDay ? m : m - 1
  const start = fromParts(y, startMonth, startDay)
  const endExclusive = fromParts(y, startMonth + 1, startDay)
  return { start, endExclusive, lastDay: addDays(endExclusive, -1) }
}

/** Moves a cycle by `offset` whole cycles (negative = earlier). */
export function shiftCycle(cycle: Cycle, startDay: number, offset: number): Cycle {
  assertStartDay(startDay)
  if (!Number.isInteger(offset)) throw new RangeError(`Offset must be an integer, got ${offset}`)
  const { y, m } = parse(cycle.start)
  return cycleFor(fromParts(y, m + offset, startDay), startDay)
}

/** Days from today to the cycle's last day, counting today. 0 once the cycle is over. */
export function daysLeft(today: IsoDate, cycle: Cycle): number {
  return Math.max(0, diffDays(today, cycle.lastDay) + 1)
}

export function isInCycle(date: IsoDate, cycle: Cycle): boolean {
  return date >= cycle.start && date < cycle.endExclusive
}
