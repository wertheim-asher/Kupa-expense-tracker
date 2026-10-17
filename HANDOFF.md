# Handoff: Kupa (קופה), PM course MVP. Updated Sat 2026-10-17
Goal: shared-budget PWA for couples: log an expense in 3 taps, always see "left this cycle". **Presentation: Sun Oct 18, 2026.** Read CLAUDE.md, SPEC.md (FAST LANE first) and BUILD_LOG.md (full history) before working. Asher's chat style: every message starts with "/BL:", few words, plain English (B2), no em dashes.

## Where things are
- **Live:** https://kupa-expense-tracker.netlify.app from `main` (b6ae0e5). PR #6 (Oct 14: new demo, speed audit) and PR #7 (Oct 17: **Hebrew by default again, the name is Kupa in both languages**, English in Settings), both merged with Asher's OK after his preview tests. Checked live after PR #7: title and manifest Kupa, Hebrew, right to left; the demo on Oct 18 (all cycles, 3 partner taps, reload, no page errors).
- **Branches:** nothing open. New work: a new branch and PR.
- **Netlify credits:** the cycle reset on Oct 13; no production deploy since, then two production deploys (PR #6 and PR #7: about 30 of 300, check the Netlify dashboard). Each production deploy costs 15. Plan: one PR (deploy previews are free), one merge = 15 credits. Commits that change only notes, `pilot/` or `presentation/` skip the production build; `[skip netlify]` in a commit message skips any build.
- **Supabase** (project xblsobdgqmwvnbdhowiq): migrations 0001, 0002, 0003 applied. A daily GitHub Action (`supabase-keepalive.yml`, 05:17 UTC, secret `SUPABASE_ANON_KEY`) keeps the free project awake; runs on Oct 12 and 13 were green.
- **Pilot:** postponed by Asher on Oct 14 (tight schedule), a future step. `pilot/` is unchanged.
- **Reminders:** the Oct 15 one is off. The Oct 17 17:00 UTC (20:00 Israel) pre-presentation checklist still fires, into the old cloud session; it pushes a notification to Asher's phone.
- Two Claude sessions can work on this repo (Asher's PC and the cloud). Changes reach `main` only through PRs, with Asher's OK.

## What is on the branch (round 6)
1. **Demo for the presentation.** Starts from a new seed each day and after a language switch (reloads the same day keep changes). The current cycle (on Oct 18: Oct 10 to Nov 9, about 8% ahead of pace) plus 9 earlier cycles back to Jan 10 to Feb 9, with varied totals (Aug and Mar to Apr over budget; no amount at a category limit or repeated). Root cause of Asher's report: the stored demo was seeded once and never refreshed.
2. **"Simulate partner expense":** each tap adds the next of 20 different expenses by Dan, dated today (first: ₪84 groceries), and home switches to the current cycle first.
3. **Language:** English by default from Oct 14 to 17; since PR #7 (Oct 17) **Hebrew by default** again, English in Settings, and the app is called Kupa (Latin) in both languages. A stored choice is kept. The deck is in English (for readers abroad) with Hebrew screenshots and English callouts.
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
3. ~~PR #6~~ Asher tested the preview on his Android ("everything looks great"); his one glitch (the chosen date's ring clipped at the top) was fixed on the PR; Tests green.
4. ~~Merge~~ done Oct 14 (merge commit e0ce8cc), live checked. Then PR #7 (Hebrew default, Kupa name) merged Oct 17 (b6ae0e5), live checked.
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
