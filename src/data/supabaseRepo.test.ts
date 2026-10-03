import { AuthApiError, AuthRetryableFetchError, type SupabaseClient } from '@supabase/supabase-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearOffline, offlineCache } from './offline.ts'
import { SupabaseRepo } from './supabaseRepo.ts'

/** Just enough of the Supabase client for login and the personal code; every answer is set per test. */
function fakeClient(answers: {
  authSession?: { data: { session: unknown }; error: unknown }
  personalCode?: { data: unknown; error: unknown }
  join?: { data: unknown; error: unknown }
  /** Rows for the "which member is this login" lookup. */
  memberRows?: unknown[]
}) {
  const query = (result: unknown) => {
    const chain: Record<string, unknown> = {}
    for (const method of ['select', 'eq', 'is', 'insert', 'update']) chain[method] = () => chain
    chain.maybeSingle = async () => result
    chain.limit = async () => result
    chain.then = (resolve: (value: unknown) => unknown) => resolve({ data: null, error: null })
    return chain
  }
  return {
    auth: {
      getSession: async () => answers.authSession ?? { data: { session: null }, error: null },
      signInAnonymously: async () => ({ error: null }),
    },
    from: (table: string) =>
      query(
        table === 'member_secrets'
          ? answers.personalCode
          : table === 'members'
            ? { data: answers.memberRows ?? [], error: null }
            : { data: [], error: null },
      ),
    rpc: async () => answers.join,
    removeChannel: async () => undefined,
  } as unknown as SupabaseClient
}

const signedIn = async (repo: SupabaseRepo) => {
  offlineCache.update({ session: { householdId: 'h1', memberId: 'm1' } })
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
  await repo.getSession()
  vi.restoreAllMocks()
}

afterEach(() => {
  vi.restoreAllMocks()
  clearOffline()
})

describe('personal code', () => {
  it('is kept on the device, so the disconnect warning can show it offline', async () => {
    const repo = new SupabaseRepo(fakeClient({ personalCode: { data: { personal_code: 'ABCDEFGHJKMN' }, error: null } }))
    await signedIn(repo)
    expect(await repo.getMyPersonalCode()).toBe('ABCDEFGHJKMN')
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    expect(await repo.getMyPersonalCode()).toBe('ABCDEFGHJKMN')
  })

  it('a failed load with nothing cached is an error, never a silent "no code"', async () => {
    const repo = new SupabaseRepo(fakeClient({ personalCode: { data: null, error: { message: 'Failed to fetch' } } }))
    await signedIn(repo)
    await expect(repo.getMyPersonalCode()).rejects.toMatchObject({ code: 'network' })
  })

  it('a rejoin forgets the cached code, which the server just changed', async () => {
    const repo = new SupabaseRepo(
      fakeClient({
        personalCode: { data: { personal_code: 'ABCDEFGHJKMN' }, error: null },
        join: { data: { household_id: 'h1', member_id: 'm1' }, error: null },
      }),
    )
    await signedIn(repo)
    await repo.getMyPersonalCode()
    await repo.joinHousehold('ABC234', '', 'ABCDEFGHJKMN')
    expect(offlineCache.get().personalCode).toBeUndefined()
  })

  it('alone takes the seat back on a new device: no invite code, no name', async () => {
    const client = fakeClient({ join: { data: { household_id: 'h1', member_id: 'm1', rejoined: true }, error: null } })
    const rpc = vi.spyOn(client, 'rpc')
    const repo = new SupabaseRepo(client)
    expect(await repo.joinHousehold('', '', 'ABCDEFGHJKMN')).toEqual({ householdId: 'h1', memberId: 'm1' })
    expect(rpc).toHaveBeenCalledWith('join_household', { p_code: '', p_display_name: '', p_personal_code: 'ABCDEFGHJKMN' })
  })

  it('a wrong personal code is reported as such', async () => {
    const repo = new SupabaseRepo(fakeClient({ join: { data: null, error: { message: 'personal_code_invalid', code: 'P0001' } } }))
    await expect(repo.joinHousehold('', '', 'AAAAAAAAAAAA')).rejects.toMatchObject({ code: 'personal_code_invalid' })
  })
})

