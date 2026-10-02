import { afterEach, describe, expect, it } from 'vitest'
import { LazySupabaseRepo } from './lazySupabaseRepo.ts'
import { clearOffline, offlineCache } from './offline.ts'

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

  it('with a cached household it loads the library too, so an offline launch still opens', async () => {
    offlineCache.update({ session: { householdId: 'h1', memberId: 'm1' } })
    await expect(new LazySupabaseRepo().getSession()).rejects.toMatchObject({ code: 'network' })
  })
})
