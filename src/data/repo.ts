// The one data interface the UI talks to (SPEC section 4).

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
  NewExpense,
  Session,
} from '../domain/types.ts'

/** What this device showed last time, to open on at once while the first load refreshes it. */
export interface CachedHome {
  session: Session
  household: Household
  members: Member[]
  expenses: Expense[]
}

export interface Repo {
  getSession(): Promise<Session | null>
  createHousehold(input: CreateInput): Promise<CreateResult>
  /**
   * With a personal code, takes back that member's own seat (new device) instead of joining as someone
   * new. The personal code alone is enough: the app then passes an empty invite code and name.
   */
  joinHousehold(code: string, displayName: string, personalCode?: string): Promise<JoinResult>
  /** This member's private personal code (shared backend only; null on device-only storage). */
  getMyPersonalCode(): Promise<string | null>
  /** The household as last seen on this device, without asking the server (shared backend only). */
  peekHousehold?(): Household | null
  /** This member's personal code as last seen on this device (undefined: not known here). */
  peekPersonalCode?(): string | null | undefined
  /** The home this device showed last time for the cycle `rangeFor` gives, or null (shared backend only). */
  peekCached?(rangeFor: (household: Household) => { from: string; toExclusive: string }): CachedHome | null
  /**
   * False, once, when the seat used at open turned out to be taken back or moved (the server said so
   * after reads for it had started); the caller then loads again. True otherwise.
   */
  seatConfirmed?(): Promise<boolean>
  /** Demo only: the partner logs ₪84 groceries, arriving like a partner's expense does with sync. */
  simulatePartnerExpense?(): Promise<void>
  getHousehold(): Promise<Household>
  getMembers(): Promise<Member[]>
  /** Non-deleted expenses with from <= spentOn < toExclusive (ISO dates). */
  listExpenses(range: { from: string; toExclusive: string }): Promise<Expense[]>
  /** Idempotent: adding an id that already exists returns the stored expense. */
  addExpense(input: NewExpense): Promise<Expense>
  updateExpense(id: string, patch: ExpensePatch): Promise<Expense>
  /** Soft delete. */
  deleteExpense(id: string): Promise<void>
  restoreExpense(id: string): Promise<void>
  updateHousehold(patch: HouseholdPatch): Promise<Household>
  updateMyName(name: string): Promise<void>
  /** Called when data changes outside this tab's own calls. Returns unsubscribe. */
  subscribe(onChange: () => void): () => void
  /** Fire and forget. Never throws. */
  track(name: string, props?: Record<string, unknown>): void
  exportData(): Promise<{ expenses: ExportExpense[]; events: ExportEvent[] }>
  resetDevice(): Promise<void>
}

export type RepoErrorCode =
  | 'no_session'
  | 'already_member'
  | 'invalid_input'
  | 'not_found'
  | 'unsupported'
  | 'storage_failed'
  | 'code_not_found'
  | 'household_full'
  | 'personal_code_invalid'
  /** No connection, or the server could not be reached. */
  | 'network'
  /** Anything else the server reported. */
  | 'server'

export class RepoError extends Error {
  readonly code: RepoErrorCode

  constructor(code: RepoErrorCode, message?: string) {
    super(message ?? code)
    this.name = 'RepoError'
    this.code = code
  }
}
