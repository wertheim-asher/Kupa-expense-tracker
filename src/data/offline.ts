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
  /** The login `session` was looked up for: the next open can use that seat at once and check it alongside. */
  sessionUserId?: string
  household?: Household
  members?: Member[]
  /** Expense lists by "from|toExclusive". */
  expenses?: Record<string, Expense[]>
  /** This member's personal code (null: the server has none), for the disconnect warning offline. */
  personalCode?: { memberId: string; code: string | null }
}

const OUTBOX_KEY = `${APP.slug}.outbox.v1`
const EVENTS_KEY = `${APP.slug}.events-outbox.v1`
const CACHE_KEY = `${APP.slug}.cache.v1`
const TOMBSTONES_KEY = `${APP.slug}.tombstones.v1`
const MAX_QUEUED_EVENTS = 300

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

/** False when storage is full or blocked (the caller decides whether that matters). */
function write(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export const outbox = {
  all: (): OutboxItem[] => read<OutboxItem[]>(OUTBOX_KEY, []),
  save: (items: OutboxItem[]) => write(OUTBOX_KEY, items),
  /** False if it could not be stored: the expense would be lost, so the caller must not report "saved". */
  add(item: OutboxItem): boolean {
    const items = outbox.all().filter((i) => i.input.id !== item.input.id)
    return outbox.save([...items, item]) && outbox.has(item.input.id)
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
  /** Takes this household's events out of the queue before sending, so a second tab cannot send them too. */
  take(householdId: string): QueuedEvent[] {
    const all = eventQueue.all()
    const mine = all.filter((e) => e.householdId === householdId)
    if (mine.length > 0) eventQueue.save(all.filter((e) => e.householdId !== householdId))
    return mine
  },
  /** Puts events back after a failed send. */
  putBack: (events: QueuedEvent[]) => eventQueue.save([...events, ...eventQueue.all()]),
}

/** Expenses undone or deleted while their insert may already be on the server: deleted there on the next flush. */
export const tombstones = {
  all: (): Array<{ householdId: string; id: string }> => read(TOMBSTONES_KEY, []),
  add(householdId: string, id: string): void {
    write(TOMBSTONES_KEY, [...tombstones.all().filter((t) => t.id !== id), { householdId, id }])
  },
  remove(id: string): void {
    write(TOMBSTONES_KEY, tombstones.all().filter((t) => t.id !== id))
  },
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
  /**
   * Expenses in the range from any cached list (deduped), for a range that was never loaded
   * online, such as the first day of a new cycle opened offline.
   */
  expensesInRange(householdId: string, from: string, toExclusive: string): Expense[] {
    const byId = new Map<string, Expense>()
    for (const list of Object.values(offlineCache.get().expenses ?? {})) {
      for (const e of list) {
        if (e.householdId === householdId && e.spentOn >= from && e.spentOn < toExclusive) byId.set(e.id, e)
      }
    }
    return [...byId.values()]
  },
  /** Keeps the cache in step with a successful write, so an offline reload right after shows it. */
  putExpense(expense: Expense): void {
    const lists = offlineCache.get().expenses
    if (!lists) return
    const stored = { ...expense, pending: undefined }
    const next = Object.fromEntries(
      Object.entries(lists).map(([key, list]) => {
        const [from, toExclusive] = key.split('|')
        const rest = list.filter((e) => e.id !== expense.id)
        const belongs = expense.deletedAt === null && expense.spentOn >= from && expense.spentOn < toExclusive
        return [key, belongs ? [stored, ...rest] : rest]
      }),
    )
    offlineCache.update({ expenses: next })
  },
  dropExpense(id: string): void {
    const lists = offlineCache.get().expenses
    if (!lists) return
    offlineCache.update({ expenses: Object.fromEntries(Object.entries(lists).map(([k, list]) => [k, list.filter((e) => e.id !== id)])) })
  },
}

export function clearOffline(): void {
  for (const key of [OUTBOX_KEY, EVENTS_KEY, CACHE_KEY, TOMBSTONES_KEY]) {
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
