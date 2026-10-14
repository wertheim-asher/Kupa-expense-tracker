import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { TIMING } from '../config.ts'
import { cycleFor, shiftCycle, todayInIsrael, type Cycle } from '../domain/cycle.ts'
import type { Expense, Household, IsoDate, Member, Session } from '../domain/types.ts'
import type { Mode } from '../data/mode.ts'
import type { Repo } from '../data/repo.ts'
import { isStandalone } from '../analytics/track.ts'
import { LANG } from '../i18n/index.ts'
import { useMode } from './ModeContext.tsx'

type Status = 'loading' | 'no-session' | 'ready' | 'error'

export interface Snapshot {
  status: Status
  today: IsoDate
  session: Session | null
  household: Household | null
  members: Member[]
  /** The cycle on screen: the current one, or an earlier one (history). */
  cycle: Cycle | null
  /** The cycle today is in. */
  currentCycle: Cycle | null
  /** 0 for the current cycle, -1 for the one before it, and so on. */
  viewOffset: number
  /** The cycle on screen, newest first. */
  expenses: Expense[]
}

interface DataApi extends Snapshot {
  mode: Mode
  repo: Repo
  highlightIds: ReadonlySet<string>
  /** Reloads everything from the repo. */
  refresh(): Promise<void>
  /**
   * Runs a repo call, then reloads. Errors from the call are passed on. With `apply`, the change to
   * the list on screen shows at once and the reload runs in the background, so a sheet can close
   * after one round trip to the server instead of two.
   */
  run<T>(call: (repo: Repo) => Promise<T>, apply?: (expenses: Expense[], result: T, cycle: Cycle) => Expense[]): Promise<T>
  /** Briefly highlights a row (1.5s). */
  highlight(id: string): void
  /** Shows an earlier cycle (offset below 0) or the current one (0). */
  viewCycle(offset: number): void
}

export interface ReadyData extends DataApi {
  session: Session
  household: Household
  cycle: Cycle
  currentCycle: Cycle
  me: Member | undefined
}

const DataContext = createContext<DataApi | null>(null)

/** Newest first, as the repos list them: by date, then by the time they were logged. */
const byNewest = (a: Expense, b: Expense) =>
  a.spentOn === b.spentOn ? b.createdAt.localeCompare(a.createdAt) : b.spentOn.localeCompare(a.spentOn)

/** The list with `expense` added or replaced, or without it when its date is outside `cycle`. */
export function withExpense(expenses: Expense[], expense: Expense, cycle: Cycle): Expense[] {
  const rest = expenses.filter((e) => e.id !== expense.id)
  return expense.spentOn >= cycle.start && expense.spentOn < cycle.endExclusive ? [...rest, expense].sort(byNewest) : rest
}

export function withoutExpense(expenses: Expense[], id: string): Expense[] {
  return expenses.filter((e) => e.id !== id)
}

export function useData(): DataApi {
  const api = useContext(DataContext)
  if (!api) throw new Error('useData outside DataProvider')
  return api
}

/** For screens that only render once data is ready (behind RequireSession). */
export function useReadyData(): ReadyData {
  const api = useData()
  const { session, household, cycle, currentCycle } = api
  if (api.status !== 'ready' || !session || !household || !cycle || !currentCycle) throw new Error('Data is not ready')
  return { ...api, session, household, cycle, currentCycle, me: api.members.find((m) => m.id === session.memberId) }
}

let appOpenTracked = false

/** Same keys and the same values (every object in a snapshot is flat). */
function sameFlat<T extends object>(a: T | null, b: T | null): boolean {
  if (a === b) return true
  if (!a || !b) return false
  const keys = Object.keys(a) as Array<keyof T>
  return keys.length === Object.keys(b).length && keys.every((k) => Object.is(a[k], b[k]))
}

/** `next`, with each item equal to one in `prev` replaced by that item; `prev` itself when nothing changed. */
function sameList<T extends { id: string }>(prev: T[], next: T[]): T[] {
  const byId = new Map(prev.map((x) => [x.id, x]))
  let unchanged = prev.length === next.length
  const out = next.map((x, i) => {
    const old = byId.get(x.id)
    const kept = old && sameFlat(old, x) ? old : x
    if (kept !== prev[i]) unchanged = false
    return kept
  })
  return unchanged ? prev : out
}

/**
 * `next`, reusing whatever in `prev` is equal: a reload that brings what is already on screen (after a
 * save, on every return to the app) changes nothing, so nothing re-renders; a changed row is the only new object.
 */
export function sameAs(prev: Snapshot, next: Snapshot): Snapshot {
  const merged: Snapshot = {
    status: next.status,
    today: next.today,
    viewOffset: next.viewOffset,
    session: sameFlat(prev.session, next.session) ? prev.session : next.session,
    household: sameFlat(prev.household, next.household) ? prev.household : next.household,
    cycle: sameFlat(prev.cycle, next.cycle) ? prev.cycle : next.cycle,
    currentCycle: sameFlat(prev.currentCycle, next.currentCycle) ? prev.currentCycle : next.currentCycle,
    members: sameList(prev.members, next.members),
    expenses: sameList(prev.expenses, next.expenses),
  }
  return (Object.keys(merged) as Array<keyof Snapshot>).every((k) => merged[k] === prev[k]) ? prev : merged
}

