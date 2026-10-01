# Kupa MVP: Build Spec

You are building a working MVP for a Product Management course final project. The owner is Asher (the PM). You are the builder. Read this entire file before you do anything. Follow it exactly. When this spec does not cover something, make the simplest choice that serves the primary user, and record it in BUILD_LOG.md.

---

## FAST LANE (overrides the rest of this spec)

Time is short. The app must be live on Netlify by **Friday, October 2, 2026, evening**. Follow this section first. Where it conflicts with anything below, this section wins.

**Build only this, in this order:**
1. Phase 0 without the STOP: create CLAUDE.md and BUILD_LOG.md, show a 10-line plan, then continue immediately.
2. Phase 1 in full (domain logic and unit tests for cycle and money).
3. Phase 2, with two repos instead of Supabase:
   - **LocalRepo:** same as DemoRepo but starts empty, no seed. This is the real app. A real user creates a budget (their name, budget, cycle day; skip the invite screen) and logs expenses on one device. Data persists in `localStorage`.
   - **DemoRepo:** seeded, as in section 12. Used for the presentation.
   - The app uses LocalRepo by default, DemoRepo with `?demo=1`.
   - Hide "Join with a code" and all invite UI in this lane.
4. Deploy to Netlify right after Phase 2 (section 15, without the Supabase variables). Ask Asher to log in to Netlify when needed. Give him the live URL.
5. STOP. Ask Asher to test the core flow on his phone with the live URL.

**Keep:** core add flow, home with the big number, billing cycle, `add_save` timing and all other events (stored locally), CSV export, undo, edit and delete, empty and error states, Hebrew RTL, PWA install, BUILD_LOG.md.

**Skip for now:** Supabase, join and invite, realtime, offline outbox (not needed with local storage), previous cycle navigation, date chip, English, dark mode, Playwright, RLS test, "simulate partner" button.

**Only if Asher writes "go sync" after step 5:** do Phase 3 (Supabase) and enable join and invite.

Log every cut in BUILD_LOG.md under "Cuts made for time", with the reason "deadline".

---

## 0. How to work

### Rules
1. **Scope is sacred.** Build only what this spec lists. If you think something is missing or would be nice, do NOT build it. Add it to the "Suggested, not built" section of BUILD_LOG.md with one line on why.
2. **Decide, don't ask.** Ask Asher only when you are blocked on something only he can do (create an account, paste a key, test on his phone, approve a checkpoint). For everything else, decide and log the decision.
3. **Log honestly.** Keep BUILD_LOG.md updated during the work, not at the end. Include your own mistakes, failed attempts and tool limitations. Asher will present this log, so it must be true.
4. **Checkpoints are hard stops.** At each STOP in section 16, stop and wait for Asher's reply.
5. **Verify before claiming done.** Run the tests, run the app, look at it in a mobile viewport. Never say something works unless you saw it work.
6. **Commit per phase** with a clear message. Initialize git in Phase 0.
7. **No placeholders** in shipped code: no TODOs, no lorem ipsum, no fake buttons that do nothing.
8. **No secrets in git.** Only `.env.example` is committed. Never use or request the Supabase service role key in the app.

### Deadline and priorities
The app must be demo-ready by **Friday, October 2, 2026**. The presentation is Sunday, October 4.

- **P0 (never cut):** core logging flow, "left this cycle" home screen, billing cycle math with tests, shared household with realtime sync, demo mode, `add_save` timing instrumentation, deployment, BUILD_LOG.md
- **P1:** edit and delete, undo, CSV export, offline outbox, loading/empty/error states, previous cycle navigation, date chip on add screen
- **P2:** English toggle, dark mode, Playwright smoke test, RLS isolation test, demo "simulate partner" button

If time runs short, cut in this order: Playwright test, English toggle, dark mode, previous cycle navigation, date chip, offline outbox. Log every cut in BUILD_LOG.md.

---

## 1. Product context

**Product:** Kupa (Hebrew: קופה). Working name. Keep the name in one config constant so it can change in one place.

**What it is:** a shared budget app for couples. Both partners log expenses by hand in seconds and always see one number: how much is left until the next credit card billing cycle.

**Primary user (the only one this MVP serves):** Noa, 34, the busy partner. She pays often and rarely tracks. Money talks with her partner feel like blame. She wants logging to take seconds and to know where they stand without asking.

**Secondary (not designed for, but present):** Dan, 36, her partner, the planner. He benefits when Noa logs.

**Why Noa:** if the busy partner stops logging, the product fails. So every decision optimizes for her speed and her "value moment".

**The single problem:** Noa can't tell if they are on budget without asking, and logging feels like a chore.

**Core flow (the only flow that matters):**
1. Open app, tap "+"
2. Type amount, tap category. Tapping the category saves. Target: under 5 seconds.
3. Land on home and see the updated "₪1,240 left this cycle", which includes her partner's expenses.

