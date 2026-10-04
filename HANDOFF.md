# Handoff: Kupa (קופה), PM course MVP. Updated Sun 2026-10-04
Goal: shared-budget PWA for couples (Hebrew RTL): log an expense in 3 taps, always see "left this cycle". **Presentation: Sun Oct 18, 2026.** Read CLAUDE.md, SPEC.md (FAST LANE first) and BUILD_LOG.md (full history) before working.

## Where things are
- Live: https://kupa-expense-tracker.netlify.app from `main` (merge commit 44cc471, Oct 3). Every push to `main` auto-deploys; every PR gets a deploy preview. Asher checked the live app on Oct 3: it works.
- Merged: partner sync (PR #1); earlier-cycle history, demo "simulate partner expense", faster first open (PR #2); pilot kit, dark mode, English, one code to come back, speed work, phone smoke test (PR #3, Oct 3); lighter re-renders (PR #4, Oct 3). No open PRs.
- Two Claude sessions work on this repo (Asher's PC and a cloud session). Changes reach `main` only through PRs, so merge `main` into a branch before opening or updating a PR.
- Netlify free plan: 15 of 300 monthly credits per production deploy; at 300 every site pauses until the cycle resets on Oct 13. About 180 used by Oct 3 (estimate: half by Oct 2, plus 2 deploys). No more production deploys before Oct 13 unless something breaks; docs-only changes skip the build.
- Supabase https://xblsobdgqmwvnbdhowiq.supabase.co: migrations 0001, 0002 and 0003 applied. Keys: `.env.local` (git-ignored) and Netlify env vars.

## What the app does today
- Create a shared budget (name, budget per cycle, the day the card cycle starts), invite the partner with a link, join with a 6-character code.
- Home: what is left this cycle, days left and per-day amount, a progress bar, and the expenses grouped by day. Arrows show earlier cycles (up to a year back); expenses there can be edited.
- "+": date chips, keypad, a category tap saves (3 taps). Undo from the toast. Tap a row to edit or delete it.
- Partner sync in real time; offline saves wait with a clock icon and are sent when the connection returns.
- Coming back on a new phone: one private 12-character personal code, or the link from "שליחה לעצמי" (Send to myself). The code changes after each use.
- Settings: names, budget and cycle day, appearance (light, dark, same as device), language (Hebrew, English), CSV export, disconnect.
- Demo mode (`?demo=1`, on the device only) with a "simulate partner expense" button for the presentation.
- Speed: opens on the last-seen home and refreshes it (home in about 0.55 s instead of 1.1 to 1.5 s on a slow-phone test); a save shows as soon as the server answers.

## Verified
- Oct 3, on the real project: `npm run test:rls` 41/41 (Asher's PC), including the 5 checks for the personal code alone.
- GitHub Actions on every PR: type check, 205 unit and flow tests, Playwright phone smoke test (demo: add ₪45, undo, edit, switch to English). All green on PR #3 and PR #4.
- Fake-server suites (cloud session scratchpad, not in the repo): opening on cached data (reopen, seat taken back, save right after open, new cycle, offline), the code screens (46 checks), the iPhone note and the solo rejoin.
- Oct 2, on the live site (before PR #3): two-browser sync suite 16/16, offline suite 21/21. Scripts on Asher's PC: sync-e2e.mjs, sync-offline.mjs, preview-regression.mjs in the PC session's scratchpad\shots folder (run with BASE=<url>).
- Reviews: adversarial multi-agent reviews of the one-code change and of the speed work; real findings fixed. The review of PR #4 (2 agents, re-run on Oct 4 after a session restart) found nothing.

## Key decisions (why)
- Demo mode is always on-device, so the presentation can never break on the network.
- Nothing merges to `main` without Asher's OK (normally after he tests the preview).
- `0001_init.sql` is exactly what was run; schema changes go in new files (0004...) that Asher runs in the Supabase SQL editor.
- Seats are retaken with the personal code alone (rotates after use), never by name. Settings shows the invite code only while the second seat is free.
- The app opens on the data this phone saw last time and checks the seat with the server alongside the first reads; a seat taken back elsewhere goes to the welcome screen.
- Unit tests are pinned to on-device mode (`test.env` in vite.config.ts).

## Known issues and not built
- On an iPhone, a link opens in Safari, which keeps its own storage apart from the home-screen app; the return-link page warns about this.
- On open, home shows the last-seen numbers for a moment before the refresh.
- Optional ideas are parked in BUILD_LOG ("Suggested, not built"); Asher chose none of them on Oct 3.
- No usage data from real couples yet.

## Next steps
1. Pilot: send the invite in `pilot/README.md` to 3 to 6 couples (Oct 3 to 4); check in on Oct 8; on Oct 16 send the 3 closing questions and run `pilot/metrics.sql` in the Supabase SQL editor; numbers and quotes on slides on Oct 17.
2. Reminders set in the cloud session: Supabase check on Oct 8 and Oct 15 (10:00), the pre-presentation checklist on Oct 17 (20:00).
3. The day before Oct 18: open the Supabase dashboard (free projects pause after a week idle), reset the demo on the presenting phone, install the app to the home screen, put the QR codes from `presentation/` on a slide.
