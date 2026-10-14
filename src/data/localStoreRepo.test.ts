import { describe, expect, it } from 'vitest'
import { buildDemoSeed, DEMO, PARTNER_EXPENSES } from './demoSeed.ts'
import { LocalStoreRepo } from './localStoreRepo.ts'
import { RepoError } from './repo.ts'

class MemoryStorage implements Storage {
  private map = new Map<string, string>()
  failWrites = false
  get length() {
    return this.map.size
  }
  clear() {
    this.map.clear()
  }
  getItem(key: string) {
    return this.map.get(key) ?? null
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null
  }
  removeItem(key: string) {
    this.map.delete(key)
  }
  setItem(key: string, value: string) {
    if (this.failWrites) throw new DOMException('Quota exceeded', 'QuotaExceededError')
    this.map.set(key, value)
  }
}

// 2026-10-04 12:00 in Israel.
const clock = () => new Date('2026-10-04T09:00:00Z')
const TODAY = '2026-10-04'

function setup() {
  const storage = new MemoryStorage()
  const repo = new LocalStoreRepo({ key: 'test', storage, clock })
  return { storage, repo }
}

async function withHousehold() {
  const ctx = setup()
  await ctx.repo.createHousehold({ displayName: '  נועה  ', budgetAgorot: 900_000, cycleStartDay: 10 })
  return ctx
}

const expectCode = async (promise: Promise<unknown>, code: string) => {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  )
  expect(error).toBeInstanceOf(RepoError)
  expect((error as RepoError).code).toBe(code)
}

