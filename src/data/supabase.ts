// The Supabase client for partner sync. Without the two env variables the app
// keeps working on this device only (LocalRepo), as in the fast-lane build.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { APP } from '../config.ts'
import { SUPABASE_ANON_KEY as key, SUPABASE_URL as url } from './syncConfig.ts'

export { syncEnabled } from './syncConfig.ts'

let client: SupabaseClient | null = null

/** A request that hangs (weak signal, Wi-Fi without internet) gives up after this long. */
const REQUEST_TIMEOUT_MS = 12_000

/**
 * fetch with a time limit: a save that cannot reach the server falls back to the offline
 * outbox instead of hanging for minutes (the "timeout" error is treated as offline).
 */
function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (init?.signal) return fetch(input, init)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new DOMException('Request timeout', 'TimeoutError')), REQUEST_TIMEOUT_MS)
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer))
}

export function supabase(): SupabaseClient {
  if (!url || !key) throw new Error('Supabase is not configured')
  client ??= createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: `${APP.slug}.auth` },
    global: { fetch: fetchWithTimeout },
  })
  return client
}
