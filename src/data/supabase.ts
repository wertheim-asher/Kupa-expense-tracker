// The Supabase client for partner sync. Without the two env variables the app
// keeps working on this device only (LocalRepo), as in the fast-lane build.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { APP } from '../config.ts'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

/** True when this build talks to the shared backend. */
export const syncEnabled = Boolean(url && key)

let client: SupabaseClient | null = null

export function supabase(): SupabaseClient {
  if (!url || !key) throw new Error('Supabase is not configured')
  client ??= createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: `${APP.slug}.auth` },
  })
  return client
}
