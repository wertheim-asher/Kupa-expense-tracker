import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { repoFor, storeMode, type Mode } from '../data/mode.ts'
import type { Repo } from '../data/repo.ts'

interface ModeApi {
  mode: Mode
  repo: Repo
  setMode(mode: Mode): void
}

const ModeContext = createContext<ModeApi | null>(null)

export function useMode(): ModeApi {
  const api = useContext(ModeContext)
  if (!api) throw new Error('useMode outside ModeProvider')
  return api
}

export function ModeProvider({ initial, children }: { initial: Mode; children: ReactNode }) {
  const [mode, setModeState] = useState<Mode>(initial)
  const setMode = useCallback((next: Mode) => {
    storeMode(next)
    setModeState(next)
  }, [])
  const api = useMemo(() => ({ mode, repo: repoFor(mode), setMode }), [mode, setMode])
  return <ModeContext.Provider value={api}>{children}</ModeContext.Provider>
}
