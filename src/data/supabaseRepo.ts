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

const RPC_CODES: RepoErrorCode[] = ['already_member', 'code_not_found', 'household_full', 'invalid_input']

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

export class SupabaseRepo implements Repo {
  private readonly sb: SupabaseClient
  private session: Session | null = null
  private channel: RealtimeChannel | null = null
  private channelHousehold: string | null = null
  private readonly listeners = new Set<() => void>()
  private pendingEvents: Array<{ name: string; props: Record<string, unknown>; at: string }> = []
  private notifyTimer: ReturnType<typeof setTimeout> | null = null
  private subscribedOnce = false

  constructor(client: SupabaseClient) {
    this.sb = client
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

  // ---- Repo ----

  async getSession(): Promise<Session | null> {
    const { data } = await this.sb.auth.getSession()
    if (!data.session) {
      this.setSession(null)
      return null
    }
    const { data: rows, error } = await this.sb
      .from('members')
      .select('id, household_id')
      .eq('user_id', data.session.user.id)
      .limit(1)
    if (error) throw toRepoError(error)
    const row = rows?.[0] as { id: string; household_id: string } | undefined
    this.setSession(row ? { householdId: row.household_id, memberId: row.id } : null)
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

  async joinHousehold(code: string, displayName: string): Promise<JoinResult> {
    const name = cleanName(displayName)
    await this.ensureSignedIn()
    const { data, error } = await this.sb.rpc('join_household', { p_code: code, p_display_name: name })
    if (error) throw toRepoError(error)
    const result = data as { household_id: string; member_id: string }
    this.setSession({ householdId: result.household_id, memberId: result.member_id })
    return { householdId: result.household_id, memberId: result.member_id }
  }

  async getHousehold(): Promise<Household> {
    const { householdId } = this.require()
    const { data, error } = await this.sb.from('households').select('*').eq('id', householdId).single()
    if (error) throw toRepoError(error)
    return toHousehold(data as HouseholdRow)
  }

  async getMembers(): Promise<Member[]> {
    const { householdId } = this.require()
    const { data, error } = await this.sb
      .from('members')
      .select('id, household_id, display_name, color, created_at')
      .eq('household_id', householdId)
      .order('created_at')
    if (error) throw toRepoError(error)
    return (data as MemberRow[]).map(toMember)
  }

  async listExpenses(range: { from: string; toExclusive: string }): Promise<Expense[]> {
    const { householdId } = this.require()
    const { data, error } = await this.sb
      .from('expenses')
      .select('*')
      .eq('household_id', householdId)
      .is('deleted_at', null)
      .gte('spent_on', range.from)
      .lt('spent_on', range.toExclusive)
      .order('spent_on', { ascending: false })
      .order('created_at', { ascending: false })
    if (error) throw toRepoError(error)
    return (data as ExpenseRow[]).map(toExpense)
  }

  async addExpense(input: NewExpense): Promise<Expense> {
    const session = this.require()
    checkNewExpense(input, todayInIsrael())
    const { data, error } = await this.sb
      .from('expenses')
      .insert({
        id: input.id,
        household_id: session.householdId,
        member_id: session.memberId,
        amount_agorot: input.amountAgorot,
        category: input.category,
        spent_on: input.spentOn,
        log_duration_ms: input.logDurationMs,
      })
      .select('*')
      .single()
    if (error) {
      // Same client id already stored (a retry after a lost response): that is a success.
      if (error.code === '23505') {
        const existing = await this.sb.from('expenses').select('*').eq('id', input.id).single()
        if (!existing.error) return toExpense(existing.data as ExpenseRow)
      }
      throw toRepoError(error)
    }
    return toExpense(data as ExpenseRow)
  }

  async updateExpense(id: string, patch: ExpensePatch): Promise<Expense> {
    this.require()
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
    if (!session) {
      if (this.pendingEvents.length < MAX_PENDING_EVENTS) {
        this.pendingEvents.push({ name, props, at: new Date().toISOString() })
      }
      return
    }
    // Fire and forget: never block the UI, never throw.
    void Promise.resolve(
      this.sb.from('events').insert({ household_id: session.householdId, member_id: session.memberId, name, props }),
    ).catch(() => undefined)
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
    // Ends this device's anonymous user; the invite code is the way back.
    await this.sb.auth.signOut({ scope: 'local' })
  }
}
