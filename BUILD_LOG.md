# Build Log

## Decisions made by Asher (the PM)
- **Product:** Kupa (קופה), a shared budget app for couples. Both partners log expenses by hand in seconds and always see one number: how much is left until the next credit card billing cycle.
- **Primary user:** Noa, 34, the busy partner. She pays often and rarely tracks. Every decision optimizes for her logging speed and her "value moment". Dan (the planner) is present but not designed for.
- **Problem:** Noa can't tell if they are on budget without asking, and logging feels like a chore.
- **Core flow:** open app, tap "+", type amount, tap category (tapping saves, target under 5 seconds), land on home and see "₪1,240 left this cycle".
- **Positioning:** free, private, no bank connection, built around the card billing cycle (vs Riseup: bank sync, subscription). Manual logging is the riskiest assumption, so the MVP measures it.
- **Assumptions measured:** (1) people log if it takes about 5 seconds (`log_duration_ms`, `add_cancel`); (2) "left this cycle" is reason enough to keep logging (expenses per day, `app_open`); (3) billing cycle beats calendar month (cycle start day chosen at setup).
- **Not building:** bank/card sync, kids or more than 2 members, smart/AI categories, charts/reports/insights, income/savings/per-category budgets, notes/receipts/photos/merchants, push/reminders/emails, real accounts, multiple households per device, recurring expenses/splits/debts.
- **Fast lane (deadline):** live on Netlify by Friday Oct 2, 2026 evening. Build Phase 1 and Phase 2 with a local-only repo (LocalRepo, the real app, persisted in `localStorage`) plus the seeded DemoRepo (`?demo=1`). No Supabase, no join/invite until Asher writes "go sync".

