// A page opened before a deploy can ask for a code file that the new version no longer has: its service
// worker took over meanwhile and the old files are gone. Then creating or joining (the shared backend's
// code loads only then) failed until the app was closed. Instead, load the new version once.

import { APP } from '../config.ts'

const RELOAD_KEY = `${APP.slug}.staleReloadAt`
const MIN_GAP_MS = 60_000

/**
 * Whether to reload for a code file that failed to load: only under the service worker (the reload
 * comes from the phone), only online (creating and joining need the server anyway), and at most once a
 * minute, so a file that keeps failing can never loop.
 */
export function shouldReload(now: number, storage: Storage | null, controlled: boolean, online: boolean): boolean {
  if (!controlled || !online || !storage) return false
  try {
    if (now - Number(storage.getItem(RELOAD_KEY) ?? 0) < MIN_GAP_MS) return false
    storage.setItem(RELOAD_KEY, String(now))
    return true
  } catch {
    return false
  }
}

/** Vite reports a lazy code file that failed to load as `vite:preloadError`. */
export function reloadOnStaleCode(): void {
  window.addEventListener('vite:preloadError', () => {
    let storage: Storage | null = null
    try {
      storage = window.sessionStorage
    } catch {
      // Blocked storage: no way to limit reloads, so none.
    }
    if (shouldReload(Date.now(), storage, Boolean(navigator.serviceWorker?.controller), navigator.onLine)) window.location.reload()
  })
}