describe('getSession with an expired login', () => {
  it('keeps this device in its budget when the server cannot be reached', async () => {
    offlineCache.update({ session: { householdId: 'h1', memberId: 'm1' } })
    const repo = new SupabaseRepo(
      fakeClient({ authSession: { data: { session: null }, error: new AuthRetryableFetchError('Failed to fetch', 0) } }),
    )
    expect(await repo.getSession()).toEqual({ householdId: 'h1', memberId: 'm1' })
  })

  it('treats a refused login as signed out, not as offline', async () => {
    offlineCache.update({ session: { householdId: 'h1', memberId: 'm1' } })
    const repo = new SupabaseRepo(
      fakeClient({ authSession: { data: { session: null }, error: new AuthApiError('Invalid Refresh Token', 400, 'refresh_token_not_found') } }),
    )
    expect(await repo.getSession()).toBeNull()
  })
})

describe('getSession on a refresh', () => {
  it('asks the server which member this login is only once while the login stays the same', async () => {
    const client = fakeClient({
      authSession: { data: { session: { user: { id: 'u1' } } }, error: null },
      memberRows: [{ id: 'm1', household_id: 'h1' }],
    })
    const from = vi.spyOn(client, 'from')
    const repo = new SupabaseRepo(client)
    expect(await repo.getSession()).toEqual({ householdId: 'h1', memberId: 'm1' })
    const lookups = () => from.mock.calls.filter(([table]) => table === 'members').length
    expect(lookups()).toBe(1)
    expect(await repo.getSession()).toEqual({ householdId: 'h1', memberId: 'm1' })
    expect(lookups()).toBe(1)
  })
})

describe('opening with the login seen last time', () => {
  const login = { data: { session: { user: { id: 'u1' } } }, error: null }

  it('uses the cached seat at once and checks it with the server alongside', async () => {
    offlineCache.update({ session: { householdId: 'h1', memberId: 'm1' }, sessionUserId: 'u1' })
    const client = fakeClient({ authSession: login, memberRows: [{ id: 'm1', household_id: 'h1' }] })
    const from = vi.spyOn(client, 'from')
    const repo = new SupabaseRepo(client)
    expect(await repo.getSession()).toEqual({ householdId: 'h1', memberId: 'm1' })
    expect(await repo.seatConfirmed()).toBe(true)
    expect(from.mock.calls.filter(([table]) => table === 'members')).toHaveLength(1)
  })

  it('follows the server when the seat was taken back on another device, and says so once', async () => {
    offlineCache.update({ session: { householdId: 'h1', memberId: 'm1' }, sessionUserId: 'u1' })
    const repo = new SupabaseRepo(fakeClient({ authSession: login, memberRows: [] }))
    expect(await repo.getSession()).toEqual({ householdId: 'h1', memberId: 'm1' })
    expect(await repo.seatConfirmed()).toBe(false)
    expect(await repo.seatConfirmed()).toBe(true)
    expect(offlineCache.get().session).toBeUndefined()
    expect(await repo.getSession()).toBeNull()
  })

  it('looks the seat up again on the next load when the check got no answer', async () => {
    offlineCache.update({ session: { householdId: 'h1', memberId: 'm1' }, sessionUserId: 'u1' })
    const answers: Parameters<typeof fakeClient>[0] = { authSession: login }
    const client = fakeClient(answers)
    const repo = new SupabaseRepo(client)
    // The check fails (no answer from the server).
    const fromSpy = vi.spyOn(client, 'from').mockImplementationOnce(() => {
      throw new Error('Failed to fetch')
    })
    expect(await repo.getSession()).toEqual({ householdId: 'h1', memberId: 'm1' })
    expect(await repo.seatConfirmed()).toBe(true)
    fromSpy.mockRestore()
    // The seat was in fact taken back: the next load asks the server and follows it.
    answers.memberRows = []
    expect(await repo.getSession()).toBeNull()
  })

  it('asks the server first when the cached seat belongs to another login', async () => {
    offlineCache.update({ session: { householdId: 'h1', memberId: 'm1' }, sessionUserId: 'someone-else' })
    const repo = new SupabaseRepo(fakeClient({ authSession: login, memberRows: [{ id: 'm2', household_id: 'h2' }] }))
    expect(await repo.getSession()).toEqual({ householdId: 'h2', memberId: 'm2' })
    expect(offlineCache.get()).toMatchObject({ session: { householdId: 'h2', memberId: 'm2' }, sessionUserId: 'u1' })
  })
})
