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

## Problems, failures and AI limitations
| Date | What happened | How it was solved | Time lost |
|---|---|---|---|

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

## Timeline
| Phase | Started | Finished | Notes |
|---|---|---|---|
| 0: understand and plan | 2026-10-01 | 2026-10-01 | Fast lane: no STOP. git init, CLAUDE.md, BUILD_LOG.md, 10-line plan. |
| 1: foundation | 2026-10-01 | 2026-10-01 | Scaffold, Tailwind tokens, fonts, PWA, icons, Hebrew i18n, `domain/` (cycle, money, keypad, categories, types). 73 unit tests passed on the first run. |
