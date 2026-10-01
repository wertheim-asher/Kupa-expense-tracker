import type { CategoryId } from './categories.ts'

/** Local Israel date, YYYY-MM-DD. */
export type IsoDate = string

export type MemberColor = 'teal' | 'violet'

export interface Session {
  householdId: string
  memberId: string
}

export interface Household {
  id: string
  budgetAgorot: number
  cycleStartDay: number
  inviteCode: string
  createdAt: string
  updatedAt: string
}

export interface Member {
  id: string
  householdId: string
  displayName: string
  color: MemberColor
  createdAt: string
}

export interface Expense {
  id: string
  householdId: string
  memberId: string
  amountAgorot: number
  category: CategoryId
  spentOn: IsoDate
  logDurationMs: number | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface CreateInput {
  displayName: string
  budgetAgorot: number
  cycleStartDay: number
}

export interface CreateResult {
  householdId: string
  memberId: string
  inviteCode: string
}

export interface JoinResult {
  householdId: string
  memberId: string
}

export interface NewExpense {
  /** Generated on the client, so a retry never creates a duplicate. */
  id: string
  amountAgorot: number
  category: CategoryId
  spentOn: IsoDate
  logDurationMs: number | null
}

export interface ExpensePatch {
  amountAgorot?: number
  category?: CategoryId
  spentOn?: IsoDate
}

export interface HouseholdPatch {
  budgetAgorot?: number
  cycleStartDay?: number
}

export interface AppEvent {
  id: number
  householdId: string | null
  memberId: string | null
  name: string
  props: Record<string, unknown>
  createdAt: string
}

export interface ExportExpense {
  id: string
  spentOn: IsoDate
  createdAt: string
  memberName: string
  category: CategoryId
  amountAgorot: number
  logDurationMs: number | null
  deleted: boolean
}

export interface ExportEvent {
  createdAt: string
  memberName: string
  name: string
  props: Record<string, unknown>
}
