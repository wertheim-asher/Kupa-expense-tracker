// Which repo the app uses. The real app (mode "local") uses the shared Supabase backend when
// this build has its settings, otherwise on-device storage only. Demo mode (?demo=1 or
// "Try the demo") is always on-device, so a demo never depends on the network.
// The choice lives in sessionStorage, so a fresh launch always opens the real app.

import { APP } from '../config.ts'
import { buildDemoSeed } from './demoSeed.ts'
import { LocalStoreRepo } from './localStoreRepo.ts'
import type { Repo } from './repo.ts'
import { LazySupabaseRepo } from './lazySupabaseRepo.ts'
import { syncEnabled } from './syncConfig.ts'

export type Mode = 'local' | 'demo'

const MODE_KEY = `${APP.slug}.mode`

function readStored(): Mode {
  try {
    return sessionStorage.getItem(MODE_KEY) === 'demo' ? 'demo' : 'local'
  } catch {
    return 'local'
  }
}

export function storeMode(mode: Mode): void {
  try {
    sessionStorage.setItem(MODE_KEY, mode)
  } catch {
    // Without sessionStorage the mode lasts until reload.
  }
}

/** Reads ?demo=1 / ?demo=0 once at startup, remembers it, and removes it from the URL. */
export function initialMode(): Mode {
  if (typeof window === 'undefined') return 'local'
  const url = new URL(window.location.href)
  const param = url.searchParams.get('demo')
  if (param === '1' || param === '0') {
    storeMode(param === '1' ? 'demo' : 'local')
    url.searchParams.delete('demo')
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
  }
  return readStored()
}

const repos: Partial<Record<Mode, Repo>> = {}

export function repoFor(mode: Mode): Repo {
  repos[mode] ??=
    mode === 'demo'
      ? new LocalStoreRepo({ key: `${APP.slug}.demo.v1`, seed: buildDemoSeed })
      : syncEnabled
        ? new LazySupabaseRepo()
        : new LocalStoreRepo({ key: `${APP.slug}.local.v1` })
  return repos[mode]
}