describe('LocalStoreRepo (LocalRepo)', () => {
  it('starts empty with no session', async () => {
    const { repo } = setup()
    expect(await repo.getSession()).toBeNull()
    await expectCode(repo.getHousehold(), 'no_session')
  })

  it('creates a household with a trimmed name, teal color and a valid invite code', async () => {
    const { repo } = await withHousehold()
    const session = await repo.getSession()
    expect(session).not.toBeNull()
    const household = await repo.getHousehold()
    expect(household.budgetAgorot).toBe(900_000)
    expect(household.cycleStartDay).toBe(10)
    expect(household.inviteCode).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/)
    const members = await repo.getMembers()
    expect(members).toHaveLength(1)
    expect(members[0]).toMatchObject({ displayName: 'נועה', color: 'teal', id: session?.memberId })
  })

  it('rejects a second household on the same device', async () => {
    const { repo } = await withHousehold()
    await expectCode(repo.createHousehold({ displayName: 'דן', budgetAgorot: 100, cycleStartDay: 1 }), 'already_member')
  })

  it.each([
    { displayName: '', budgetAgorot: 900_000, cycleStartDay: 10 },
    { displayName: 'x'.repeat(31), budgetAgorot: 900_000, cycleStartDay: 10 },
    { displayName: 'נועה', budgetAgorot: 0, cycleStartDay: 10 },
    { displayName: 'נועה', budgetAgorot: 10_000_001, cycleStartDay: 10 },
    { displayName: 'נועה', budgetAgorot: 900_000, cycleStartDay: 29 },
    { displayName: 'נועה', budgetAgorot: 900_000, cycleStartDay: 0 },
  ])('rejects invalid create input %j', async (input) => {
    const { repo } = setup()
    await expectCode(repo.createHousehold(input), 'invalid_input')
  })

  it('adds expenses idempotently (same client id twice → one expense)', async () => {
    const { repo } = await withHousehold()
    const input = { id: 'e1', amountAgorot: 4500, category: 'groceries' as const, spentOn: TODAY, logDurationMs: 3200 }
    await repo.addExpense(input)
    await repo.addExpense(input)
    const list = await repo.listExpenses({ from: '2026-09-10', toExclusive: '2026-10-10' })
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ amountAgorot: 4500, category: 'groceries', logDurationMs: 3200 })
  })

  it.each([
    { amountAgorot: 0, spentOn: TODAY },
    { amountAgorot: 10_000_001, spentOn: TODAY },
    { amountAgorot: 12.5, spentOn: TODAY },
    { amountAgorot: 4500, spentOn: '2026-10-05' },
    { amountAgorot: 4500, spentOn: '2025-10-03' },
  ])('blocks invalid expenses %j', async ({ amountAgorot, spentOn }) => {
    const { repo } = await withHousehold()
    await expectCode(repo.addExpense({ id: 'x', amountAgorot, category: 'fun', spentOn, logDurationMs: null }), 'invalid_input')
  })

  it('lists by range, newest first, and hides soft-deleted expenses until restored', async () => {
    const { repo } = await withHousehold()
    await repo.addExpense({ id: 'a', amountAgorot: 100, category: 'fun', spentOn: '2026-09-09', logDurationMs: null })
    await repo.addExpense({ id: 'b', amountAgorot: 200, category: 'fun', spentOn: '2026-09-10', logDurationMs: null })
    await repo.addExpense({ id: 'c', amountAgorot: 300, category: 'fun', spentOn: '2026-10-01', logDurationMs: null })
    const range = { from: '2026-09-10', toExclusive: '2026-10-10' }
    expect((await repo.listExpenses(range)).map((e) => e.id)).toEqual(['c', 'b'])
    await repo.deleteExpense('c')
    expect((await repo.listExpenses(range)).map((e) => e.id)).toEqual(['b'])
    await repo.restoreExpense('c')
    expect((await repo.listExpenses(range)).map((e) => e.id)).toEqual(['c', 'b'])
  })

  it('updates an expense into another cycle', async () => {
    const { repo } = await withHousehold()
    await repo.addExpense({ id: 'a', amountAgorot: 100, category: 'fun', spentOn: TODAY, logDurationMs: null })
    const updated = await repo.updateExpense('a', { spentOn: '2026-09-01', category: 'home', amountAgorot: 999 })
    expect(updated).toMatchObject({ spentOn: '2026-09-01', category: 'home', amountAgorot: 999 })
    expect(await repo.listExpenses({ from: '2026-09-10', toExclusive: '2026-10-10' })).toHaveLength(0)
    await expectCode(repo.updateExpense('a', { spentOn: '2026-10-05' }), 'invalid_input')
    await expectCode(repo.updateExpense('missing', { amountAgorot: 100 }), 'not_found')
  })

  it('updates the household and my name', async () => {
    const { repo } = await withHousehold()
    await repo.updateHousehold({ budgetAgorot: 500_000, cycleStartDay: 1 })
    expect(await repo.getHousehold()).toMatchObject({ budgetAgorot: 500_000, cycleStartDay: 1 })
    await expectCode(repo.updateHousehold({ cycleStartDay: 31 }), 'invalid_input')
    await repo.updateMyName('נועה כהן')
    expect((await repo.getMembers())[0].displayName).toBe('נועה כהן')
  })

  it('persists across instances (reload)', async () => {
    const { repo, storage } = await withHousehold()
    await repo.addExpense({ id: 'a', amountAgorot: 4500, category: 'groceries', spentOn: TODAY, logDurationMs: 1000 })
    const reloaded = new LocalStoreRepo({ key: 'test', storage, clock })
    expect(await reloaded.getSession()).toEqual(await repo.getSession())
    expect(await reloaded.listExpenses({ from: '2026-09-10', toExclusive: '2026-10-10' })).toHaveLength(1)
  })

  it('two tabs writing back to back never lose each other\'s expense', async () => {
    const { repo: tabA, storage } = await withHousehold()
    const tabB = new LocalStoreRepo({ key: 'test', storage, clock })
    await tabB.getSession() // B fills its cache now, before A writes
    await tabA.addExpense({ id: 'from-a', amountAgorot: 100, category: 'fun', spentOn: TODAY, logDurationMs: null })
    await tabB.addExpense({ id: 'from-b', amountAgorot: 200, category: 'home', spentOn: TODAY, logDurationMs: null })
    const ids = (await new LocalStoreRepo({ key: 'test', storage, clock }).listExpenses({ from: '2026-09-10', toExclusive: '2026-10-10' })).map((e) => e.id)
    expect(ids.sort()).toEqual(['from-a', 'from-b'])
  })

  it("a change that fails still leaves this tab with what storage holds (another tab's expense)", async () => {
    const { repo: tabA, storage } = await withHousehold()
    const tabB = new LocalStoreRepo({ key: 'test', storage, clock })
    await tabB.getSession() // B fills its cache now, before A writes
    await tabA.addExpense({ id: 'from-a', amountAgorot: 100, category: 'fun', spentOn: TODAY, logDurationMs: null })
    await expectCode(tabB.updateExpense('missing', { amountAgorot: 100 }), 'not_found')
    expect((await tabB.listExpenses({ from: '2026-09-10', toExclusive: '2026-10-10' })).map((e) => e.id)).toEqual(['from-a'])
  })

  it('a failed write rejects and leaves the data unchanged', async () => {
    const { repo, storage } = await withHousehold()
    storage.failWrites = true
    await expectCode(
      repo.addExpense({ id: 'a', amountAgorot: 4500, category: 'groceries', spentOn: TODAY, logDurationMs: 1000 }),
      'storage_failed',
    )
    expect(await repo.listExpenses({ from: '2026-09-10', toExclusive: '2026-10-10' })).toHaveLength(0)
    expect(() => repo.track('add_start')).not.toThrow()
  })

  it('tracks events and exports expenses (with deleted flag) and events with member names', async () => {
    const { repo } = await withHousehold()
    repo.track('add_save', { duration_ms: 3200, category: 'groceries' })
    await repo.addExpense({ id: 'a', amountAgorot: 4500, category: 'groceries', spentOn: TODAY, logDurationMs: 3200 })
    await repo.addExpense({ id: 'b', amountAgorot: 1290, category: 'fun', spentOn: TODAY, logDurationMs: 2000 })
    await repo.deleteExpense('b')
    const data = await repo.exportData()
    expect(data.expenses.map((e) => [e.id, e.memberName, e.deleted])).toEqual([
      ['a', 'נועה', false],
      ['b', 'נועה', true],
    ])
    expect(data.events).toEqual([
      { createdAt: clock().toISOString(), memberName: 'נועה', name: 'add_save', props: { duration_ms: 3200, category: 'groceries' } },
    ])
  })

  it('resetDevice clears everything', async () => {
    const { repo } = await withHousehold()
    await repo.resetDevice()
    expect(await repo.getSession()).toBeNull()
  })

  it('peekCached gives at once what the first load would (null without a budget, or on any error)', async () => {
    const { repo, storage } = setup()
    const range = { from: '2026-09-10', toExclusive: '2026-10-10' }
    expect(repo.peekCached(() => range)).toBeNull()
    await repo.createHousehold({ displayName: 'נועה', budgetAgorot: 900_000, cycleStartDay: 10 })
    await repo.addExpense({ id: 'e1', amountAgorot: 4500, category: 'groceries', spentOn: '2026-10-02', logDurationMs: 3000 })
    await repo.addExpense({ id: 'e2', amountAgorot: 1200, category: 'fun', spentOn: '2026-09-01', logDurationMs: 3000 })
    await repo.addExpense({ id: 'e3', amountAgorot: 99, category: 'fun', spentOn: '2026-10-03', logDurationMs: null })
    await repo.deleteExpense('e3')

    // A new repo on the same storage, as on the next launch.
    const again = new LocalStoreRepo({ key: 'test', storage, clock })
    let askedFor = 0
    const home = again.peekCached((h) => {
      askedFor = h.cycleStartDay
      return range
    })
    expect(askedFor).toBe(10)
    expect(home).toEqual({
      session: await again.getSession(),
      household: await again.getHousehold(),
      members: await again.getMembers(),
      expenses: await again.listExpenses(range),
    })
    expect(home?.expenses.map((e) => e.id)).toEqual(['e1'])
    expect(
      again.peekCached(() => {
        throw new Error('bad range')
      }),
    ).toBeNull()
  })

  it('joining is not available locally', async () => {
    const { repo } = setup()
    await expectCode(repo.joinHousehold('ABCDEF', 'דן'), 'unsupported')
  })
})

