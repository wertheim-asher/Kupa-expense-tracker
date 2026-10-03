// The real backend (SPEC sections 3 and 4): anonymous auth, one shared household per
// couple, row level security on the server, realtime updates between partners.

import { isAuthRetryableFetchError, type PostgrestError, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js'
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
import { APP } from '../config.ts'
import { RepoError, type Repo, type RepoErrorCode } from './repo.ts'
import { clearOffline, eventQueue, offlineCache, outbox, pendingExpense, tombstones, type OutboxItem } from './offline.ts'
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

/**
 * Server answers that mean "never going to work" for a queued expense (bad values, bad references).
 * Not 42501 (permission): after a long time offline the login may not be refreshed yet, and the
 * request goes out without it; that must be retried, never dropped.
 */
const PERMANENT_ERRORS = new Set(['23502', '23503', '23514', '22P02'])

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
  /** The login the session was looked up for; while it stays the same, refreshes skip that lookup. */
  private sessionUserId: string | null = null
  private channel: RealtimeChannel | null = null
  private channelHousehold: string | null = null
  private readonly listeners = new Set<() => void>()
  private pendingEvents: Array<{ name: string; props: Record<string, unknown>; at: string }> = []
  private notifyTimer: ReturnType<typeof setTimeout> | null = null
  private subscribedOnce = false
  /** The server's check of the seat this page opened with (see getSession). */
  private seatCheck: Promise<boolean> | null = null
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

  private setSession(session: Session | null, userId: string | null = null): void {
    this.session = session
    this.sessionUserId = session ? userId : null
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
      // Only send with a valid login (refreshed if needed); otherwise the request would go out
      // anonymous and be refused. Try again on the next trigger.
      const { data: auth } = await this.sb.auth.getSession()
      if (!auth.session) return
      let changed = false
      for (const item of outbox.all()) {
        if (item.householdId !== hid) continue
        // Undone since this flush started: nothing to send.
        if (!outbox.has(item.input.id)) continue
        let error: { code?: string; message?: string } | null = null
        try {
          error = (await this.sb.from('expenses').insert(rowFor(item))).error
        } catch (e) {
          error = { message: e instanceof Error ? e.message : 'network' }
        }
        // Stored now, or already stored by an earlier attempt whose answer got lost.
        if (!error || error.code === '23505') {
          if (outbox.remove(item.input.id)) {
            offlineCache.putExpense({ ...pendingExpense(item), pending: undefined })
          } else {
            // Undone while it was being sent: delete it on the server too.
            tombstones.add(hid, item.input.id)
          }
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
        break // Still offline, server unreachable, or the login is not ready: try again later, in order.
      }
      changed = (await this.flushTombstones(hid)) || changed
      await this.flushQueuedEvents(hid)
      if (changed) this.notify()
    })().finally(() => {
      this.flushing = null
    })
    return this.flushing
  }

  /** Soft-deletes on the server what was undone while its insert may already have landed. True if any ran. */
  private async flushTombstones(hid: string): Promise<boolean> {
    let ran = false
    for (const t of tombstones.all()) {
      if (t.householdId !== hid) continue
      try {
        const { error } = await this.sb
          .from('expenses')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', t.id)
          .is('deleted_at', null)
        if (error && toRepoError(error).code === 'network') break
      } catch {
        break
      }
      // Done, already deleted, or never stored: either way nothing is left to do.
      tombstones.remove(t.id)
      ran = true
    }
    return ran
  }

  private async flushQueuedEvents(hid: string): Promise<void> {
    // Take them out first, so another tab flushing at the same time cannot send them too.
    const queued = eventQueue.take(hid)
    if (queued.length === 0) return
    try {
      const { error } = await this.sb.from('events').insert(
        queued.map((e) => ({ household_id: e.householdId, member_id: e.memberId, name: e.name, props: { ...e.props, queued_at: e.at } })),
      )
      if (error) eventQueue.putBack(queued)
    } catch {
      eventQueue.putBack(queued)
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
    // Already looked up for this login (a refresh after a save, a partner's change, a return to the
    // app): skip the round trip to the server, so the screen updates sooner.
    if (data.session && this.session && this.sessionUserId === data.session.user.id) {
      this.setSession(this.session, this.sessionUserId) // Still sends anything saved offline, as before.
      return { ...this.session }
    }
    // Opening the app with the login this device saw last time: use the seat it had, and check it with
    // the server alongside the first reads instead of before them (one round trip less on every open).
    const cache = offlineCache.get()
    if (data.session && !this.session && cache.session && cache.sessionUserId === data.session.user.id) {
      const guess = cache.session
      this.setSession(guess, data.session.user.id)
      this.seatCheck = this.checkSeat(data.session.user.id, guess)
      return { ...guess }
    }
    if (!data.session) {
      // Offline (or the server unreachable) with an expired token the session cannot be refreshed;
      // keep using this device's household. Any other auth error means the login is really gone.
      const cached = this.cachedSession()
      if (cached && (isOffline() || isAuthRetryableFetchError(authError))) {
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
    this.setSession(row ? { householdId: row.household_id, memberId: row.id } : null, data.session.user.id)
    offlineCache.update({ session: this.session ?? undefined, sessionUserId: this.session ? data.session.user.id : undefined })
    return this.session ? { ...this.session } : null
  }

  /** The server's answer for the seat used at open: true when it is still this login's seat (or no answer). */
  private async checkSeat(userId: string, guess: Session): Promise<boolean> {
    try {
      const { data: rows, error } = await this.sb.from('members').select('id, household_id').eq('user_id', userId).limit(1)
      // No answer (offline, server down): keep the seat, as an offline open does, but ask again on the next load.
      if (error) return this.unconfirmed(guess)
      const row = rows?.[0] as { id: string; household_id: string } | undefined
      if (row && row.id === guess.memberId && row.household_id === guess.householdId) return true
      // Something else changed the session meanwhile (a join, a disconnect): that one stands.
      if (this.session !== guess) return true
      // Taken back on another device (or moved): follow the server, and reload whoever listens.
      const next = row ? { householdId: row.household_id, memberId: row.id } : null
      this.setSession(next, userId)
      offlineCache.update({ session: next ?? undefined, sessionUserId: next ? userId : undefined })
      this.notify()
      return false
    } catch {
      return this.unconfirmed(guess)
    }
  }

  /** The seat could not be checked: keep it, and forget the login, so the next getSession looks it up. */
  private unconfirmed(guess: Session): true {
    if (this.session === guess) this.sessionUserId = null
    return true
  }

  async seatConfirmed(): Promise<boolean> {
    const check = this.seatCheck
    if (!check) return true
    const ok = await check
    // A wrong seat is reported once, so a caller that loads again cannot loop on it.
    if (!ok && this.seatCheck === check) this.seatCheck = null
    return ok
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
    // A rejoin changed this seat's personal code: never show the old one from the cache.
    offlineCache.update({ personalCode: undefined })
    const result = data as { household_id: string; member_id: string }
    this.setSession({ householdId: result.household_id, memberId: result.member_id })
    return { householdId: result.household_id, memberId: result.member_id }
  }

  peekHousehold(): Household | null {
    return offlineCache.get().household ?? null
  }

  async getMyPersonalCode(): Promise<string | null> {
    const { memberId } = this.require()
    // Kept on this device too: the disconnect warning must show it even offline, or the way back is lost.
    const cached = () => {
      const entry = offlineCache.get().personalCode
      if (entry?.memberId === memberId) return entry.code
      throw new RepoError('network')
    }
    if (isOffline()) return cached()
    const { data, error } = await this.sb.from('member_secrets').select('personal_code').eq('member_id', memberId).maybeSingle()
    if (error) {
      const repoError = toRepoError(error)
      if (repoError.code === 'network') return cached()
      throw repoError
    }
    const code = (data as { personal_code: string } | null)?.personal_code ?? null
    offlineCache.update({ personalCode: { memberId, code } })
    return code
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
    // The exact range if it was loaded before; otherwise what the cache has for those dates (for
    // example the first day of a new cycle opened offline), so offline saves always show.
    const cachedList = () =>
      offlineCache.get().expenses?.[rangeKey(range)]?.filter((e) => e.householdId === householdId) ??
      offlineCache.expensesInRange(householdId, range.from, range.toExclusive)
    let list: Expense[]
    if (isOffline()) {
      list = cachedList()
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
        if (repoError.code !== 'network') throw repoError
        list = cachedList()
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
      // Storage full or blocked: say so ("Couldn't save. Try again?") instead of a false "saved".
      if (!outbox.add(item)) throw new RepoError('storage_failed')
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
    const saved = toExpense(data as ExpenseRow)
    offlineCache.putExpense(saved)
    return saved
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
    const updated = toExpense(row)
    offlineCache.putExpense(updated)
    return updated
  }

  async deleteExpense(id: string): Promise<void> {
    this.require()
    // Still waiting to be sent (for example an undo right after an offline save). Its insert may
    // already have reached the server without an answer, or be in flight right now, so the
    // server copy is deleted too: right away when online, otherwise on the next flush.
    if (outbox.remove(id)) {
      const hid = this.require().householdId
      tombstones.add(hid, id)
      if (!isOffline()) await this.flushTombstones(hid)
      return
    }
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
    offlineCache.dropExpense(id)
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
    // Expenses saved offline and not sent yet would be lost: send them first, or refuse.
    const hid = this.session?.householdId
    const unsent = () => outbox.all().some((i) => i.householdId === hid)
    if (hid && unsent()) {
      await this.flushOutbox()
      if (unsent()) throw new RepoError('network')
    }
    // Ends this device's anonymous user; the invite code (and personal code) are the way back.
    const { error } = await this.sb.auth.signOut({ scope: 'local' })
    if (error) {
      // Offline with an expired login the library may keep the stored session; remove it ourselves,
      // or the device would quietly reconnect to the budget the next time it is online.
      try {
        localStorage.removeItem(`${APP.slug}.auth`)
      } catch {
        // Nothing stored.
      }
    }
    this.setSession(null)
    this.pendingEvents = []
    clearOffline()
  }
}