**Value moment:** step 3. She knows where they stand, with no money talk.

**Positioning vs competitors:** Riseup (the main Israeli competitor) auto-syncs bank accounts and cards and is paid by subscription. Kupa is the opposite: free, private, no bank connection, built around the card billing cycle. This makes manual logging the riskiest assumption, which is exactly what the MVP measures.

**Assumptions this MVP tests, and how the app measures each:**
| # | Assumption | Measured by |
|---|---|---|
| 1 | People will log every expense if it takes about 5 seconds | `log_duration_ms` on every expense, `add_cancel` events |
| 2 | Seeing "left this cycle" is enough reason to keep logging | expenses per member per day, days active, `app_open` events |
| 3 | A billing-cycle budget matters more than a calendar month | cycle start day chosen at setup (how many pick a day other than 1) |

**Explicitly NOT building (do not build, even partially):**
- Bank or credit card sync
- Kids or more than 2 members
- Smart or AI categories, category suggestions, category sorting by usage
- Charts, reports, insights, analytics screens
- Income tracking, savings goals, per-category budgets
- Notes, receipts, photos, merchant names
- Push notifications, reminders, emails
- Real accounts (email, password, social login)
- Multiple households per device, household switching
- Recurring expenses, split calculations, debts between partners

---

## 2. Tech stack (fixed)

- Vite + React + TypeScript (strict mode)
- Tailwind CSS
- React Router
- `@supabase/supabase-js` v2 (Postgres, anonymous auth, Realtime)
- `vite-plugin-pwa` (installable PWA, app shell cached)
- `lucide-react` for icons
- `@fontsource/rubik` (self-hosted font, works offline, supports Hebrew)
- Vitest + React Testing Library for unit tests
- Playwright for the smoke test
- npm, Node 20 or newer
- Hosting: Netlify

No other UI kits, no state management library (React context and hooks only), no date library unless you log why you need it (prefer `Intl`). Use current stable versions. If a version breaks something, pin it and log it.

### Suggested structure
```
src/
  app/            routes, providers, error boundary
  features/
    onboarding/   welcome, create, invite, join
    home/
    add-expense/
    edit-expense/
    settings/
  domain/         cycle.ts, money.ts, categories.ts, types.ts
  data/           repo.ts (interface), supabaseRepo.ts, demoRepo.ts, demoSeed.ts, outbox.ts
  i18n/           he.ts, en.ts, index.ts
  analytics/      track.ts, exportCsv.ts
  ui/             Button, Sheet, Toast, Keypad, ProgressBar, Skeleton, Banner
  config.ts       app name, limits, category list
supabase/migrations/0001_init.sql
tests/e2e/
```

---

## 3. Backend (Supabase)

### Auth
Use Supabase **anonymous sign-in** (`supabase.auth.signInAnonymously()`). Each device gets a user id. The session persists in local storage. No email, no password.