## Decisions made by Claude (the builder)
| Date | Decision | Why |
|---|---|---|
| 2026-10-01 | Followed the FAST LANE: Phase 0 without the STOP, then Phase 1, Phase 2 with LocalRepo + DemoRepo, deploy, then STOP. | SPEC.md says the fast lane overrides the rest. |
| 2026-10-01 | Set a repo-local git identity (Asher Wertheim) because the machine had no global git user. Did not touch global git config. | `git commit` needs an author; changing global config is outside the project. |
| 2026-10-01 | Took the current stable versions npm resolved: React 19.3, React Router 8.4, Vite 8.3, TypeScript 7.0, Vitest 5.0, Tailwind 4.3, vite-plugin-pwa 1.3. No pins needed so far. | SPEC: "Use current stable versions." Checked that React Router 8 still exports `BrowserRouter`/`Routes` and that vite-plugin-pwa supports Vite 8 before writing code. |
| 2026-10-01 | Did not install `@supabase/supabase-js` or Playwright. | Fast lane skips Supabase and Playwright; unused dependencies would only add weight. |
| 2026-10-01 | Tailwind v4 with CSS-first config: tokens are CSS variables on `:root`, exposed to Tailwind through `@theme inline`. No `tailwind.config.js`. | v4 is the current Tailwind; logical utilities (`ms-`, `pe-`, `start-`, `end-`) and the `rtl:` variant are built in. |
| 2026-10-01 | One `tsconfig.json` with `noEmit`, and `tsc --noEmit` in the build script instead of project references (`tsc -b`). | Simpler for a single-package app; strict mode is on. |
| 2026-10-01 | Fonts: import Rubik `400/500/700.css` (all subsets, each with `unicode-range`), but precache only the Hebrew and Latin `.woff2` files in the service worker. | The per-subset CSS files from Fontsource have no `unicode-range`, so they would break digits. This way only the needed files download, and the app works offline. |
| 2026-10-01 | App icon: a jar with a coin dropping in, drawn as SVG and rendered to PNG 192, 512, maskable 512 (glyph at 72% for the safe zone) and 180 apple-touch (full-bleed, iOS rounds it) with `sharp` (`npm run icons`). | SPEC section 10 asks for a coin or jar glyph on the primary color. |
| 2026-10-01 | Keypad text is formatted while typing with `Intl.NumberFormat.formatToParts`, so "12." and "12.5" keep the dot and partial decimals but still use the locale's ₪ position and grouping. | Formatting the parsed number would hide the dot the user just typed. |
| 2026-10-01 | Budget field on the create screen accepts "9,000", "9000 ₪" and a decimal comma, then applies the same parse rules as the keypad. | People type budgets in many ways on a phone keyboard; the stored value still follows section 6. |
| 2026-10-01 | i18n: only the Hebrew dictionary exists (`he.ts`), with `t()` for strings and `tx()` for strings with React nodes (amounts inside `<bdi>`). | English is cut in the fast lane. The helper keeps the same shape, so `en.ts` can be added later. |
| 2026-10-01 | LocalRepo and DemoRepo are one class (`LocalStoreRepo`) with different storage keys; DemoRepo passes the seed function. Every change is applied to a copy, written to `localStorage`, and only then made current, so a failed write leaves data unchanged and the add sheet can show "Couldn't save. Try again?". | Same behavior in both modes, one place to test. |
| 2026-10-01 | LocalRepo stores events even before a household exists (for example `app_open` on the welcome screen), with an empty member name in the CSV. | Otherwise the first `app_open` of every new user would be lost, and that is the funnel start. |
| 2026-10-01 | `subscribe()` in LocalRepo listens to the browser `storage` event, so a change in another tab of the same browser updates the home screen live, highlights new rows, and closes an open edit sheet for a deleted expense. | Cheapest honest stand-in for realtime in the fast lane; covers edge case 13 on one device. |
| 2026-10-01 | Big number layout: the text before `{amount}` on its own line, the amount at 56px, then the text after it ("נשארו / ₪1,240 / במחזור הזה"). The template is split around `{amount}`, so the copy in `he.ts` stays exactly as in the spec. | At 360px the full sentence with a 56px amount does not fit on one line; this reads as one sentence top to bottom. |
| 2026-10-01 | Add and edit sheets are child routes (`/add`, `/expense/:id`) over Home. Android back closes the sheet. A reloaded `/add` goes home, because there is no honest "+" tap time to measure from. | Back button behavior on Android; clean `log_duration_ms`. |
| 2026-10-01 | `add_cancel` is tracked when the add sheet unmounts without saving (close button, Escape, back button, tap outside). | One place catches every way of leaving. |
| 2026-10-01 | `spent_on` for a new expense is computed at save time with `todayInIsrael()`, not taken from the cached "today" on screen. | Edge case 12: an app left open past midnight must not log yesterday's date. |
| 2026-10-01 | Undo is offered only for "add" (per the spec). Delete asks for confirmation and has no undo. | Mixing both into one `undo` event would blur the add-mistake signal for assumption 1. |
| 2026-10-01 | Over-budget text follows the animated number, so it flips from "נשארו" to "חריגה של" exactly when the count crosses zero. | Avoids showing "over by" with a positive number mid-animation. |
| 2026-10-01 | Disconnect warning in local mode says that all expenses on this device will be deleted and suggests exporting the CSV first, instead of "save your invite code". Disconnect is hidden in demo mode, where "Reset demo" and "Exit demo" cover it. | There is no invite code to come back with in the fast lane; the spec's warning would be false. |
| 2026-10-01 | Demo seed: current-cycle total is exactly `elapsed share x budget x 1.08`, capped at 97% of the budget so the last days of a cycle never seed over budget. Seeded expenses are dated up to yesterday (or 1 or 2 from earlier today on a cycle's first day). Expense count is the target divided by the average expense (about 28 to 31 around presentation day). | The spec's formula goes over 100% on the last 2 days of a cycle; and seeded times later than "now" would sort above the expense added live on stage. |
| 2026-10-01 | `uuid()` falls back to `crypto.getRandomValues` when `crypto.randomUUID` is missing. | `randomUUID` only exists on https or localhost; phone testing over the LAN is plain http. |
| 2026-10-01 | Budget bucket boundaries: under 5k is `< 5,000`, 5k to 10k is `5,000 to 9,999.99`, 10k to 20k is `10,000 to 20,000`, over 20k is `> 20,000`. | The spec names the buckets but not the edges. |
| 2026-10-01 | Visual checks run with a scratch script (`playwright-core` + the installed Chrome, headless, mobile emulation) at 360x740 and 390x844; it is not part of the repo. | The built-in browser pane's screenshots timed out or came back tiled while the app window was in the background. |

## Problems, failures and AI limitations
| Date | What happened | How it was solved | Time lost |
|---|---|---|---|
| 2026-10-01 | My first version of the demo seed's `allocate()` recomputed the remaining count inside the loop condition, so it would have under-allocated categories. | Caught on re-read before running; computed the remainder once. Seed tests now check counts and totals for 10 different "today" dates. | 2 min |
| 2026-10-01 | A shell one-liner I wrote to apply several edits had broken heredocs; it silently did nothing. | Checked the file, saw it unchanged, redid the edits with the editor tool. | 3 min |
| 2026-10-01 | Settings cards used the Hebrew title (with spaces) as the element id for `aria-labelledby`, which splits on spaces, so the labels would not work for screen readers. | Switched to React `useId()`. | 1 min |
| 2026-10-01 | The built-in browser pane could not take reliable screenshots (timeouts, a 2x2 tiled image) because the desktop app window was in the background. | Switched visual checks to a headless Chrome script with mobile emulation. | 5 min |
| 2026-10-01 | Screenshots showed two layout bugs: the undo toast was drawn above the sheets and covered the edit keypad if a row was opened within 5 seconds of saving; and at 360x740 the edit sheet's date field was clipped by the keypad. | Toasts now sit below sheets (z-35 vs z-50). The date label and input share one row. | 10 min |
| 2026-10-01 | The new core-flow integration test (React Testing Library) failed: after logging ₪45 from ₪9,000 the big number showed ₪10,166. My count-up animation used the `requestAnimationFrame` timestamp, whose time origin differs from `performance.now()` in some engines, so progress went negative and the ease-out curve overshot. | Read `performance.now()` inside each frame and clamp progress to 0..1. The test now passes and guards it. In Chrome it happened to work, so screenshots alone would have missed it on other engines. | 5 min |

| 2026-10-01 | Multi-agent review (5 reviewers by dimension, each finding challenged by a skeptic agent; 18 agents) confirmed defects I had missed: (a) while typing "12." in RTL the trailing dot jumped to the left of the digits; (b) the member chip told screen readers "paid by" in the Settings members list; (c) a repo for the inactive mode kept a stale cache, so leaving demo mode in one tab could overwrite local data written in another tab. | (a) the typed number sits in a left-to-right isolate; (b) `paidByLabel` prop, off where the name is visible; (c) the cache is dropped when the first listener subscribes. Still open (low severity, not fixed yet because the session ran out of usage): demo seed amounts can be scaled slightly outside the category ranges; "over by ₪0" shows when the overage is under 50 agorot; the settings/create back arrows push history entries; the edit sheet says "deleted elsewhere" when the expense only left the cycle at midnight; focus ring clipped on list rows; budget placeholder contrast; latin-ext font subset not precached. | 15 min |

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
| Supabase backend (Phase 3), anonymous auth, RLS, RPCs | deadline |
| Join with a code, invite screen, invite UI in settings | deadline |
| Realtime sync between partners | deadline |
| Offline outbox | deadline (not needed: LocalRepo writes to `localStorage`, it works offline by design) |
| Previous cycle navigation | deadline |
| Date chip on the add screen | deadline |
| English toggle | deadline |
| Dark mode | deadline |
| Playwright smoke test | deadline |
| RLS isolation test | deadline |
| Demo "Simulate partner expense" button | deadline |
| Offline banner | deadline. In the fast lane every write goes to `localStorage`, so the app works the same offline; the spec's banner text ("new expenses will sync when you're back online") would be false. The PWA still caches the app shell and fonts. |
| `household_joined` event | deadline (join is hidden). |

## Timeline
| Phase | Started | Finished | Notes |
|---|---|---|---|
| 0: understand and plan | 2026-10-01 | 2026-10-01 | Fast lane: no STOP. git init, CLAUDE.md, BUILD_LOG.md, 10-line plan. |
| 1: foundation | 2026-10-01 | 2026-10-01 | Scaffold, Tailwind tokens, fonts, PWA, icons, Hebrew i18n, `domain/` (cycle, money, keypad, categories, types). 73 unit tests passed on the first run. |
