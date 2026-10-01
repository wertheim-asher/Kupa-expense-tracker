// Offline support for the shared backend (SPEC section 4, offline outbox): expenses saved
// without a connection wait here and are sent when it returns; the last data seen is kept
// so the app opens offline. Everything lives in localStorage and never throws.

import { APP } from '../config.ts'
import type { Expense, Household, Member, NewExpense, Session } from '../domain/types.ts'

export interface OutboxItem {
  householdId: string
  memberId: string
  input: NewExpense
  queuedAt: string
}

export interface QueuedEvent {
  householdId: string
  memberId: string
  name: string
  props: Record<string, unknown>
  at: string
}

export interface OfflineCache {
  session?: Session
  household?: Household
  members?: Member[]
  /** Expense lists by "from|toExclusive". */
  expenses?: Record<string, Expense[]>
}

const OUTBOX_KEY = `${APP.slug}.outbox.v1`
const EVENTS_KEY = `${APP.slug}.events-outbox.v1`
const CACHE_KEY = `${APP.slug}.cache.v1`
const MAX_QUEUED_EVENTS = 300

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage full or blocked: offline support degrades, the app keeps working online.
  }
}

export const outbox = {
  all: (): OutboxItem[] => read<OutboxItem[]>(OUTBOX_KEY, []),
  save: (items: OutboxItem[]) => write(OUTBOX_KEY, items),
  add(item: OutboxItem): void {
    const items = outbox.all().filter((i) => i.input.id !== item.input.id)
    outbox.save([...items, item])
  },
  remove(id: string): boolean {
    const items = outbox.all()
    const rest = items.filter((i) => i.input.id !== id)
    if (rest.length === items.length) return false
    outbox.save(rest)
    return true
  },
  has: (id: string): boolean => outbox.all().some((i) => i.input.id === id),
}

export const eventQueue = {
  all: (): QueuedEvent[] => read<QueuedEvent[]>(EVENTS_KEY, []),
  save: (items: QueuedEvent[]) => write(EVENTS_KEY, items.slice(-MAX_QUEUED_EVENTS)),
  add: (event: QueuedEvent) => eventQueue.save([...eventQueue.all(), event]),
}

export const offlineCache = {
  get: (): OfflineCache => read<OfflineCache>(CACHE_KEY, {}),
  update(patch: Partial<OfflineCache>): void {
    write(CACHE_KEY, { ...offlineCache.get(), ...patch })
  },
  setExpenses(rangeKey: string, list: Expense[]): void {
    // Keep only the most recent few ranges (current cycle, maybe the previous one).
    const current = offlineCache.get().expenses ?? {}
    const next = Object.fromEntries([...Object.entries(current).filter(([k]) => k !== rangeKey).slice(-2), [rangeKey, list]])
    offlineCache.update({ expenses: next })
  },
}

export function clearOffline(): void {
  for (const key of [OUTBOX_KEY, EVENTS_KEY, CACHE_KEY]) {
    try {
      localStorage.removeItem(key)
    } catch {
      // Nothing to clean.
    }
  }
}

/** Builds the expense shown while it waits in the outbox. */
export function pendingExpense(item: OutboxItem): Expense {
  return {
    id: item.input.id,
    householdId: item.householdId,
    memberId: item.memberId,
    amountAgorot: item.input.amountAgorot,
    category: item.input.category,
    spentOn: item.input.spentOn,
    logDurationMs: item.input.logDurationMs,
    createdAt: item.queuedAt,
    updatedAt: item.queuedAt,
    deletedAt: null,
    pending: true,
  }
}