const EMPTY: Omit<Snapshot, 'status' | 'today'> = {
  session: null,
  household: null,
  members: [],
  cycle: null,
  currentCycle: null,
  viewOffset: 0,
  expenses: [],
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { mode, repo } = useMode()
  const [snapshot, setSnapshot] = useState<Snapshot>(() => {
    const today = todayInIsrael()
    // Open on what this device has (on-device data, or a shared budget's last home); the first load refreshes it.
    const cached = repo.peekCached?.((h) => {
      const c = cycleFor(today, h.cycleStartDay)
      return { from: c.start, toExclusive: c.endExclusive }
    })
    if (!cached) return { status: 'loading', today, ...EMPTY }
    const cycle = cycleFor(today, cached.household.cycleStartDay)
    return { status: 'ready', today, ...cached, cycle, currentCycle: cycle, viewOffset: 0 }
  })
  const [highlightIds, setHighlightIds] = useState<ReadonlySet<string>>(new Set())
  const snapshotRef = useRef(snapshot)
  snapshotRef.current = snapshot
  const loadSeq = useRef(0)
  const viewOffsetRef = useRef(0)

  const load = useCallback(async (): Promise<Snapshot | null> => {
    const seq = ++loadSeq.current
    const today = todayInIsrael()
    const offset = viewOffsetRef.current
    const viewedFor = (startDay: number): Cycle => {
      const current = cycleFor(today, startDay)
      return offset === 0 ? current : shiftCycle(current, startDay, offset)
    }
    try {
      const session = await repo.getSession()
      let next: Snapshot
      if (!session) {
        next = { status: 'no-session', today, ...EMPTY }
      } else {
        // A refresh (after a save, a partner's change, a return to the app) almost always stays in the
        // cycle on screen, and an app launch in the cycle seen last time: ask for its expenses together
        // with the household, not one after the other.
        const shown = snapshotRef.current.household ?? repo.peekHousehold?.() ?? null
        const guess = shown?.id === session.householdId ? viewedFor(shown.cycleStartDay) : null
        const [household, members, guessed] = await Promise.all([
          repo.getHousehold(),
          repo.getMembers(),
          guess ? repo.listExpenses({ from: guess.start, toExclusive: guess.endExclusive }) : null,
        ])
        const cycle = viewedFor(household.cycleStartDay)
        const currentCycle = cycleFor(today, household.cycleStartDay)
        const expenses =
          guessed && guess?.start === cycle.start && guess.endExclusive === cycle.endExclusive
            ? guessed
            : await repo.listExpenses({ from: cycle.start, toExclusive: cycle.endExclusive })
        next = { status: 'ready', today, session, household, members, cycle, currentCycle, viewOffset: offset, expenses }
      }
      if (seq !== loadSeq.current) return null
      setSnapshot((prev) => sameAs(prev, next))
      return next
    } catch {
      if (seq !== loadSeq.current) return null
      // The seat this device opened with was taken back on another device, so its reads failed:
      // load again with the server's answer instead of showing an error.
      if ((await repo.seatConfirmed?.()) === false && seq === loadSeq.current) return load()
      // Keep showing what we have if a background refresh fails.
      if (snapshotRef.current.status !== 'ready') setSnapshot({ status: 'error', today, ...EMPTY })
      return null
    }
  }, [repo])

  const refresh = useCallback(async () => {
    await load()
  }, [load])

  const highlight = useCallback((id: string) => {
    setHighlightIds((prev) => new Set(prev).add(id))
    setTimeout(() => {
      setHighlightIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }, TIMING.highlightMs)
  }, [])

  const viewCycle = useCallback(
    (offset: number) => {
      viewOffsetRef.current = Math.min(0, Math.trunc(offset))
      void load()
    },
    [load],
  )

  const run = useCallback(
    async <T,>(call: (r: Repo) => Promise<T>, apply?: (expenses: Expense[], result: T, cycle: Cycle) => Expense[]): Promise<T> => {
      const result = await call(repo)
      if (!apply) {
        await load()
        return result
      }
      setSnapshot((s) => (s.status === 'ready' && s.cycle ? { ...s, expenses: apply(s.expenses, result, s.cycle) } : s))
      // An older reload still on its way must not put the old list back; the new one waits a moment,
      // so the change on screen is painted first.
      loadSeq.current++
      setTimeout(() => void load(), 0)
      return result
    },
    [repo, load],
  )

  // First load, and app_open once per page load.
  useEffect(() => {
    void load()
    if (!appOpenTracked) {
      appOpenTracked = true
      repo.track('app_open', { standalone: isStandalone(), lang: LANG })
    }
  }, [load, repo])

  // Changes from elsewhere (another tab): reload and highlight rows that are new.
  useEffect(() => {
    return repo.subscribe(() => {
      const before = new Set(snapshotRef.current.expenses.map((e) => e.id))
      void load().then((next) => {
        next?.expenses.filter((e) => !before.has(e.id)).forEach((e) => highlight(e.id))
      })
    })
  }, [repo, load, highlight])

  // Back online: reload (after the repo has had a moment to send what was saved offline).
  useEffect(() => {
    const onOnline = () => setTimeout(() => void load(), 800)
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [load])

  // Heal on return to the app, and roll over at midnight (Israel time).
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load()
    }
    const timer = setInterval(() => {
      if (todayInIsrael() !== snapshotRef.current.today) void load()
    }, 60_000)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load])

  const api = useMemo<DataApi>(
    () => ({ ...snapshot, mode, repo, highlightIds, refresh, run, highlight, viewCycle }),
    [snapshot, mode, repo, highlightIds, refresh, run, highlight, viewCycle],
  )

  return <DataContext.Provider value={api}>{children}</DataContext.Provider>
}
