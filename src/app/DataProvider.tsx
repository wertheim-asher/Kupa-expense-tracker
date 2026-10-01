import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { TIMING } from '../config.ts'
import { cycleFor, todayInIsrael, type Cycle } from '../domain/cycle.ts'
import type { Expense, Household, IsoDate, Member, Session } from '../domain/types.ts'
import type { Mode } from '../data/mode.ts'
import type { Repo } from '../data/repo.ts'
import { isStandalone } from '../analytics/track.ts'
import { LANG } from '../i18n/index.ts'
import { useMode } from './ModeContext.tsx'

type Status = 'loading' | 'no-session' | 'ready' | 'error'

interface Snapshot {
  status: Status
  today: IsoDate
  session: Session | null
  household: Household | null
  members: Member[]
  cycle: Cycle | null
  /** Current cycle, newest first. */
  expenses: Expense[]
}

interface DataApi extends Snapshot {
  mode: Mode
  repo: Repo
  highlightIds: ReadonlySet<string>
  /** Reloads everything from the repo. */
  refresh(): Promise<void>
  /** Runs a repo call, then reloads. Errors from the call are passed on. */
  run<T>(call: (repo: Repo) => Promise<T>): Promise<T>
  /** Briefly highlights a row (1.5s). */
  highlight(id: string): void
}

export interface ReadyData extends DataApi {
  session: Session
  household: Household
  cycle: Cycle
  me: Member | undefined
}

const DataContext = createContext<DataApi | null>(null)

export function useData(): DataApi {
  const api = useContext(DataContext)
  if (!api) throw new Error('useData outside DataProvider')
  return api
}

/** For screens that only render once data is ready (behind RequireSession). */
export function useReadyData(): ReadyData {
  const api = useData()
  const { session, household, cycle } = api
  if (api.status !== 'ready' || !session || !household || !cycle) throw new Error('Data is not ready')
  return { ...api, session, household, cycle, me: api.members.find((m) => m.id === session.memberId) }
}

let appOpenTracked = false

const EMPTY: Omit<Snapshot, 'status' | 'today'> = {
  session: null,
  household: null,
  members: [],
  cycle: null,
  expenses: [],
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { mode, repo } = useMode()
  const [snapshot, setSnapshot] = useState<Snapshot>(() => ({ status: 'loading', today: todayInIsrael(), ...EMPTY }))
  const [highlightIds, setHighlightIds] = useState<ReadonlySet<string>>(new Set())
  const snapshotRef = useRef(snapshot)
  snapshotRef.current = snapshot
  const loadSeq = useRef(0)

  const load = useCallback(async (): Promise<Snapshot | null> => {
    const seq = ++loadSeq.current
    const today = todayInIsrael()
    try {
      const session = await repo.getSession()
      let next: Snapshot
      if (!session) {
        next = { status: 'no-session', today, ...EMPTY }
      } else {
        const [household, members] = await Promise.all([repo.getHousehold(), repo.getMembers()])
        const cycle = cycleFor(today, household.cycleStartDay)
        const expenses = await repo.listExpenses({ from: cycle.start, toExclusive: cycle.endExclusive })
        next = { status: 'ready', today, session, household, members, cycle, expenses }
      }
      if (seq !== loadSeq.current) return null
      setSnapshot(next)
      return next
    } catch {
      if (seq !== loadSeq.current) return null
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

  const run = useCallback(
    async <T,>(call: (r: Repo) => Promise<T>): Promise<T> => {
      const result = await call(repo)
      await load()
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
    () => ({ ...snapshot, mode, repo, highlightIds, refresh, run, highlight }),
    [snapshot, mode, repo, highlightIds, refresh, run, highlight],
  )

  return <DataContext.Provider value={api}>{children}</DataContext.Provider>
}