Known limitation (document it, don't fix it): clearing browser data loses the session. The user can rejoin with the invite code.

### Tables
**households**
- `id` uuid pk, default `gen_random_uuid()`
- `budget_agorot` integer, not null, check > 0 and <= 10,000,000
- `cycle_start_day` smallint, not null, check between 1 and 28
- `invite_code` text, unique, not null (6 chars, see below)
- `created_at` timestamptz default now()
- `updated_at` timestamptz default now()

**members**
- `id` uuid pk, default `gen_random_uuid()`
- `household_id` uuid, fk to households, not null
- `user_id` uuid, fk to `auth.users`, not null, **unique** (one household per device user)
- `display_name` text, not null, 1 to 30 chars after trim
- `color` text, not null (`teal` for the creator, `violet` for the second member)
- `created_at` timestamptz default now()

**expenses**
- `id` uuid pk, **generated on the client** (for idempotent retries)
- `household_id` uuid, fk, not null
- `member_id` uuid, fk, not null
- `amount_agorot` integer, not null, check > 0 and <= 10,000,000
- `category` text, not null, check in the 8 category ids (section 8)
- `spent_on` date, not null (local Israel date, see section 5)
- `log_duration_ms` integer, null (only set by the add flow)
- `created_at` timestamptz default now()
- `updated_at` timestamptz default now()
- `deleted_at` timestamptz, null (**soft delete only**, so realtime sends updates and analytics keep history)

**events**
- `id` bigint generated always as identity pk
- `household_id` uuid, fk, not null
- `member_id` uuid, fk, not null
- `name` text, not null
- `props` jsonb, default `'{}'`
- `created_at` timestamptz default now()

Indexes: `expenses (household_id, spent_on)`, `events (household_id, created_at)`.

### Security (RLS on every table)
- Helper function `is_member(hid uuid)`: `security definer`, `stable`, fixed `search_path`, returns true if a row in `members` has that household and `user_id = auth.uid()`.
- households: select and update only if `is_member(id)`. No direct insert or delete.
- members: select if `is_member(household_id)`. Update only own row (`user_id = auth.uid()`), only `display_name`. No direct insert or delete.
- expenses: select, insert, update if `is_member(household_id)`. On insert, `member_id` must be the caller's own member id. No hard delete policy.
- events: insert if `is_member(household_id)` and `member_id` is the caller's. Select if `is_member(household_id)` (needed for CSV export).

### RPC functions (`security definer`, fixed `search_path`)
- `create_household(p_display_name text, p_budget_agorot int, p_cycle_start_day int)`: validates inputs, fails if caller is already a member somewhere, generates a unique invite code, inserts household and member (color `teal`), returns household id, member id and invite code.
- `join_household(p_code text, p_display_name text)`: case-insensitive code lookup. Errors with distinct codes: `code_not_found`, `household_full` (already 2 members), `already_member`. Inserts member with color `violet`. Returns household id and member id.

Invite code: 6 characters from `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (no 0, O, 1, I, L). Retry on collision.

### Realtime
Add `expenses` and `households` to the `supabase_realtime` publication. The client subscribes filtered by `household_id`. On any change, update local state. On `visibilitychange` to visible and on reconnect, refetch the current cycle to heal missed events.

### Setup instructions for Asher
Write `SETUP.md` with numbered, click-by-click steps: create a free Supabase project, enable anonymous sign-ins (Authentication settings), run `supabase/migrations/0001_init.sql` in the SQL editor, confirm realtime is on for the two tables, copy the project URL and anon key into `.env.local`. Keep it short and exact. Note that free Supabase projects can pause after inactivity, so Asher should open the dashboard the day before the demo.

---

## 4. Data access layer

Define one `Repo` interface. The UI talks only to it.

```ts
interface Repo {
  getSession(): Promise<Session | null>           // { householdId, memberId } or null
  createHousehold(input: CreateInput): Promise<CreateResult>
  joinHousehold(code: string, displayName: string): Promise<JoinResult>
  getHousehold(): Promise<Household>
  getMembers(): Promise<Member[]>
  listExpenses(range: { from: string; toExclusive: string }): Promise<Expense[]>  // ISO dates
  addExpense(input: NewExpense): Promise<Expense>  // input includes client-generated id
  updateExpense(id: string, patch: ExpensePatch): Promise<Expense>
  deleteExpense(id: string): Promise<void>        // soft delete
  restoreExpense(id: string): Promise<void>       // for undo of delete, if used
  updateHousehold(patch: { budgetAgorot?: number; cycleStartDay?: number }): Promise<Household>
  updateMyName(name: string): Promise<void>
  subscribe(onChange: () => void): () => void
  track(name: string, props?: Record<string, unknown>): void  // fire and forget
  exportData(): Promise<{ expenses: ExportExpense[]; events: ExportEvent[] }>
  resetDevice(): Promise<void>
}
```

Two implementations:
- `SupabaseRepo`: real backend.
- `DemoRepo`: fully local, persisted in `localStorage`, seeded (section 12). No network needed.

Mode selection: `?demo=1` in the URL, or the "Try the demo" button, switches to DemoRepo and remembers it in `sessionStorage`. `?demo=0` or "Exit demo" in settings returns to the real app.

### Offline outbox (P1)
- New expenses created while offline go to an outbox in `localStorage` and show immediately with a small clock icon.
- Flush on the `online` event, on app start and on `visibilitychange` to visible.
- Inserts are idempotent: the client id is the primary key, and a duplicate insert is treated as success.
- Edit and delete require a connection. While offline, disable them with a short message.

---

## 5. Billing cycle logic (critical, fully tested)

### Definitions
- `cycle_start_day` = D, an integer from 1 to 28. The UI never offers 29 to 31.
- All "today" and `spent_on` values are **local dates in `Asia/Jerusalem`**, as `YYYY-MM-DD` strings. Never derive them from UTC. Get today with `Intl.DateTimeFormat` using the `Asia/Jerusalem` time zone.
- For a date d: if day(d) >= D, the cycle starts on D of d's month. Otherwise it starts on D of the previous month.
- The cycle ends (exclusive) on D of the following month. Last day = that minus one day.
- `daysLeft` = number of days from today to the last day, **including today**.
- Changing D takes effect immediately. The current cycle is recalculated on the spot.

### Functions (in `domain/cycle.ts`, pure, no side effects)
- `todayInIsrael(now?: Date): string`
- `cycleFor(date: string, startDay: number): { start: string; endExclusive: string; lastDay: string }`
- `shiftCycle(cycle, startDay, offset: number)` for previous/next cycle navigation
- `daysLeft(today: string, cycle): number`
- `isInCycle(date: string, cycle): boolean`

### Required unit tests
| D | today | start | last day | daysLeft |
|---|---|---|---|---|
| 10 | 2026-09-05 | 2026-08-10 | 2026-09-09 | 5 |
| 10 | 2026-09-09 | 2026-08-10 | 2026-09-09 | 1 |
| 10 | 2026-09-10 | 2026-09-10 | 2026-10-09 | 30 |
| 1 | 2026-02-15 | 2026-02-01 | 2026-02-28 | 14 |
| 28 | 2026-03-01 | 2026-02-28 | 2026-03-27 | 27 |
| 15 | 2026-01-03 | 2025-12-15 | 2026-01-14 | 12 |
| 10 | 2026-12-20 | 2026-12-10 | 2027-01-09 | 21 |

Also test:
- `todayInIsrael(new Date('2026-09-09T22:30:00Z'))` returns `2026-09-10` (Israel is UTC+3 in September).
- An expense on 2026-09-09 with D=10 belongs to the cycle starting 2026-08-10.
- `shiftCycle` by -1 from the 2026-09-10 cycle (D=10) gives 2026-08-10 to 2026-09-09.
- Start day 0, 29 and 31 are rejected.

---

## 6. Money

- Store and compute **only integer agorot**. Never use floats for money.
- Keypad input rules: max 6 integer digits, max 2 decimals, a leading "." becomes "0.", leading zeros are dropped ("007" shows "7"), a third decimal digit is ignored.
- Valid amount: greater than 0 and at most ₪100,000.
- Parse tests: "45" is 4500, "12.9" is 1290, "12.90" is 1290, "0" invalid, "" invalid, "100000" valid, "100000.01" invalid.
- Formatting: `Intl.NumberFormat` with the current locale and currency ILS. Whole amounts show no decimals, others show 2. Use tabular numbers.
- Home big number: rounded to the nearest shekel. Per day amount: floor of `max(left, 0) / daysLeft`, whole shekels.
- In RTL, wrap every amount in `<bdi>` so digits and the ₪ sign never flip.

---

## 7. Screens and flows

Mobile first. The app lives in a centered column, max width 480px. Respect iPhone safe areas (`env(safe-area-inset-*)`), especially for the "+" button and the keypad.

### 7.1 Onboarding
**Welcome**
- App name, tagline, and three actions: "Start a shared budget" (primary), "Join with a code", "Try the demo" (text link).

**Create (one screen, three fields)**
- Your name (text, required, max 30)
- Budget per cycle in ₪ (numeric, required, same rules as section 6)
- Cycle start day: select 1 to 28, default 10, with the helper text from section 9
- Button: "Create". On success go to Invite.
- Track `household_created` with `{ cycle_start_day, budget_bucket }`.

**Invite**
- The invite code, big and readable, plus a "Send invite" button using the Web Share API with the share text from section 9 and a link `https://<site>/join/<CODE>`. Fallback: copy link to clipboard with a toast.
- Secondary: "I'll do it later", goes to Home.

**Join**
- Route `/join/:code` prefills the code. Code field: 6 chars, auto uppercase, accepts paste, ignores spaces.
- Your name field. Button: "Join".
- Errors map to clear messages: `code_not_found`, `household_full`, `already_member`.
- If this device is already in a household and opens a join link: show "This device is already connected to a budget" with a button to go home.

### 7.2 Home
Top to bottom:
1. Header: cycle label (for example "10 בספט׳ עד 9 באוק׳"), settings icon. P1: arrows to move to previous cycles and back. When viewing a past cycle, show a chip "Back to current cycle".
2. **The big number:** "₪1,240 left this cycle". Over budget: "₪230 over budget" in the over color. This number animates (count up or down, 400ms) when it changes, unless reduced motion is on.
3. Line under it: "12 days left · about ₪103 per day". On the last day: "Last day of the cycle". Hide the per-day part when over budget.
4. Progress bar: spent / budget. Under 80%: primary color. 80% to 100%: warn color. Over 100%: over color, bar full. Color is never the only signal (the text says it too).
5. Small line: "Spent ₪7,760 of ₪9,000".
6. Expense list for the viewed cycle, newest first, grouped by `spent_on`: "Today", "Yesterday", then a short localized date. Each row: category emoji in a soft circle, category name, a small colored initial chip for the member who paid, amount at the end. Tap a row to edit. Rows added by the partner through realtime get a short highlight (1.5s).
7. Empty state: friendly text from section 9 pointing at the "+" button.
8. Floating "+" button, bottom end corner (bottom left in RTL), 64px, always visible on the current cycle. Hidden when viewing a past cycle.

Loading: skeletons for the number and the list, never a blank screen.

### 7.3 Add expense (the core flow)
- Opens as a full-height sheet when "+" is tapped. Record the tap time (`performance.now()`). Track `add_start`.
- Layout for one thumb, top to bottom: close button and title, **amount display** (large, placeholder "₪0"), hint line, **category grid** (4 columns x 2 rows, large buttons with emoji and label), P1 **date chip** ("Today", tap to cycle to "Yesterday", long list not needed; a third option "Other date" opens a native date input, max today, min 365 days ago), **custom keypad** at the bottom (3 x 4: 1-9, ".", 0, backspace; keys at least 64px tall).
- Use the custom keypad, not the OS keyboard (no layout jump, works reliably on iOS). Force the keypad grid to `dir="ltr"` so it looks like a phone keypad in Hebrew too.
- Category buttons are visually disabled until the amount is valid. Tapping a disabled category gently shakes the amount and shows the hint.
- **Tapping a category saves immediately.** On the first tap, disable all categories (no double saves). Generate the uuid, compute `log_duration_ms` from the "+" tap, save, track `add_save` with `{ duration_ms, category }`.
- After save: close the sheet, home shows the new number with animation, the new row is highlighted, and a toast shows "Saved ✓ ₪45 · Groceries" with "Undo" for 5 seconds. Undo soft-deletes the expense and tracks `undo`.
- Closing the sheet without saving tracks `add_cancel` with `{ duration_ms, had_amount: boolean }`.
- Save failure (not offline): keep the sheet open with the amount, show "Couldn't save. Try again?" with retry.

### 7.4 Edit expense (P1)
- Sheet with: amount (same keypad), category grid (selected one marked), date (native date input, max today, min 365 days ago), "Paid by" (read only), Save, and Delete.
- Delete asks for confirmation, then soft-deletes and tracks `expense_delete`. Save tracks `expense_edit` with the changed fields names only.
- Any household member can edit any household expense.
- If the date moves the expense out of the viewed cycle, it disappears from the list and totals update.

### 7.5 Settings
- Members: list with names and color chips. Edit your own name.
- Budget per cycle (same input rules). Cycle start day (1 to 28) with the helper "Changes apply right away to the current cycle." Both sync to the partner through realtime.
- Invite: code and "Send invite" (show only while the household has 1 member; after that show the code small, for recovery).
- Language: עברית / English (P2).
- Export data: "Download expenses (CSV)" and "Download events (CSV)".
- Demo only: "Simulate partner expense" (P2) and "Reset demo" and "Exit demo".
- Danger zone: "Disconnect this device". Warn first: "Save your invite code first. Without it you can't get back." Show the code in the warning.
- Footer: app name, version, "Course project MVP".

### 7.6 Global states
- **Offline banner** (top, non-blocking) whenever offline.
- **Error boundary** with a friendly message and "Try again" (reloads data).
- **Toasts** are announced with `aria-live="polite"`.

---

## 8. Categories (fixed list, fixed order)

| id | emoji | Hebrew | English |
|---|---|---|---|
| groceries | 🛒 | סופר | Groceries |
| eating_out | 🍕 | אוכל בחוץ | Eating out |
| transport | ⛽ | רכב ותחבורה | Car and transport |
| home | 🏠 | בית | Home |
| kids | 🧸 | ילדים | Kids |
| health | 💊 | בריאות | Health |
| fun | 🎉 | פנאי | Fun |
| other | 📦 | אחר | Other |

The order never changes. No sorting by usage (that is a future feature).

---

## 9. Language and copy

- Default: Hebrew, `<html lang="he" dir="rtl">`. English (P2) switches to `lang="en" dir="ltr"`. Store the choice in `localStorage`.
- Implement i18n with two plain TypeScript dictionaries and a tiny `t(key, vars)` helper. No i18n library.
- Hebrew copy is **gender neutral**: use plural or impersonal present forms ("לוחצים", "מקלידים", "אתם"). Short, warm, plain. No exclamation marks except in the welcome tagline if needed.
- Use Tailwind logical utilities (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`, `text-start`). Never `left`/`right` for layout.
- Mirror directional icons (chevrons, arrows) in RTL.

### Key strings (use these exactly, write the rest in the same tone)
| key | Hebrew | English |
|---|---|---|
| welcome.tagline | תמיד יודעים כמה נשאר עד החיוב הבא | Always know what's left until the next card bill |
| welcome.create | פתיחת קופה משותפת | Start a shared budget |
| welcome.join | הצטרפות עם קוד | Join with a code |
| welcome.demo | צפייה בדמו | Try the demo |
| create.name | איך קוראים לך? | What's your name? |
| create.budget | כמה אתם רוצים להוציא בכל מחזור? | How much do you want to spend per cycle? |
| create.cycleDay | באיזה יום מתחיל המחזור? | Which day does your cycle start? |
| create.cycleHelp | רוב האנשים בוחרים את יום החיוב של כרטיס האשראי. אפשר לשנות אחר כך. | Most people pick their credit card charge day. You can change it later. |
| invite.title | עכשיו מזמינים את בן או בת הזוג | Now invite your partner |
| invite.share | שליחת הזמנה | Send invite |
| invite.later | אעשה את זה אחר כך | I'll do it later |
| invite.shareText | הצטרפו לקופה המשותפת שלנו: {link} | Join our shared budget: {link} |
| join.code | קוד הזמנה | Invite code |
| join.notFound | הקוד לא נמצא. כדאי לבדוק אותו שוב. | Code not found. Please check it. |
| join.full | בקופה הזאת כבר יש שני אנשים. | This budget already has two people. |
| join.already | המכשיר הזה כבר מחובר לקופה. | This device is already connected to a budget. |
| home.left | נשארו {amount} במחזור הזה | {amount} left this cycle |
| home.over | חריגה של {amount} | {amount} over budget |
| home.daysLeft | עוד {n} ימים · בערך {amount} ליום | {n} days left · about {amount} per day |
| home.lastDay | יום אחרון במחזור | Last day of the cycle |
| home.spentOf | הוצאתם {spent} מתוך {budget} | Spent {spent} of {budget} |
| home.empty | עוד אין הוצאות במחזור הזה. לוחצים על + כדי להוסיף את הראשונה. | No expenses this cycle yet. Tap + to add the first one. |
| home.today | היום | Today |
| home.yesterday | אתמול | Yesterday |
| home.backToCurrent | חזרה למחזור הנוכחי | Back to current cycle |
| add.title | הוצאה חדשה | New expense |
| add.hint | מקלידים סכום ובוחרים קטגוריה | Type an amount, then pick a category |
| toast.saved | נשמר ✓ | Saved ✓ |
| toast.undo | ביטול | Undo |
| error.save | לא הצלחנו לשמור. לנסות שוב? | Couldn't save. Try again? |
| offline.banner | אין חיבור. הוצאות חדשות יישלחו כשהחיבור יחזור. | You're offline. New expenses will sync when you're back online. |
| edit.delete | מחיקה | Delete |
| edit.deleteConfirm | למחוק את ההוצאה? | Delete this expense? |
| settings.cycleHelp | השינוי חל מיד על המחזור הנוכחי. | Changes apply right away to the current cycle. |
| settings.disconnectWarn | כדאי לשמור את קוד ההזמנה לפני. בלעדיו אי אפשר לחזור. | Save your invite code first. Without it you can't get back. |
| demo.banner | מצב הדגמה | Demo mode |

---

## 10. Design

Calm, clean, trustworthy. Money apps create stress; this one should lower it. One big number, lots of white space, no clutter.

### Tokens (CSS variables, used through Tailwind)
| token | light | dark (P2, follows system) |
|---|---|---|
| bg | #F7F7F5 | #111113 |
| surface | #FFFFFF | #1C1C1F |
| text | #1C1C1E | #F2F2F2 |
| muted | #6B6B70 | #A1A1AA |
| border | #E6E6E3 | #2A2A2E |
| primary | #0F766E | #2DD4BF |
| primary-soft | #CCFBF1 | #134E4A |
| warn | #B45309 | #FBBF24 |
| warn-soft | #FEF3C7 | #451A03 |
| over | #B91C1C | #F87171 |
| over-soft | #FEE2E2 | #450A0A |
| member-teal | #0F766E | #2DD4BF |
| member-violet | #6D28D9 | #A78BFA |

### Type and layout
- Font: Rubik (400, 500, 700). Big number 56px bold, tabular numbers. Body 16px. Nothing under 13px.
- 8px spacing grid. Card radius 16px. Buttons fully rounded.
- Tap targets at least 48px. Keypad keys at least 64px tall. Category buttons at least 72px tall.
- Motion: 150 to 250ms ease-out. Sheets slide up. Respect `prefers-reduced-motion` everywhere.
- Must look right at 360x740 and 390x844, with no horizontal scroll. On desktop, the 480px column is centered on the bg color.

### Accessibility
- Every icon-only button and every keypad key has an `aria-label` (localized).
- Visible focus rings. Contrast at least WCAG AA.
- Semantic headings. Toasts in `aria-live`. Over budget is stated in text, not only color.

### App icon and PWA
- Create a simple SVG icon: rounded square in primary color with a white coin or jar glyph. Generate PNG 192, 512, a maskable 512 and a 180 apple-touch-icon.
- Manifest: name, short name, `display: standalone`, theme color = primary, background = bg, `dir` and `lang` matching Hebrew.
- Installable on iPhone (Add to Home Screen) and Android. App shell works offline.

---

## 11. Instrumentation and export

Track these events through `repo.track()`. Fire and forget, never block the UI, never crash on failure.

| event | props |
|---|---|
| app_open | `{ standalone: boolean, lang }` |
| household_created | `{ cycle_start_day, budget_bucket }` (bucket: under 5k, 5k to 10k, 10k to 20k, over 20k) |
| household_joined | `{}` |
| add_start | `{}` |
| add_save | `{ duration_ms, category }` |
| add_cancel | `{ duration_ms, had_amount }` |
| undo | `{}` |
| expense_edit | `{ fields: string[] }` |
| expense_delete | `{}` |
| settings_change | `{ field }` |
| export | `{ type }` |

Never put amounts or names in event props.

### CSV export
- `expenses.csv`: id, spent_on, created_at, member_name, category, amount_ils, log_duration_ms, deleted
- `events.csv`: created_at, member_name, name, props_json
- UTF-8 **with BOM**, so Excel opens Hebrew correctly. Comma separated, quoted where needed.
- File names include the date: `kupa-expenses-2026-10-01.csv`.

---

## 12. Demo mode

Purpose: a reliable demo for the presentation, even with no internet, plus a way to test all UI before the backend exists.

- Entered by `?demo=1` or "Try the demo". A small "Demo mode" banner shows at the top.
- DemoRepo persists to `localStorage`, so reloads keep the state. "Reset demo" in settings restores the seed.
- **Seed** (generated relative to today, deterministic with a fixed-seed PRNG such as mulberry32 seed 42):
  - Budget ₪9,000, cycle start day 10
  - Members: Noa (the current user, teal) and Dan (violet)
  - About 28 expenses from the cycle start to today, about 55% by Noa, 45% by Dan
  - Category mix and ranges (₪): groceries 120 to 650 (most frequent), eating out 45 to 260, transport 60 to 380, home 40 to 900, kids 30 to 400, health 25 to 180, fun 40 to 300, other 20 to 150
  - Total spent should be about 8% ahead of pace (elapsed share of the cycle x budget x 1.08), so the demo shows real tension without being over budget. If today is the first day of a cycle, seed only 1 or 2 expenses.
  - `log_duration_ms` for seeded expenses: 2,500 to 9,000
  - Also seed the previous cycle (about 30 expenses, ending slightly under budget) so cycle navigation has content.
- **Simulate partner expense** (P2): in settings, demo only. After 3 seconds, Dan adds ₪84 Groceries through the same change path as realtime, so the home screen shows the live highlight. This demonstrates the shared value moment on stage.

---

## 13. Edge cases (all must be handled)

1. Over budget: negative left becomes "over budget" text and color, per-day hidden.
2. Budget or cycle day changed by the partner: home updates live.
3. Cycle day changed mid-cycle: current cycle recalculated immediately.
4. Expense edited into another cycle: leaves the current list and totals.
5. Future dates: not allowed anywhere.
6. Invalid amounts (0, empty, over ₪100,000, 3 decimals): blocked in the keypad, never sent.
7. Double tap on a category: exactly one expense saved.
8. Both partners add at the same moment: both appear on both phones.
9. Wrong, full or already-used invite code: specific messages.
10. Join link opened on a device that already has a household: message, no crash.
11. Lost session (cleared storage): welcome screen, can rejoin with code.
12. Around midnight Israel time: `spent_on` and cycle use the Israel date, not UTC.
13. Partner deletes an expense you are looking at: list updates, open edit sheet closes with a short message.
14. Offline: banner, outbox for new expenses, edit and delete disabled.
15. Very long names: truncated with ellipsis, never break the layout.
16. First day and last day of a cycle: text is correct ("Last day of the cycle", 1 day left).
17. Household with one member: app fully works, invite visible in settings.

---

## 14. Testing

### Unit (Vitest), required
- All cycle cases in section 5
- All money parsing and formatting cases in section 6
- Keypad input reducer (leading dot, leading zeros, max decimals, max digits, backspace)
- Demo seed: deterministic, total within the target range, all dates inside their cycles

### Smoke test (Playwright, P2), mobile viewport (iPhone 13 profile), demo mode
1. Open `/?demo=1`, see the big number and the list
2. Tap "+", type 4, 5, tap Groceries
3. See the toast, the new row, and the big number lower by exactly ₪45
4. Tap Undo, the number returns to the previous value
5. Open an expense, change its category, save, see the change
6. Switch to English, check `dir="ltr"` and the English big number text

### RLS isolation test (P2)
A script `npm run test:rls` using two anonymous users against the real project: user A creates a household and an expense. User B (not a member) must get zero rows from households, members, expenses and events of A, and must fail to insert into A. Document how to run it in SETUP.md.

### Manual device checklist (write it into README.md for Asher)
- iPhone Safari: add to home screen, open from icon, full core flow, keypad and "+" clear of the home indicator
- Android Chrome: install, full core flow
- Two phones in one household: an expense on one appears on the other within 2 seconds
- Airplane mode: log an expense, reconnect, it syncs once (no duplicate)

---

## 15. Deployment (Netlify)

- `public/_redirects` with `/* /index.html 200` so `/join/:code` works on refresh.
- Environment variables in Netlify: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- Deploy with the Netlify CLI or by connecting the git repo. Ask Asher to log in when needed.
- After deploy, verify the live URL: welcome loads, demo works, create works, join link works on a second browser profile.

---

## 16. Phases and checkpoints

**Phase 0: understand and plan**
- Read this file fully. Initialize git.
- Create `CLAUDE.md` with 5 short lines: follow SPEC.md, respect scope and the NOT building list, update BUILD_LOG.md as you go, stop at checkpoints, verify before claiming done.
- Create `BUILD_LOG.md` from the template in section 18.
- Present a short plan (phases, main risks, anything in the spec you see as contradictory or risky).
- **STOP.** Wait for Asher's OK.

**Phase 1: foundation**
- Scaffold the project, Tailwind, router, fonts, tokens, i18n skeleton, config.
- Build `domain/` (cycle, money, categories, types) with all unit tests passing.
- Commit.

**Phase 2: full UI on demo mode**
- Repo interface, DemoRepo, seed.
- All screens: onboarding (demo path), home, add, edit, settings, toasts, banners, states. Hebrew RTL complete.
- Verify visually at 360x740 and 390x844 (use Playwright screenshots if you have no browser tool). Fix what looks wrong.
- Commit.
- **STOP.** Run `npm run dev -- --host`, give Asher the local network URL and ask him to try the core flow on his phone. Wait for feedback. Log it in BUILD_LOG.md under "Feedback".

**Phase 3: real backend**
- Write `supabase/migrations/0001_init.sql` and `SETUP.md`.
- **STOP.** Ask Asher to follow SETUP.md and paste the URL and anon key. Wait.
- Build SupabaseRepo: anonymous auth, create, join, CRUD, realtime, heal on visibility.
- Verify with two browser contexts (two anonymous users) that create, join and live sync work.
- Commit.

**Phase 4: robustness**
- Offline outbox, all loading/empty/error states, undo, edit/delete, instrumentation, CSV export.
- Walk through every edge case in section 13 and note the result of each in BUILD_LOG.md.
- Commit.

**Phase 5: tests and polish**
- Playwright smoke test and RLS test (P2).
- Accessibility pass, reduced motion pass, dark mode (P2), English (P2).
- Commit.

**Phase 6: ship**
- Deploy to Netlify, verify the live URL (section 15).
- Finish README.md: what it is, live URL, how to run locally, demo mode, manual device checklist, known limitations.
- Finalize BUILD_LOG.md.
- **STOP.** Give Asher the live URL and a 5-line summary.

---

## 17. Definition of done

- A new user creates a household and logs the first expense in under 60 seconds.
- Logging ₪45 takes 3 taps after "+" (4, 5, category) and feels instant.
- A partner's expense appears on the other phone within 2 seconds, with no refresh.
- All cycle and money unit tests pass.
- Hebrew RTL is correct everywhere: amounts never flip, keypad looks like a phone keypad, chevrons point the right way.
- Works on iPhone Safari and Android Chrome at 360px width, no horizontal scroll, nothing hidden behind the home indicator.
- Installable as a PWA.
- Every state exists: loading, empty, offline, error, over budget, invalid code, full household.
- Demo mode works with no internet.
- No console errors or warnings in normal use.
- Nothing from the NOT building list exists in the app.
- BUILD_LOG.md is complete and honest.

---

## 18. BUILD_LOG.md template

```markdown
# Build Log

## Decisions made by Asher (the PM)
(Summarize the product decisions from SPEC.md: user, problem, flow, scope, what NOT to build.)

## Decisions made by Claude (the builder)
| Date | Decision | Why |
|---|---|---|

## Problems, failures and AI limitations
| Date | What happened | How it was solved | Time lost |
|---|---|---|---|
(Be specific and honest. Include wrong assumptions you made, code that failed, things you could not do, and anything Asher had to fix or decide for you.)

## Feedback from testing
| Date | Who | Feedback | Action |
|---|---|---|---|

## Edge case results
| # | Case | Result |
|---|---|---|

## Suggested, not built (scope parking lot)
| Idea | Why it could matter | Why not now |
|---|---|---|

## Cuts made for time
| What | Why |
|---|---|

## Timeline
| Phase | Started | Finished | Notes |
|---|---|---|---|
```

---

## 19. Known limitations (document in README, do not fix)

- Sessions are anonymous and tied to one browser on one device. Clearing data means rejoining with the invite code.
- Maximum 2 members per household.
- No bank sync, by design.
- Basic security suitable for an MVP: RLS on every table, no rate limiting, no captcha.
- Free Supabase projects can pause after inactivity.
- Categories are fixed.
