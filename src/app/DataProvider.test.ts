import { describe, expect, it } from 'vitest'
import type { Cycle } from '../domain/cycle.ts'
import type { Expense } from '../domain/types.ts'
import { sameAs, withExpense, withoutExpense, type Snapshot } from './DataProvider.tsx'

const cycle: Cycle = { start: '2026-09-10', endExclusive: '2026-10-10', lastDay: '2026-10-09' }

const expense = (id: string, spentOn: string, createdAt: string): Expense => ({
  id,
  householdId: 'h1',
  memberId: 'm1',
  amountAgorot: 4500,
  category: 'groceries',
  spentOn,
  logDurationMs: 3000,
  createdAt,
  updatedAt: createdAt,
  deletedAt: null,
})

// Newest first, as the repos list them.
const list = [expense('b', '2026-10-02', '2026-10-02T09:00:00Z'), expense('a', '2026-09-20', '2026-09-20T09:00:00Z')]

describe('the list on screen right after a save (before the reload)', () => {
  it('puts a new expense in its place, newest first', () => {
    const today = expense('c', '2026-10-02', '2026-10-02T12:00:00Z')
    const older = expense('d', '2026-09-25', '2026-10-02T12:00:00Z')
    expect(withExpense(list, today, cycle).map((e) => e.id)).toEqual(['c', 'b', 'a'])
    expect(withExpense(list, older, cycle).map((e) => e.id)).toEqual(['b', 'd', 'a'])
  })

  it('replaces an edited expense instead of adding it twice', () => {
    const edited = { ...list[1], amountAgorot: 100 }
    const next = withExpense(list, edited, cycle)
    expect(next.map((e) => e.id)).toEqual(['b', 'a'])
    expect(next[1].amountAgorot).toBe(100)
  })

  it('leaves out an expense dated outside the cycle on screen', () => {
    expect(withExpense(list, expense('e', '2026-09-09', '2026-10-02T12:00:00Z'), cycle).map((e) => e.id)).toEqual(['b', 'a'])
    // An edit that moves a row to another cycle takes it out of this list.
    expect(withExpense(list, { ...list[0], spentOn: '2026-10-10' }, cycle).map((e) => e.id)).toEqual(['a'])
  })

  it('removes a deleted expense', () => {
    expect(withoutExpense(list, 'b').map((e) => e.id)).toEqual(['a'])
    expect(withoutExpense(list, 'zzz')).toEqual(list)
  })
})

describe('a reload that brings the same data', () => {
  const snap = (expenses: Expense[]): Snapshot => ({
    status: 'ready',
    today: '2026-10-02',
    session: { householdId: 'h1', memberId: 'm1' },
    household: { id: 'h1', budgetAgorot: 900000, cycleStartDay: 10, inviteCode: 'ABC234', createdAt: 'x', updatedAt: 'x' },
    members: [{ id: 'm1', householdId: 'h1', displayName: 'Noa', color: 'teal', createdAt: 'x' }],
    cycle,
    currentCycle: cycle,
    viewOffset: 0,
    expenses,
  })

  it('keeps the snapshot on screen, so nothing re-renders', () => {
    const prev = snap(list)
    // The server sends new objects with the same values.
    const next = snap(list.map((e) => ({ ...e })))
    expect(sameAs(prev, next)).toBe(prev)
  })

  it('makes only the changed row a new object', () => {
    const prev = snap(list)
    const next = snap([{ ...list[0], amountAgorot: 999 }, { ...list[1] }])
    const merged = sameAs(prev, next)
    expect(merged).not.toBe(prev)
    expect(merged.expenses[0]).not.toBe(prev.expenses[0])
    expect(merged.expenses[1]).toBe(prev.expenses[1])
    expect(merged.household).toBe(prev.household)
    expect(merged.members).toBe(prev.members)
  })

  it('counts a sent offline expense (no more clock) and a new order as changes', () => {
    const pending = { ...list[0], pending: true }
    const prev = snap([pending, list[1]])
    const sent = sameAs(prev, snap([{ ...list[0] }, list[1]]))
    expect(sent.expenses[0].pending).toBeUndefined()
    expect(sameAs(prev, snap([list[1], pending])).expenses.map((e) => e.id)).toEqual(['a', 'b'])
  })
})
