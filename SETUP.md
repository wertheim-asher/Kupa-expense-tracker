# Supabase setup (about 15 minutes, once)

Kupa's partner sync runs on a free Supabase project. You only do this once. Claude never needs your passwords or the secret key.

## 1. Create the account and project
1. Go to https://supabase.com and click **Start your project**. Sign in with **GitHub** (wertheim-asher). It is the quickest.
2. Click **New project**.
   - **Organization:** your personal one, **Free** plan.
   - **Project name:** `kupa`
   - **Database password:** click **Generate a password**, and save it in your password manager. Kupa never uses it. Don't send it to anyone, Claude included.
   - **Region:** **Central EU (Frankfurt)**, the closest to Israel.
3. Click **Create new project** and wait about 2 minutes until the dashboard is ready.

## 2. Allow anonymous sign-ins
Kupa has no accounts. Each phone gets an anonymous user.
1. Left sidebar: **Authentication**, then **Sign In / Providers**.
2. Under **User Signups**, turn on **Allow anonymous sign-ins**, then click **Save**.

## 3. Raise the anonymous sign-in limit (for the class demo)
By default Supabase allows 30 anonymous sign-ins per hour from one network. A class on one Wi-Fi would hit that in minutes.
1. Left sidebar: **Authentication**, then **Rate Limits**.
2. Set the limit for **anonymous users** (sign-ins per hour) to **500**, then click **Save**.

## 4. Create the database
1. Open the file on GitHub: https://github.com/wertheim-asher/Kupa-expense-tracker/blob/sync/supabase/migrations/0001_init.sql
2. Click the **Copy raw file** button (two overlapping squares, top right of the file).
3. In Supabase, left sidebar: **SQL Editor**, then **+ New query**.
4. Paste, then click **Run** (or Cmd+Enter on the Mac, Ctrl+Enter on the PC).
5. You should see **Success. No rows returned**. If you see an error, send Claude a screenshot.

## 5. Check realtime is on
1. Left sidebar: **Database**, then **Publications**.
2. Click **supabase_realtime**. The tables **expenses**, **households** and **members** should be switched on. (The script in step 4 does this; this is just a check.)

## 6. Send Claude two values
1. Left sidebar: **Project Settings** (the gear), then **API Keys** (older dashboards: **API**).
2. Copy the **Project URL** (looks like `https://abcdefghijkl.supabase.co`; on some dashboards it is under **Data API**).
3. Copy the **Publishable key** (starts with `sb_publishable_`; older projects call it **anon public**). It is designed to be public; it ships inside the app.
4. Paste both into the chat with Claude.

**Never** send the **secret** key or the **service_role** key. Kupa must not use them.

## Before the presentation
Free Supabase projects pause after a week without activity. Open the Supabase dashboard the day before the demo so the project is awake.

## For developers
- Local development: put the two values in `.env.local` (never committed):
  ```
  VITE_SUPABASE_URL=https://abcdefghijkl.supabase.co
  VITE_SUPABASE_ANON_KEY=sb_publishable_...
  ```
- Netlify: the same two variables are set in the site's environment variables (all deploy contexts).
- Without these variables the app falls back to on-device storage only (the fast-lane build).
