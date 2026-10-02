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
