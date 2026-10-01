// The real backend (SPEC sections 3 and 4): anonymous auth, one shared household per
// couple, row level security on the server, realtime updates between partners.

import type { PostgrestError, RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import type { CategoryId } from '../domain/categories.ts'
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
  JoinResult,
  Member,
  MemberColor,
  NewExpense,
  Session,
} from '../domain/types.ts'
import { RepoError, type Repo, type RepoErrorCode } from './repo.ts'
import { clearOffline, eventQueue, offlineCache, outbox, pendingExpense, type OutboxItem } from './offline.ts'
import { checkAmount, checkCycleDay, checkNewExpense, checkPatch, cleanName } from './validate.ts'

interface HouseholdRow {
  id: string
  budget_agorot: number
  cycle_start_day: number
  invite_code: string
  created_at: string
  updated_at: string
}

interface MemberRow {
  id: string
  household_id: string
  display_name: string
  color: MemberColor
  created_at: string
}

interface ExpenseRow {
  id: string
  household_id: string
  member_id: string
  amount_agorot: number
  category: CategoryId
  spent_on: string
  log_duration_ms: number | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

interface EventRow {
  member_id: string
  name: string
  props: Record<string, unknown> | null
  created_at: string
}

const toHousehold = (r: HouseholdRow): Household => ({
  id: r.id,
  budgetAgorot: r.budget_agorot,
  cycleStartDay: r.cycle_start_day,
  inviteCode: r.invite_code,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
})

const toMember = (r: MemberRow): Member => ({
  id: r.id,
  householdId: r.household_id,
  displayName: r.display_name,
  color: r.color,
  createdAt: r.created_at,
})

const toExpense = (r: ExpenseRow): Expense => ({
  id: r.id,
  householdId: r.household_id,
  memberId: r.member_id,
  amountAgorot: r.amount_agorot,
  category: r.category,
  spentOn: r.spent_on,
  logDurationMs: r.log_duration_ms,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  deletedAt: r.deleted_at,
})

const RPC_CODES: RepoErrorCode[] = ['already_member', 'code_not_found', 'household_full', 'personal_code_invalid', 'invalid_input']

/** Turns a Supabase error (or a thrown fetch error) into a RepoError the UI understands. */
function toRepoError(error: PostgrestError | Error | { message?: string; code?: string } | null): RepoError {
  const message = error?.message ?? ''
  const known = RPC_CODES.find((code) => message.includes(code))
  if (known) return new RepoError(known, message)
  if (/failed to fetch|network|load failed|fetch failed|timeout/i.test(message) || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    return new RepoError('network', message)
  }
  if ('code' in (error ?? {}) && (error as { code?: string }).code === '23514') return new RepoError('invalid_input', message)
  return new RepoError('server', message)
}

/** Events tracked before the household exists (app_open on the welcome screen) wait here. */
const MAX_PENDING_EVENTS = 20

/** Server answers that mean "never going to work" for a queued expense (checks, RLS, bad references). */
const PERMANENT_ERRORS = new Set(['23502', '23503', '23514', '22P02', '42501'])

const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false

const rangeKey = (range: { from: string; toExclusive: string }) => `${range.from}|${range.toExclusive}`

const byNewest = (a: Expense, b: Expense) =>
  a.spentOn === b.spentOn ? b.createdAt.localeCompare(a.createdAt) : b.spentOn.localeCompare(a.spentOn)

const rowFor = (item: OutboxItem) => ({
  id: item.input.id,
  household_id: item.householdId,
  member_id: item.memberId,
  amount_agorot: item.input.amountAgorot,
  category: item.input.category,
  spent_on: item.input.spentOn,
  log_duration_ms: item.input.logDurationMs,
})

export class SupabaseRepo implements Repo {
  private readonly sb: SupabaseClient
  private session: Session | null = null
  private channel: RealtimeChannel | null = null
  private channelHousehold: string | null = null
  private readonly listeners = new Set<() => void>()
  private pendingEvents: Array<{ name: string; props: Record<string, unknown>; at: string }> = []
  private notifyTimer: ReturnType<typeof setTimeout> | null = null
  private subscribedOnce = false
  private flushing: Promise<void> | null = null

