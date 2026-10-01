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

export interface Repo {
  getSession(): Promise<Session | null>
  createHousehold(input: CreateInput): Promise<CreateResult>
  joinHousehold(code: string, displayName: string): Promise<JoinResult>
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

export class RepoError extends Error {
  readonly code: RepoErrorCode

  constructor(code: RepoErrorCode, message?: string) {
    super(message ?? code)
    this.name = 'RepoError'
    this.code = code
  }
}
