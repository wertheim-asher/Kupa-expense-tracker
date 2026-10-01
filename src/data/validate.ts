// Input rules shared by every repo, so the UI can never store bad data.

import { LIMITS } from '../config.ts'
import { isCategoryId } from '../domain/categories.ts'
import { addDays, isValidIsoDate, isValidStartDay } from '../domain/cycle.ts'
import { isValidAmount } from '../domain/money.ts'
import type { ExpensePatch, IsoDate, NewExpense } from '../domain/types.ts'
import { RepoError } from './repo.ts'

export function cleanName(name: string): string {
  const trimmed = name.trim()
  if (trimmed.length < 1 || trimmed.length > LIMITS.maxNameLength) {
    throw new RepoError('invalid_input', 'Name must be 1 to 30 characters')
  }
  return trimmed
}

export function checkAmount(agorot: number): void {
  if (!isValidAmount(agorot)) throw new RepoError('invalid_input', 'Amount must be above 0 and at most ₪100,000')
}

export function checkCycleDay(day: number): void {
  if (!isValidStartDay(day)) throw new RepoError('invalid_input', 'Cycle start day must be 1 to 28')
}

/** No future dates, nothing older than 365 days. */
export function isAllowedSpentOn(date: IsoDate, today: IsoDate): boolean {
  return isValidIsoDate(date) && date <= today && date >= addDays(today, -LIMITS.maxPastDays)
}

export function checkSpentOn(date: IsoDate, today: IsoDate): void {
  if (!isAllowedSpentOn(date, today)) throw new RepoError('invalid_input', 'Date must be within the last year and not in the future')
}

export function checkNewExpense(input: NewExpense, today: IsoDate): void {
  if (!input.id) throw new RepoError('invalid_input', 'Missing id')
  checkAmount(input.amountAgorot)
  if (!isCategoryId(input.category)) throw new RepoError('invalid_input', 'Unknown category')
  checkSpentOn(input.spentOn, today)
  if (input.logDurationMs !== null && !(Number.isInteger(input.logDurationMs) && input.logDurationMs >= 0)) {
    throw new RepoError('invalid_input', 'Bad duration')
  }
}

export function checkPatch(patch: ExpensePatch, today: IsoDate): void {
  if (patch.amountAgorot !== undefined) checkAmount(patch.amountAgorot)
  if (patch.category !== undefined && !isCategoryId(patch.category)) throw new RepoError('invalid_input', 'Unknown category')
  if (patch.spentOn !== undefined) checkSpentOn(patch.spentOn, today)
}
