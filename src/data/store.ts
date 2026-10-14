// Shape of everything a local repo keeps in one localStorage entry.

import type { AppEvent, Expense, Household, IsoDate, Member, Session } from '../domain/types.ts'
import type { Lang } from '../i18n/lang.ts'

export interface StoreData {
  version: 1
  /** A seeded store (the demo): the day and the language the seed was built in (the members' names).
   *  It starts again the next day, or in the other language. */
  seededOn?: IsoDate
  seededLang?: Lang
  session: Session | null
  household: Household | null
  members: Member[]
  expenses: Expense[]
  events: AppEvent[]
  nextEventId: number
}

export function emptyStore(): StoreData {
  return { version: 1, session: null, household: null, members: [], expenses: [], events: [], nextEventId: 1 }
}

export function isStoreData(value: unknown): value is StoreData {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Partial<StoreData>
  return (
    v.version === 1 &&
    Array.isArray(v.members) &&
    Array.isArray(v.expenses) &&
    Array.isArray(v.events) &&
    typeof v.nextEventId === 'number'
  )
}
