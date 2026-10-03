# Handoff: Kupa (קופה), PM course MVP. Updated Fri 2026-10-02
Goal: shared-budget PWA for couples (Hebrew RTL): log an expense in 3 taps, always see "left this cycle". **Presentation: Sun Oct 18, 2026** (Asher moved it from Oct 4 on Oct 2; the old "live by Fri Oct 2" deadline and its 16:00 cutoff no longer apply). Read CLAUDE.md, SPEC.md (FAST LANE first) and BUILD_LOG.md (full history) before working.

## Where things are
- Live: https://kupa-expense-tracker.netlify.app from `main`. Every push to `main` auto-deploys; every PR gets a deploy preview.
- Merged: partner sync (PR #1); earlier-cycle history, demo "simulate partner expense", faster first open (PR #2).
- PR #3 (pilot kit in `pilot/`, dark mode with a 3-way setting, English, one code to come back with a "send to myself" link, speed work, Playwright smoke test, GitHub Actions tests on every PR, docs-only pushes skip the production build): Asher tested the one-code preview and asked for the speed work and a merge from the cloud while his PC was off.
- Two Claude sessions work on this repo (Asher's PC and a cloud session). Changes reach `main` only through PRs, so merge `main` into a branch before opening or updating a PR.
- Netlify free plan: 15 of 300 monthly credits per production deploy; at 300 every site pauses until the cycle resets (Oct 13). Half was used by Oct 2. Ship in batches.
- Supabase https://xblsobdgqmwvnbdhowiq.supabase.co: migrations 0001, 0002 and 0003 applied (Asher ran 0003 on Oct 2, evening). Keys: `.env.local` (git-ignored) and Netlify env vars.

## Verified on the live site (Oct 2, after both merges)
- `npm run test:rls` 36/36; two-browser sync suite 16/16 (a partner sees a new expense in about 1 s); offline suite 21/21 (offline save, undo, reload, personal code offline, disconnect refused while unsent).
- Asher tested both PR previews on two phones before merging.
- E2E scripts (not in the repo): sync-e2e.mjs, sync-offline.mjs, preview-regression.mjs in C:\Users\aholi\AppData\Local\Temp\claude\C--Users-aholi-Documents-claude-projects-pm-course-final-project\ac63e82d-bb0b-4a4b-bbfb-3046fe386f4f\scratchpad\shots (playwright-core installed there). Run with BASE=<url>; RELOAD_OFFLINE=1 for the offline reload check.

## Key decisions (why)
- Demo mode is always on-device, so the presentation can never break on the network.
- Nothing merges to `main` until Asher has tested the PR's preview (his safety net).
- `0001_init.sql` is exactly what was run; schema changes go in new files (0003...) that Asher runs in the Supabase SQL editor.
- Seats are retaken with a private 12-character personal code alone (since 0003; it rotates after use), never by name. Settings shows the invite code only while the second seat is free.
- Netlify badge and preview Drawer are off (they covered taps). Unit tests are pinned to on-device mode (`test.env` in vite.config.ts).

## Known issues and not built
- iPhone SE size: fixed on Oct 2 (shorter keypad keys and a tighter sheet on short screens); the edit sheet shows all categories and the date at 375x667 and at 360x646 (Asher's Android in Chrome).
- English, dark mode and the Playwright smoke test: built in PR #3 (not merged yet).
- No usage data from real couples yet. The pilot kit (`pilot/README.md`) has the invite, the closing questions and `metrics.sql` for the three assumptions.

## Next steps
1. After PR #3 is merged: Asher runs `git pull`, then `npm run test:rls` (41 checks), and opens the live app on his phone (it now opens on the last-seen home and refreshes it).
2. Pilot (Asher picked it on Oct 2): send the invite to 3 to 6 couples on Oct 3 to 4; check in on Oct 8; on Oct 16 send the closing questions and run `pilot/metrics.sql` in the Supabase SQL editor; numbers and quotes on slides on Oct 17.
3. Reminders are set in the cloud session: Supabase check on Oct 8 and Oct 15 (10:00), the pre-presentation checklist on Oct 17 (20:00).
4. The day before Oct 18: open the Supabase dashboard (free projects pause after a week idle), reset the demo on the presenting phone, install the app to the home screen, put the QR codes from `presentation/` on a slide.