  constructor(client: SupabaseClient) {
    this.sb = client
    // Back online: send what was saved offline.
    if (typeof window !== 'undefined') window.addEventListener('online', () => void this.flushOutbox())
  }

  // ---- helpers ----

  private require(): Session {
    if (!this.session) throw new RepoError('no_session')
    return this.session
  }

  /** Anonymous sign-in happens only when someone creates or joins, never just for visiting. */
  private async ensureSignedIn(): Promise<void> {
    const { data } = await this.sb.auth.getSession()
    if (data.session) return
    const { error } = await this.sb.auth.signInAnonymously()
    if (error) throw toRepoError(error)
  }

  private setSession(session: Session | null): void {
    this.session = session
    if (session) {
      this.ensureChannel()
      void this.flushPendingEvents()
      void this.flushOutbox()
    } else {
      this.dropChannel()
    }
  }

  private notify(): void {
    // Several row changes often arrive together; reload once.
    if (this.notifyTimer) clearTimeout(this.notifyTimer)
    this.notifyTimer = setTimeout(() => {
      this.notifyTimer = null
      for (const listener of this.listeners) listener()
    }, 60)
  }

  private ensureChannel(): void {
    const hid = this.session?.householdId
    if (!hid || this.listeners.size === 0 || this.channelHousehold === hid) return
    this.dropChannel()
    this.channelHousehold = hid
    this.subscribedOnce = false
    this.channel = this.sb
      .channel(`household-${hid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses', filter: `household_id=eq.${hid}` }, () => this.notify())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'households', filter: `id=eq.${hid}` }, () => this.notify())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members', filter: `household_id=eq.${hid}` }, () => this.notify())
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED') return
        // After a reconnect, reload to heal anything missed while disconnected.
        if (this.subscribedOnce) this.notify()
        this.subscribedOnce = true
      })
  }

  private dropChannel(): void {
    if (this.channel) void this.sb.removeChannel(this.channel)
    this.channel = null
    this.channelHousehold = null
  }

  private async flushPendingEvents(): Promise<void> {
    const session = this.session
    if (!session || this.pendingEvents.length === 0) return
    const batch = this.pendingEvents.splice(0)
    try {
      await this.sb.from('events').insert(
        batch.map((e) => ({
          household_id: session.householdId,
          member_id: session.memberId,
          name: e.name,
          props: { ...e.props, queued_at: e.at },
        })),
      )
    } catch {
      // Analytics must never break the app.
    }
  }

  /** Sends expenses and events saved offline. Safe to call any time; one flush runs at a time. */
  flushOutbox(): Promise<void> {
    if (this.flushing) return this.flushing
    this.flushing = (async () => {
      const hid = this.session?.householdId
      if (!hid || isOffline()) return
      let changed = false
      for (const item of outbox.all()) {
        if (item.householdId !== hid) continue
        let error: { code?: string; message?: string } | null = null
        try {
          error = (await this.sb.from('expenses').insert(rowFor(item))).error
        } catch (e) {
          error = { message: e instanceof Error ? e.message : 'network' }
        }
        // Stored now, or already stored by an earlier attempt whose answer got lost.
        if (!error || error.code === '23505') {
          outbox.remove(item.input.id)
          changed = true
          continue
        }
        if (error.code && PERMANENT_ERRORS.has(error.code)) {
          // The server will never take it (for example the date is now over a year old): drop it.
          outbox.remove(item.input.id)
          changed = true
          this.track('outbox_dropped', { reason: error.code })
          continue
        }
        break // Still offline or the server is unreachable: try again later, in order.
      }
      await this.flushQueuedEvents(hid)
      if (changed) this.notify()
    })().finally(() => {
      this.flushing = null
    })
    return this.flushing
  }

  private async flushQueuedEvents(hid: string): Promise<void> {
    const queued = eventQueue.all().filter((e) => e.householdId === hid)
    if (queued.length === 0) return
    try {
      const { error } = await this.sb.from('events').insert(
        queued.map((e) => ({ household_id: e.householdId, member_id: e.memberId, name: e.name, props: { ...e.props, queued_at: e.at } })),
      )
      if (!error) {
        const sent = new Set(queued.map((e) => `${e.at}|${e.name}`))
        eventQueue.save(eventQueue.all().filter((e) => !(e.householdId === hid && sent.has(`${e.at}|${e.name}`))))
      }
    } catch {
      // Try again on the next flush.
    }
  }

  /** The household this device was in, for opening the app without a connection. */
  private cachedSession(): Session | null {
    return offlineCache.get().session ?? null
  }

  // ---- Repo ----

  async getSession(): Promise<Session | null> {
    // Known offline: skip the network (the client retries reads with growing waits) and use this device's household.
    const offlineSession = isOffline() ? this.cachedSession() : null
    if (offlineSession) {
      this.setSession(offlineSession)
      return { ...offlineSession }
    }
    const { data, error: authError } = await this.sb.auth.getSession()
    if (!data.session) {
      // Offline with an expired token the session cannot be refreshed; keep using this device's household.
      const cached = this.cachedSession()
      if (cached && (authError || isOffline())) {
        this.setSession(cached)
        return { ...cached }
      }
      this.setSession(null)
      return null
    }
    const { data: rows, error } = await this.sb
      .from('members')
      .select('id, household_id')
      .eq('user_id', data.session.user.id)
      .limit(1)
    if (error) {
      const repoError = toRepoError(error)
      const cached = this.cachedSession()
      if (repoError.code === 'network' && cached) {
        this.setSession(cached)
        return { ...cached }
      }
      throw repoError
    }
    const row = rows?.[0] as { id: string; household_id: string } | undefined
    this.setSession(row ? { householdId: row.household_id, memberId: row.id } : null)
    offlineCache.update({ session: this.session ?? undefined })
    return this.session ? { ...this.session } : null
  }

  async createHousehold(input: CreateInput): Promise<CreateResult> {
    const displayName = cleanName(input.displayName)
    checkAmount(input.budgetAgorot)
    checkCycleDay(input.cycleStartDay)
    await this.ensureSignedIn()
    const { data, error } = await this.sb.rpc('create_household', {
      p_display_name: displayName,
      p_budget_agorot: input.budgetAgorot,
      p_cycle_start_day: input.cycleStartDay,
    })
    if (error) throw toRepoError(error)
    const result = data as { household_id: string; member_id: string; invite_code: string }
    this.setSession({ householdId: result.household_id, memberId: result.member_id })
    return { householdId: result.household_id, memberId: result.member_id, inviteCode: result.invite_code }
  }

  async joinHousehold(code: string, displayName: string, personalCode?: string): Promise<JoinResult> {
    // Taking a seat back needs no name: the seat keeps its own.
    const name = personalCode ? displayName.trim() : cleanName(displayName)
    await this.ensureSignedIn()
    const { data, error } = await this.sb.rpc('join_household', {
      p_code: code,
      p_display_name: name,
      p_personal_code: personalCode ?? null,
    })
    if (error) throw toRepoError(error)
    const result = data as { household_id: string; member_id: string }
    this.setSession({ householdId: result.household_id, memberId: result.member_id })
    return { householdId: result.household_id, memberId: result.member_id }
  }

  async getMyPersonalCode(): Promise<string | null> {
    const { memberId } = this.require()
    const { data, error } = await this.sb.from('member_secrets').select('personal_code').eq('member_id', memberId).maybeSingle()
    if (error) throw toRepoError(error)
    return (data as { personal_code: string } | null)?.personal_code ?? null
  }

  async getHousehold(): Promise<Household> {
    const { householdId } = this.require()
    if (isOffline()) {
      const cached = offlineCache.get().household
      if (cached?.id === householdId) return cached
      throw new RepoError('network')
    }
    const { data, error } = await this.sb.from('households').select('*').eq('id', householdId).single()
    if (error) {
      const repoError = toRepoError(error)
      const cached = offlineCache.get().household
      if (repoError.code === 'network' && cached?.id === householdId) return cached
      throw repoError
    }
    const household = toHousehold(data as HouseholdRow)
    offlineCache.update({ household })
    return household
  }

  async getMembers(): Promise<Member[]> {
    const { householdId } = this.require()
    const cachedMembers = () => {
      const cached = offlineCache.get().members
      return cached?.length && cached.every((m) => m.householdId === householdId) ? cached : null
    }
    if (isOffline()) {
      const cached = cachedMembers()
      if (cached) return cached
      throw new RepoError('network')
    }
    const { data, error } = await this.sb
      .from('members')
      .select('id, household_id, display_name, color, created_at')
      .eq('household_id', householdId)
      .order('created_at')
    if (error) {
      const repoError = toRepoError(error)
      const cached = cachedMembers()
      if (repoError.code === 'network' && cached) return cached
      throw repoError
    }
    const members = (data as MemberRow[]).map(toMember)
    offlineCache.update({ members })
    return members
  }

  async listExpenses(range: { from: string; toExclusive: string }): Promise<Expense[]> {
    const { householdId } = this.require()
    const cachedList = () => offlineCache.get().expenses?.[rangeKey(range)]?.filter((e) => e.householdId === householdId) ?? null
    let list: Expense[]
    if (isOffline()) {
      const cached = cachedList()
      if (!cached) throw new RepoError('network')
      list = cached
    } else {
      const { data, error } = await this.sb
        .from('expenses')
        .select('*')
        .eq('household_id', householdId)
        .is('deleted_at', null)
        .gte('spent_on', range.from)
        .lt('spent_on', range.toExclusive)
        .order('spent_on', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) {
        const repoError = toRepoError(error)
        const cached = cachedList()
        if (repoError.code !== 'network' || !cached) throw repoError
        list = cached
      } else {
        list = (data as ExpenseRow[]).map(toExpense)
        offlineCache.setExpenses(rangeKey(range), list)
      }
    }
    // Expenses saved offline show right away, marked as waiting.
    const waiting = outbox
      .all()
      .filter(
        (i) =>
          i.householdId === householdId &&
          i.input.spentOn >= range.from &&
          i.input.spentOn < range.toExclusive &&
          !list.some((e) => e.id === i.input.id),
      )
      .map(pendingExpense)
    return [...list, ...waiting].sort(byNewest)
  }

  async addExpense(input: NewExpense): Promise<Expense> {
    const session = this.require()
    checkNewExpense(input, todayInIsrael())
    const item: OutboxItem = {
      householdId: session.householdId,
      memberId: session.memberId,
      input,
      queuedAt: new Date().toISOString(),
    }
    // No connection: keep it on the phone and send it later (the client id makes the retry safe).
    const queue = () => {
      outbox.add(item)
      return pendingExpense(item)
    }
    if (isOffline()) return queue()
    let result
    try {
      result = await this.sb.from('expenses').insert(rowFor(item)).select('*').single()
    } catch {
      return queue()
    }
    const { data, error } = result
    if (error) {
      // Same client id already stored (a retry after a lost response): that is a success.
      if (error.code === '23505') {
        const existing = await this.sb.from('expenses').select('*').eq('id', input.id).single()
        if (!existing.error) return toExpense(existing.data as ExpenseRow)
      }
      const repoError = toRepoError(error)
      if (repoError.code === 'network') return queue()
      throw repoError
    }
    return toExpense(data as ExpenseRow)
  }

  async updateExpense(id: string, patch: ExpensePatch): Promise<Expense> {
    this.require()
    // Not on the server yet; the edit sheet blocks this, so it only guards the repo.
    if (outbox.has(id)) throw new RepoError('network')
    checkPatch(patch, todayInIsrael())
    const fields: Partial<Pick<ExpenseRow, 'amount_agorot' | 'category' | 'spent_on'>> = {}
    if (patch.amountAgorot !== undefined) fields.amount_agorot = patch.amountAgorot
    if (patch.category !== undefined) fields.category = patch.category
    if (patch.spentOn !== undefined) fields.spent_on = patch.spentOn
    const { data, error } = await this.sb.from('expenses').update(fields).eq('id', id).is('deleted_at', null).select('*')
    if (error) throw toRepoError(error)
    const row = (data as ExpenseRow[])[0]
    if (!row) throw new RepoError('not_found')
    return toExpense(row)
  }

  async deleteExpense(id: string): Promise<void> {
    this.require()
    // Still waiting to be sent (for example an undo right after an offline save): just drop it.
    if (outbox.remove(id)) return
    const { data, error } = await this.sb
      .from('expenses')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .is('deleted_at', null)
      .select('id')
    if (error) throw toRepoError(error)
    if ((data as unknown[]).length === 0) {
      // Already deleted (for example by the partner a moment ago) counts as done.
      const { data: exists } = await this.sb.from('expenses').select('id').eq('id', id)
      if (!exists || exists.length === 0) throw new RepoError('not_found')
    }
  }

  async restoreExpense(id: string): Promise<void> {
    this.require()
    const { data, error } = await this.sb.from('expenses').update({ deleted_at: null }).eq('id', id).select('id')
    if (error) throw toRepoError(error)
    if ((data as unknown[]).length === 0) throw new RepoError('not_found')
  }

  async updateHousehold(patch: HouseholdPatch): Promise<Household> {
    const { householdId } = this.require()
    const fields: Partial<Pick<HouseholdRow, 'budget_agorot' | 'cycle_start_day'>> = {}
    if (patch.budgetAgorot !== undefined) {
      checkAmount(patch.budgetAgorot)
      fields.budget_agorot = patch.budgetAgorot
    }
    if (patch.cycleStartDay !== undefined) {
      checkCycleDay(patch.cycleStartDay)
      fields.cycle_start_day = patch.cycleStartDay
    }
    const { data, error } = await this.sb.from('households').update(fields).eq('id', householdId).select('*').single()
    if (error) throw toRepoError(error)
    return toHousehold(data as HouseholdRow)
  }

  async updateMyName(name: string): Promise<void> {
    const { memberId } = this.require()
    const displayName = cleanName(name)
    const { error } = await this.sb.from('members').update({ display_name: displayName }).eq('id', memberId)
    if (error) throw toRepoError(error)
  }

  subscribe(onChange: () => void): () => void {
    this.listeners.add(onChange)
    this.ensureChannel()
    return () => {
      this.listeners.delete(onChange)
      if (this.listeners.size === 0) this.dropChannel()
    }
  }

  track(name: string, props: Record<string, unknown> = {}): void {
    const session = this.session
    const at = new Date().toISOString()
    if (!session) {
      if (this.pendingEvents.length < MAX_PENDING_EVENTS) this.pendingEvents.push({ name, props, at })
      return
    }
    // Offline events wait with the expenses, so offline logging times are not lost.
    const queue = () => eventQueue.add({ householdId: session.householdId, memberId: session.memberId, name, props, at })
    if (isOffline()) {
      queue()
      return
    }
    // Fire and forget: never block the UI, never throw.
    void (async () => {
      try {
        const { error } = await this.sb
          .from('events')
          .insert({ household_id: session.householdId, member_id: session.memberId, name, props })
        if (error && toRepoError(error).code === 'network') queue()
      } catch {
        queue()
      }
    })()
  }

  async exportData(): Promise<{ expenses: ExportExpense[]; events: ExportEvent[] }> {
    const { householdId } = this.require()
    const [members, expenses, events] = await Promise.all([
      this.sb.from('members').select('id, display_name').eq('household_id', householdId),
      this.sb
        .from('expenses')
        .select('*')
        .eq('household_id', householdId)
        .order('spent_on')
        .order('created_at'),
      this.sb
        .from('events')
        .select('member_id, name, props, created_at')
        .eq('household_id', householdId)
        .order('id'),
    ])
    for (const result of [members, expenses, events]) if (result.error) throw toRepoError(result.error)
    const names = new Map((members.data as Array<{ id: string; display_name: string }>).map((m) => [m.id, m.display_name]))
    return {
      expenses: (expenses.data as ExpenseRow[]).map((e) => ({
        id: e.id,
        spentOn: e.spent_on,
        createdAt: e.created_at,
        memberName: names.get(e.member_id) ?? '',
        category: e.category,
        amountAgorot: e.amount_agorot,
        logDurationMs: e.log_duration_ms,
        deleted: e.deleted_at !== null,
      })),
      events: (events.data as EventRow[]).map((e) => ({
        createdAt: e.created_at,
        memberName: names.get(e.member_id) ?? '',
        name: e.name,
        props: e.props ?? {},
      })),
    }
  }

  async resetDevice(): Promise<void> {
    this.setSession(null)
    this.pendingEvents = []
    clearOffline()
    // Ends this device's anonymous user; the invite code is the way back.
    await this.sb.auth.signOut({ scope: 'local' })
  }
}