describe('LocalStoreRepo with the demo seed (DemoRepo)', () => {
  it('starts seeded, as Noa, and resets back to the seed', async () => {
    const storage = new MemoryStorage()
    const repo = new LocalStoreRepo({ key: 'demo', storage, clock, seed: buildDemoSeed })
    expect(await repo.getSession()).toEqual({ householdId: DEMO.householdId, memberId: DEMO.noaId })
    const range = { from: '2026-09-10', toExclusive: '2026-10-10' }
    const seeded = await repo.listExpenses(range)
    expect(seeded.length).toBeGreaterThan(20)
    await repo.addExpense({ id: 'new', amountAgorot: 4500, category: 'groceries', spentOn: TODAY, logDurationMs: 2000 })
    expect((await repo.listExpenses(range))[0].id).toBe('new')
    await repo.resetDevice()
    expect(await repo.listExpenses(range)).toEqual(seeded)
  })

  it('keeps changes through reloads the same day, and starts from a new seed the next day', async () => {
    const storage = new MemoryStorage()
    const range = { from: '2026-09-10', toExclusive: '2026-10-10' }
    const first = new LocalStoreRepo({ key: 'demo', storage, clock, seed: buildDemoSeed })
    await first.addExpense({ id: 'mine', amountAgorot: 4500, category: 'groceries', spentOn: TODAY, logDurationMs: 2000 })

    // A reload later the same day (a new repo on the same storage) keeps the expense.
    const evening = () => new Date('2026-10-04T20:00:00Z') // 23:00 in Israel
    const sameDay = new LocalStoreRepo({ key: 'demo', storage, clock: evening, seed: buildDemoSeed })
    expect((await sameDay.listExpenses(range)).some((e) => e.id === 'mine')).toBe(true)

    // The next morning the demo is today's seed: the new cycle has its expenses, the old one is gone.
    const nextWeek = () => new Date('2026-10-11T07:00:00Z')
    const later = new LocalStoreRepo({ key: 'demo', storage, clock: nextWeek, seed: buildDemoSeed })
    const now = await later.listExpenses({ from: '2026-10-10', toExclusive: '2026-11-10' })
    expect(now.length).toBeGreaterThan(0)
    expect((await later.listExpenses(range)).some((e) => e.id === 'mine')).toBe(false)
    expect(JSON.parse(storage.getItem('demo')!).seededOn).toBe('2026-10-11')
  })

  it('starts again after a language switch, so the names match the language', async () => {
    const storage = new MemoryStorage()
    const hebrew = new LocalStoreRepo({ key: 'demo', storage, clock, seed: buildDemoSeed, lang: 'he' })
    expect((await hebrew.getMembers()).map((m) => m.displayName)).toEqual(['נועה', 'דן'])
    await hebrew.addExpense({ id: 'mine', amountAgorot: 4500, category: 'groceries', spentOn: TODAY, logDurationMs: 2000 })

    // Same language later the same day: kept.
    const again = new LocalStoreRepo({ key: 'demo', storage, clock, seed: buildDemoSeed, lang: 'he' })
    expect((await again.listExpenses({ from: TODAY, toExclusive: '2026-10-05' })).some((e) => e.id === 'mine')).toBe(true)

    // English: a new seed with English names.
    const english = new LocalStoreRepo({ key: 'demo', storage, clock, seed: buildDemoSeed, lang: 'en' })
    expect((await english.getMembers()).map((m) => m.displayName)).toEqual(['Noa', 'Dan'])
    expect((await english.listExpenses({ from: TODAY, toExclusive: '2026-10-05' })).some((e) => e.id === 'mine')).toBe(false)
  })

  it('replaces a demo saved before seeds were dated', async () => {
    const storage = new MemoryStorage()
    const old = buildDemoSeed(TODAY, clock())
    delete old.seededOn
    old.expenses = []
    storage.setItem('demo', JSON.stringify(old))
    const repo = new LocalStoreRepo({ key: 'demo', storage, clock, seed: buildDemoSeed })
    expect((await repo.listExpenses({ from: '2026-09-10', toExclusive: '2026-10-10' })).length).toBeGreaterThan(20)
  })

  it('never resets a store without a seed (the real app on this device)', async () => {
    const { storage, repo } = await withHousehold()
    await repo.addExpense({ id: 'keep', amountAgorot: 4500, category: 'groceries', spentOn: TODAY, logDurationMs: 2000 })
    const nextWeek = () => new Date('2026-10-11T07:00:00Z')
    const later = new LocalStoreRepo({ key: 'test', storage, clock: nextWeek })
    expect((await later.listExpenses({ from: '2026-09-10', toExclusive: '2026-10-10' })).map((e) => e.id)).toEqual(['keep'])
  })

  it('simulates a different partner expense each time, dated today, in order and then again', async () => {
    const storage = new MemoryStorage()
    const repo = new LocalStoreRepo({ key: 'demo', storage, clock, seed: buildDemoSeed })
    const today = { from: TODAY, toExclusive: '2026-10-05' }
    const added = async () => {
      const ids = new Set((await repo.listExpenses(today)).map((e) => e.id))
      await repo.simulatePartnerExpense()
      return (await repo.listExpenses(today)).filter((e) => !ids.has(e.id))
    }
    for (let i = 0; i < PARTNER_EXPENSES.length + 1; i++) {
      const [e, ...more] = await added()
      expect(more).toEqual([])
      const want = PARTNER_EXPENSES[i % PARTNER_EXPENSES.length]
      expect([e.category, e.amountAgorot, e.memberId, e.spentOn]).toEqual([want.category, want.agorot, DEMO.danId, TODAY])
    }
  })
})
