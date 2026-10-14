# Handoff: Kupa (קופה), PM course MVP. Updated Wed 2026-10-14
Goal: shared-budget PWA for couples: log an expense in 3 taps, always see "left this cycle". **Presentation: Sun Oct 18, 2026.** Read CLAUDE.md, SPEC.md (FAST LANE first) and BUILD_LOG.md (full history) before working. Asher's chat style: every message starts with "/BL:", few words, plain English (B2), no em dashes.

## Where things are
- **Live:** https://kupa-expense-tracker.netlify.app from `main` (bed5ebb). The app code on `main` is the Oct 3 version (PR #4); after it only notes (PR #5) and the keep-alive workflow. The live app is still Hebrew by default with the old demo.
- **Branch `claude/epic-galileo-bn5lcb`:** all of round 6, pushed, PR open (see below), not merged. Commits on top of `main`: caffd05 (demo), 50da40b (log), fca5673 (English default), 85fcff8 (launch speed), 9b6f70e (handoff), then the speed audit from Asher's PC: 3085f9c (Supabase code loads when the create/join form opens), 7bad9a3 (reload once after a deploy), 832325b (no seat lookup after create/join), 491c268 (no second copy per on-device write), 5e8094b (two checks, notes).
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
5. **`scripts/checks/`:** 6 phone-browser checks (see README "Checks in a phone-sized browser").
6. **Speed audit, finished Oct 14 (Asher's PC).** First visit, tap Create to the invite screen (CPU 4x): slow 3G 3.94 to 1.81 s, 4G 1.51 to 0.79 s (code loads while the form is filled in; one round trip less). Demo save 128 to 112 ms. A page left open across a deploy reloads once instead of failing to create or join. Taps: measured, no change (all under 200 ms at CPU 4x).

## Verified on the branch (Oct 14, Asher's PC)
- Type check, 226 unit tests, the phone smoke test (English first, then the switch to Hebrew).
- `launch-cache.cjs` ALL PASS (15 checks); `new-visitor.cjs` ALL PASS (29 checks, 360 and 390 px; an earlier note said 30, the script has 29); `demo-day.cjs` on Oct 18 (all cycles, 3 partner taps, reload, no page errors); `stale-deploy.cjs` (old page creates after a deploy; with broken new files, one reload then the normal error); `first-visit.cjs` (numbers above).
- Tap times differ by machine: compare builds on the same machine only (this PC: save 112 ms, + 32, digit 32, previous cycle 80, settings 16, at CPU 4x).
- Review of the whole branch (`/code-review high`): no blocking bug; 4 low findings kept as known issues (below).
- Note: the first full unit run on this PC took 100 minutes with 1 unnamed failure; every run since passes in about 30 s.

## Open work, in order
1. ~~Finish the speed audit~~ done Oct 14 (see BUILD_LOG decisions of Oct 14). Measured, no gain (do not redo): inline SW registration, removing content-visibility, fewer rows at launch, route splitting, compile hints on all chunks. Left out on purpose: tap rendering changes (core flow, under 200 ms already), caching Israel's time offset in the demo seed (about 18 ms once a day).
2. ~~Adversarial review~~ done Oct 14: no blocking finding.
3. **PR open** from the branch: wait for the green "Tests" check, Asher tests the deploy preview: English first, the switch to Hebrew, the demo (history, partner button), and creating a budget.
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
- After a deploy, the one-time reload (only on a page opened before it) can empty a create or join form if the person typed while the old file was still failing on a slow network; a return link (`/back#CODE`) hit by it loses the code, so the link must be opened again. Before, both forms failed until a restart.
- On-device storage full and the demo open across midnight: each failed write rebuilds the demo seed (slower, not wrong).
- The reload's event wiring is checked by `stale-deploy.cjs`, not by a unit test.
- Optional ideas stay parked in BUILD_LOG ("Suggested, not built"); Asher chose none on Oct 3.
