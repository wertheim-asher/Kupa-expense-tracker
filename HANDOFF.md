# Handoff: Kupa (קופה), PM course MVP. Updated Wed 2026-10-14
Goal: shared-budget PWA for couples: log an expense in 3 taps, always see "left this cycle". **Presentation: Sun Oct 18, 2026.** Read CLAUDE.md, SPEC.md (FAST LANE first) and BUILD_LOG.md (full history) before working. Asher's chat style: every message starts with "/BL:", few words, plain English (B2), no em dashes.

## Where things are
- **Live:** https://kupa-expense-tracker.netlify.app from `main` (bed5ebb). The app code on `main` is the Oct 3 version (PR #4); after it only notes (PR #5) and the keep-alive workflow. The live app is still Hebrew by default with the old demo.
- **Branch `claude/epic-galileo-bn5lcb`:** all of round 6, pushed, **no PR yet**, not merged. Commits on top of `main`: caffd05 (demo), 50da40b (log), fca5673 (English default), 85fcff8 (launch speed), plus the handoff commit (compile-hint hash, `scripts/checks/`, notes).
- **Netlify credits:** the cycle reset on Oct 13; no production deploy since, so about 0 of 300 used (check the Netlify dashboard). Each production deploy costs 15. Plan: one PR (deploy previews are free), one merge = 15 credits. Commits that change only notes, `pilot/` or `presentation/` skip the production build; `[skip netlify]` in a commit message skips any build.
- **Supabase** (project xblsobdgqmwvnbdhowiq): migrations 0001, 0002, 0003 applied. A daily GitHub Action (`supabase-keepalive.yml`, 05:17 UTC, secret `SUPABASE_ANON_KEY`) keeps the free project awake; runs on Oct 12 and 13 were green.
- **Pilot:** postponed by Asher on Oct 14 (tight schedule), a future step. `pilot/` is unchanged.
- **Reminders:** the Oct 15 one is off. The Oct 17 17:00 UTC (20:00 Israel) pre-presentation checklist still fires, into the old cloud session; it pushes a notification to Asher's phone.
- Two Claude sessions can work on this repo (Asher's PC and the cloud). Changes reach `main` only through PRs, with Asher's OK.

## What is on the branch (round 6)
1. **Demo for the presentation.** Starts from a new seed each day and after a language switch (reloads the same day keep changes). The current cycle (on Oct 18: Oct 10 to Nov 9, about 8% ahead of pace) plus 9 earlier cycles back to Jan 10 to Feb 9, with varied totals (Aug and Mar to Apr over budget; no amount at a category limit or repeated). Root cause of Asher's report: the stored demo was seeded once and never refreshed.
2. **"Simulate partner expense":** each tap adds the next of 20 different expenses by Dan, dated today (first: ₪84 groceries), and home switches to the current cycle first.
3. **English by default**, Hebrew in Settings (English listed first). index.html starts `lang="en" dir="ltr"`; the manifest is "Kupa" in English; iOS's suggested home-screen name follows the language. A stored Hebrew choice is kept.
4. **Launch speed** (measured, CPU 4x with the service worker): demo and on-device open straight on home, no skeleton (demo 816 to 654 ms); V8 compile hint on the entry script (shared-budget home 651 to 579 ms; Chrome only, Safari ignores it).
5. **`scripts/checks/`:** 4 phone-browser checks (see README "Checks in a phone-sized browser").

## Verified on the branch (Oct 14)
- Type check, 219 unit tests, the phone smoke test (now English first, then the switch to Hebrew).
- `launch-cache.cjs` ALL PASS (15 checks); `new-visitor.cjs` ALL PASS (30 checks, 360 and 390 px); `demo-day.cjs` on Oct 18 (all cycles, 3 partner taps from an earlier cycle, reload); `taps.cjs` medians at CPU 4x: + 40 ms, digit 32, save 112, undo 56, edit 16, settings 72, previous cycle 64.
- Not done yet: an adversarial review of the branch, and Asher's test of a preview.

## Open work, in order
1. **Finish the speed audit** (Asher: "as fast as possible ... EVERYTHING MUST BE STABLE"). Done: repeat launch (area B). Open: first visit (A), taps (C), shared-budget network (D), on-device storage (E). Leads from the partial runs, **not yet verified**:
   - A: load the Supabase code when the create, join or "back" form opens, not when the button is tapped. First visit, tap to the next screen: about 2.9 s to 1.05 s on slow 3G, 1.5 s to 1.1 s on 4G (CPU 4x). This is the path classmates take if they scan the QR code and create a budget.
   - B (stability): after a deploy, a page that was already open (installed app on the welcome screen) cannot create or join until it restarts: its old Supabase file is gone. Proposed fix: on `vite:preloadError`, reload once (only under the service worker, at most once a minute). Medium risk: touches the global error path; needs review before use.
   - B, low value: cache Israel's UTC offset per day in the demo seed (about 18 ms once a day).
   - Measured, no gain (do not redo): inline SW registration, removing content-visibility, fewer rows at launch, route splitting, compile hints on all chunks.
   - Rules from before: measure first (CPU 4x, alternating runs, medians), keep only measured gains, write changes by hand (this environment refused to apply patch files written by helper agents).
2. **Adversarial review** of `git diff origin/main...claude/epic-galileo-bn5lcb`; fix what is real.
3. **Open ONE PR** from the branch, wait for the green "Tests" check, send Asher the preview link. He checks: English first, the switch to Hebrew, the demo (history, partner button).
4. **Merge only with Asher's OK**, ideally by Oct 17 (one production deploy, 15 credits). Then update this file and BUILD_LOG (notes only, no build).
5. **Oct 17 checklist:** keep-alive runs green; on the presenting phone open the demo (it is fresh each day, so no reset needed), install it to the home screen; QR codes from `presentation/` on a slide.

## Key decisions (why)
- Demo mode is always on-device, so the presentation never depends on the network. It is rebuilt each day so the numbers fit the day it is shown.
- Nothing merges to `main` without Asher's OK (normally after he tests the preview). Work on the branch, never on `main`.
- `0001_init.sql` is exactly what was run; schema changes go in new files (0004...) that Asher runs in the Supabase SQL editor.
- Seats are retaken with the personal code alone (it changes after each use), never by name. Settings shows the invite code only while the second seat is free.
- The app opens on the data this device saw last time and checks the seat with the server alongside the first reads.
- Unit tests run on on-device storage (`test.env` in vite.config.ts) and in Hebrew (`src/test/setup.ts`); English is covered by `lang.test.ts`, the smoke test and `new-visitor.cjs`.
- Never ask Asher to paste keys; `.env.local` is git-ignored; never use the service role key. `pilot/metrics.sql` reads counts and times only.

## Known issues and not built
- Demo: the back arrow reaches 3 empty cycles before January (the app allows a year back).
- Demo: changes are gone the next day or after a language switch (by design).
- iPhone: an app already on the home screen keeps the name it was added with (קופה); links open in Safari, whose storage is apart from the home-screen app.
- On open, home shows the last-seen numbers for a moment before the refresh (shared budget).
- Optional ideas stay parked in BUILD_LOG ("Suggested, not built"); Asher chose none on Oct 3.
