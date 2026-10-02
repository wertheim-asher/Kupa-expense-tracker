// Whether this build talks to the shared backend. Kept apart from the Supabase client, so screens
// can ask without loading the client library (it loads only when a budget on this device needs it).

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

/** True when this build talks to the shared backend. */
export const syncEnabled = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)
