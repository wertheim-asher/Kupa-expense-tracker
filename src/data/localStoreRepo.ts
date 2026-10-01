// A Repo kept entirely in one localStorage entry. LocalRepo (the real app in the
// fast lane) starts empty; DemoRepo starts from the demo seed. No network needed.

import { todayInIsrael } from '../domain/cycle.ts'
import type {
  CreateInput,
  CreateResult,
  Expense,
  ExpensePatch,
  ExportEvent,
  ExportExpense,
  Household,
  HouseholdPatch,
  IsoDate,
  JoinResult,
  Member,
  NewExpense,
  Session,
} from '../domain/types.ts'
import { RepoError, type Repo } from './repo.ts'
import { emptyStore, isStoreData, type StoreData } from './store.ts'
import { inviteCode, uuid } from './uuid.ts'
import { checkAmount, checkCycleDay, checkNewExpense, checkPatch, cleanName } from './validate.ts'

export interface LocalStoreOptions {
  /** localStorage key. */
  key: string
  /** Builds the starting data. Without it the store starts empty. */
  seed?: (today: IsoDate, now: Date) => StoreData
  clock?: () => Date
  storage?: Storage | null
}

function defaultStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

export class LocalStoreRepo implements Repo {
  private data: StoreData | null = null
  private readonly listeners = new Set<() => void>()
  private readonly key: string
  private readonly seed?: (today: IsoDate, now: Date) => StoreData
  private readonly clock: () => Date
  private readonly storage: Storage | null

  constructor(options: LocalStoreOptions) {
    this.key = options.key
    this.seed = options.seed
    this.clock = options.clock ?? (() => new Date())
    this.storage = options.storage === undefined ? defaultStorage() : options.storage
  }

  // ---- storage ----

  private today(): IsoDate {
    return todayInIsrael(this.clock())
  }

  private nowIso(): string {
    return this.clock().toISOString()
  }

  private load(): StoreData {
    if (this.data) return this.data
    let stored: unknown = null
    try {
      const raw = this.storage?.getItem(this.key)
      stored = raw ? JSON.parse(raw) : null
    } catch {
      stored = null
    }
    if (isStoreData(stored)) {
      this.data = stored
    } else {
      this.data = this.seed ? this.seed(this.today(), this.clock()) : emptyStore()
      try {
        this.write(this.data)
      } catch {
        // Keep working in memory if storage is unavailable.
      }
    }
    return this.data
  }

  private write(next: StoreData): void {
    this.storage?.setItem(this.key, JSON.stringify(next))
  }

  /** Applies a change to a copy, persists it, and only then makes it current. */
  private mutate<T>(change: (draft: StoreData) => T): T {
    const draft = structuredClone(this.load())
    const result = change(draft)
    try {
      this.write(draft)
    } catch (error) {
      throw new RepoError('storage_failed', error instanceof Error ? error.message : undefined)
    }
    this.data = draft
    return result
  }

  private requireSession(d: StoreData): { session: Session; household: Household } {
    if (!d.session || !d.household || d.household.id !== d.session.householdId) throw new RepoError('no_session')
    return { session: d.session, household: d.household }
  }

