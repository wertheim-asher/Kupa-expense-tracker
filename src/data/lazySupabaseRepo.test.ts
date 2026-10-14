import { afterEach, describe, expect, it } from 'vitest'
import { LazySupabaseRepo } from './lazySupabaseRepo.ts'
import { clearOffline, offlineCache, outbox } from './offline.ts'

afterEach(() => {
  localStorage.removeItem('kupa.auth')
  clearOffline()
})

describe('LazySupabaseRepo', () => {
  it('a first visit (no login, nothing cached) needs no server library: no session, nothing loaded', async () => {
    const repo = new LazySupabaseRepo()
    expect(await repo.getSession()).toBeNull()
    expect(repo.peekHousehold()).toBeNull()
  })

  it('with a stored login it loads the library (not configured in tests, so a network error)', async () => {
    localStorage.setItem('kupa.auth', '{}')
    await expect(new LazySupabaseRepo().getSession()).rejects.toMatchObject({ code: 'network' })
  })

  it("shows this member's cached personal code without asking the server, and never another member's", () => {
    const repo = new LazySupabaseRepo()
    expect(repo.peekPersonalCode()).toBeUndefined()
    offlineCache.update({ session: { householdId: 'h1', memberId: 'm1' }, personalCode: { memberId: 'm1', code: 'ABCDEFGHJKMN' } })
    expect(repo.peekPersonalCode()).toBe('ABCDEFGHJKMN')
    offlineCache.update({ session: { householdId: 'h1', memberId: 'm2' } })
    expect(repo.peekPersonalCode()).toBeUndefined()
  })

  it('opens on the home this device showed last time, with expenses saved offline', () => {
    const range = { from: '2026-09-10', toExclusive: '2026-10-10' }
    const repo = new LazySupabaseRepo()
    const household = { id: 'h1', budgetAgorot: 900000, cycleStartDay: 10, inviteCode: 'ABC234', createdAt: 'x', updatedAt: 'x' }
    const members = [{ id: 'm1', householdId: 'h1', displayName: 'Noa', color: 'teal' as const, createdAt: 'x' }]
    const row = (id: string, spentOn: string) => ({
      id, householdId: 'h1', memberId: 'm1', amountAgorot: 100, category: 'fun' as const, spentOn,
      logDurationMs: null, createdAt: `${spentOn}T08:00:00Z`, updatedAt: 'x', deletedAt: null,
    })
    offlineCache.update({ session: { householdId: 'h1', memberId: 'm1' }, household, members, expenses: { [`${range.from}|${range.toExclusive}`]: [row('a', '2026-09-20')] } })
    // Signed out on this device: nothing to open on.
    expect(repo.peekCached(() => range)).toBeNull()
    localStorage.setItem('kupa.auth', '{}')
    outbox.add({ householdId: 'h1', memberId: 'm1', input: { id: 'p', amountAgorot: 200, category: 'home', spentOn: '2026-10-01', logDurationMs: 1 }, queuedAt: '2026-10-01T09:00:00Z' })
    const home = repo.peekCached(() => range)
    expect(home?.expenses.map((e) => [e.id, e.pending ?? false])).toEqual([['p', true], ['a', false]])
    expect(home?.household.id).toBe('h1')
    // A cycle this device never loaded: open as before.
    expect(repo.peekCached(() => ({ from: '2026-10-10', toExclusive: '2026-11-10' }))).toBeNull()
    outbox.save([])
  })

  it('prepare() starts loading quietly: a failure is not thrown, and the next call tries again', async () => {
    const repo = new LazySupabaseRepo()
    expect(() => repo.prepare()).not.toThrow()
    await Promise.resolve()
    await expect(repo.createHousehold({ displayName: 'Noa', budgetAgorot: 900000, cycleStartDay: 10 })).rejects.toMatchObject({ code: 'network' })
  })

  it('with a cached household it loads the library too, so an offline launch still opens', async () => {
    offlineCache.update({ session: { householdId: 'h1', memberId: 'm1' } })
    await expect(new LazySupabaseRepo().getSession()).rejects.toMatchObject({ code: 'network' })
  })
})
