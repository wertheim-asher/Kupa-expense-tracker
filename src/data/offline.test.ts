import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Expense } from '../domain/types.ts'
import { clearOffline, eventQueue, offlineCache, outbox, pendingExpense, tombstones, type OutboxItem } from './offline.ts'

const item = (id: string, householdId = 'h1', spentOn = '2026-10-01'): OutboxItem => ({
  householdId,
  memberId: 'm1',
  input: { id, amountAgorot: 1200, category: 'fun', spentOn, logDurationMs: 900 },
  queuedAt: '2026-10-01T10:00:00.000Z',
})

const expense = (id: string, spentOn: string, householdId = 'h1'): Expense => ({
  id,
  householdId,
  memberId: 'm1',
  amountAgorot: 100,
  category: 'other',
  spentOn,
  logDurationMs: null,
  createdAt: `${spentOn}T08:00:00.000Z`,
  updatedAt: `${spentOn}T08:00:00.000Z`,
  deletedAt: null,
})

afterEach(() => vi.restoreAllMocks())

describe('outbox', () => {
  it('adds, finds and removes items by client id (no duplicates)', () => {
    expect(outbox.add(item('a'))).toBe(true)
    expect(outbox.add(item('a'))).toBe(true)
    expect(outbox.all()).toHaveLength(1)
    expect(outbox.has('a')).toBe(true)
    expect(outbox.remove('a')).toBe(true)
    expect(outbox.remove('a')).toBe(false)
  })

  it('reports a failed write, so the app never says "saved" for a lost expense', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    expect(outbox.add(item('b'))).toBe(false)
    expect(outbox.has('b')).toBe(false)
  })

  it('a waiting expense is shown as pending', () => {
    expect(pendingExpense(item('c'))).toMatchObject({ id: 'c', amountAgorot: 1200, pending: true, deletedAt: null })
  })
})

describe('event queue', () => {
  it('take() claims a household\'s events so a second flush cannot send them again; putBack() restores them', () => {
    eventQueue.add({ householdId: 'h1', memberId: 'm1', name: 'add_save', props: {}, at: '1' })
    eventQueue.add({ householdId: 'h2', memberId: 'm9', name: 'add_save', props: {}, at: '2' })
    const taken = eventQueue.take('h1')
    expect(taken.map((e) => e.at)).toEqual(['1'])
    expect(eventQueue.take('h1')).toEqual([])
    expect(eventQueue.all().map((e) => e.householdId)).toEqual(['h2'])
    eventQueue.putBack(taken)
    expect(eventQueue.all().map((e) => e.at).sort()).toEqual(['1', '2'])
  })
})

describe('tombstones', () => {
  it('remembers undone ids until the server copy is deleted', () => {
    tombstones.add('h1', 'x')
    tombstones.add('h1', 'x')
    expect(tombstones.all()).toEqual([{ householdId: 'h1', id: 'x' }])
    tombstones.remove('x')
    expect(tombstones.all()).toEqual([])
  })
})

describe('offline cache', () => {
  it('finds expenses for a range that was never loaded (first day of a new cycle, offline)', () => {
    offlineCache.setExpenses('2026-09-10|2026-10-10', [expense('old', '2026-09-20'), expense('late', '2026-10-09')])
    expect(offlineCache.expensesInRange('h1', '2026-10-10', '2026-11-10')).toEqual([])
    expect(offlineCache.expensesInRange('h1', '2026-10-01', '2026-10-31').map((e) => e.id)).toEqual(['late'])
    expect(offlineCache.expensesInRange('h2', '2026-09-01', '2026-11-01')).toEqual([])
  })

  it('a successful write updates every cached range; a moved date leaves the old one', () => {
    offlineCache.setExpenses('2026-08-10|2026-09-10', [])
    offlineCache.setExpenses('2026-09-10|2026-10-10', [expense('e', '2026-09-20')])
    offlineCache.putExpense({ ...expense('e', '2026-09-05'), amountAgorot: 999 })
    const lists = offlineCache.get().expenses ?? {}
    expect(lists['2026-09-10|2026-10-10'].map((e) => e.id)).toEqual([])
    expect(lists['2026-08-10|2026-09-10']).toMatchObject([{ id: 'e', amountAgorot: 999 }])
    offlineCache.dropExpense('e')
    expect(offlineCache.get().expenses?.['2026-08-10|2026-09-10']).toEqual([])
  })

  it('"disconnect this device" clears everything offline', () => {
    outbox.add(item('z'))
    tombstones.add('h1', 'z')
    offlineCache.update({ members: [] })
    clearOffline()
    expect(outbox.all()).toEqual([])
    expect(tombstones.all()).toEqual([])
    expect(offlineCache.get()).toEqual({})
  })
})