  private readonly onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== this.key) return
    this.data = null
    for (const listener of this.listeners) listener()
  }

  // ---- Repo ----

  async getSession(): Promise<Session | null> {
    const d = this.load()
    return d.session && d.household ? { ...d.session } : null
  }

  async createHousehold(input: CreateInput): Promise<CreateResult> {
    const displayName = cleanName(input.displayName)
    checkAmount(input.budgetAgorot)
    checkCycleDay(input.cycleStartDay)
    return this.mutate((d) => {
      if (d.session) throw new RepoError('already_member')
      const now = this.nowIso()
      const household: Household = {
        id: uuid(),
        budgetAgorot: input.budgetAgorot,
        cycleStartDay: input.cycleStartDay,
        inviteCode: inviteCode(),
        createdAt: now,
        updatedAt: now,
      }
      const member: Member = { id: uuid(), householdId: household.id, displayName, color: 'teal', createdAt: now }
      d.household = household
      d.members = [member]
      d.expenses = []
      d.session = { householdId: household.id, memberId: member.id }
      return { householdId: household.id, memberId: member.id, inviteCode: household.inviteCode }
    })
  }

  async joinHousehold(_code: string, _displayName: string): Promise<JoinResult> {
    // Joining needs a shared backend (Phase 3). The fast lane hides every join entry point.
    throw new RepoError('unsupported')
  }

  async getHousehold(): Promise<Household> {
    return { ...this.requireSession(this.load()).household }
  }

  async getMembers(): Promise<Member[]> {
    const d = this.load()
    const { household } = this.requireSession(d)
    return d.members.filter((m) => m.householdId === household.id).map((m) => ({ ...m }))
  }

  async listExpenses(range: { from: string; toExclusive: string }): Promise<Expense[]> {
    const d = this.load()
    const { household } = this.requireSession(d)
    return d.expenses
      .filter(
        (e) =>
          e.householdId === household.id &&
          e.deletedAt === null &&
          e.spentOn >= range.from &&
          e.spentOn < range.toExclusive,
      )
      .sort((a, b) => (a.spentOn === b.spentOn ? b.createdAt.localeCompare(a.createdAt) : b.spentOn.localeCompare(a.spentOn)))
      .map((e) => ({ ...e }))
  }

  async addExpense(input: NewExpense): Promise<Expense> {
    const existing = this.load().expenses.find((e) => e.id === input.id)
    if (existing) return { ...existing }
    checkNewExpense(input, this.today())
    return this.mutate((d) => {
      const { session } = this.requireSession(d)
      const now = this.nowIso()
      const expense: Expense = {
        id: input.id,
        householdId: session.householdId,
        memberId: session.memberId,
        amountAgorot: input.amountAgorot,
        category: input.category,
        spentOn: input.spentOn,
        logDurationMs: input.logDurationMs,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      }
      d.expenses.push(expense)
      return { ...expense }
    })
  }

  async updateExpense(id: string, patch: ExpensePatch): Promise<Expense> {
    checkPatch(patch, this.today())
    return this.mutate((d) => {
      const { household } = this.requireSession(d)
      const expense = d.expenses.find((e) => e.id === id && e.householdId === household.id && e.deletedAt === null)
      if (!expense) throw new RepoError('not_found')
      if (patch.amountAgorot !== undefined) expense.amountAgorot = patch.amountAgorot
      if (patch.category !== undefined) expense.category = patch.category
      if (patch.spentOn !== undefined) expense.spentOn = patch.spentOn
      expense.updatedAt = this.nowIso()
      return { ...expense }
    })
  }

  async deleteExpense(id: string): Promise<void> {
    this.mutate((d) => {
      const { household } = this.requireSession(d)
      const expense = d.expenses.find((e) => e.id === id && e.householdId === household.id)
      if (!expense) throw new RepoError('not_found')
      if (expense.deletedAt === null) {
        expense.deletedAt = this.nowIso()
        expense.updatedAt = expense.deletedAt
      }
    })
  }

  async restoreExpense(id: string): Promise<void> {
    this.mutate((d) => {
      const { household } = this.requireSession(d)
      const expense = d.expenses.find((e) => e.id === id && e.householdId === household.id)
      if (!expense) throw new RepoError('not_found')
      expense.deletedAt = null
      expense.updatedAt = this.nowIso()
    })
  }

  async updateHousehold(patch: HouseholdPatch): Promise<Household> {
    if (patch.budgetAgorot !== undefined) checkAmount(patch.budgetAgorot)
    if (patch.cycleStartDay !== undefined) checkCycleDay(patch.cycleStartDay)
    return this.mutate((d) => {
      const { household } = this.requireSession(d)
      if (patch.budgetAgorot !== undefined) household.budgetAgorot = patch.budgetAgorot
      if (patch.cycleStartDay !== undefined) household.cycleStartDay = patch.cycleStartDay
      household.updatedAt = this.nowIso()
      return { ...household }
    })
  }

  async updateMyName(name: string): Promise<void> {
    const displayName = cleanName(name)
    this.mutate((d) => {
      const { session } = this.requireSession(d)
      const me = d.members.find((m) => m.id === session.memberId)
      if (!me) throw new RepoError('not_found')
      me.displayName = displayName
    })
  }

  subscribe(onChange: () => void): () => void {
    if (this.listeners.size === 0) {
      // Nobody was listening, so another tab may have written meanwhile: read fresh from storage.
      this.data = null
      if (typeof window !== 'undefined') window.addEventListener('storage', this.onStorage)
    }
    this.listeners.add(onChange)
    return () => {
      this.listeners.delete(onChange)
      if (this.listeners.size === 0 && typeof window !== 'undefined') window.removeEventListener('storage', this.onStorage)
    }
  }

  track(name: string, props: Record<string, unknown> = {}): void {
    try {
      this.mutate((d) => {
        d.events.push({
          id: d.nextEventId,
          householdId: d.session?.householdId ?? null,
          memberId: d.session?.memberId ?? null,
          name,
          props: structuredClone(props),
          createdAt: this.nowIso(),
        })
        d.nextEventId += 1
      })
    } catch {
      // Analytics must never break the app.
    }
  }

  async exportData(): Promise<{ expenses: ExportExpense[]; events: ExportEvent[] }> {
    const d = this.load()
    const { household } = this.requireSession(d)
    const nameOf = (memberId: string | null) => d.members.find((m) => m.id === memberId)?.displayName ?? ''
    const expenses = d.expenses
      .filter((e) => e.householdId === household.id)
      .sort((a, b) => a.spentOn.localeCompare(b.spentOn) || a.createdAt.localeCompare(b.createdAt))
      .map<ExportExpense>((e) => ({
        id: e.id,
        spentOn: e.spentOn,
        createdAt: e.createdAt,
        memberName: nameOf(e.memberId),
        category: e.category,
        amountAgorot: e.amountAgorot,
        logDurationMs: e.logDurationMs,
        deleted: e.deletedAt !== null,
      }))
    const events = d.events.map<ExportEvent>((ev) => ({
      createdAt: ev.createdAt,
      memberName: nameOf(ev.memberId),
      name: ev.name,
      props: ev.props,
    }))
    return { expenses, events }
  }

  async resetDevice(): Promise<void> {
    try {
      this.storage?.removeItem(this.key)
    } catch {
      // Nothing else to clean up.
    }
    this.data = null
    if (this.seed) this.load()
  }
}
