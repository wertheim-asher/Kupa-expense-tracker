# Handoff: Kupa (קופה), PM course MVP. Updated Fri 2026-10-02
Goal: shared-budget PWA for couples (Hebrew RTL): log an expense in 3 taps, always see "left this cycle". **Presentation: Sun Oct 18, 2026** (Asher moved it from Oct 4 on Oct 2; the old "live by Fri Oct 2" deadline and its 16:00 cutoff no longer apply). Read CLAUDE.md, SPEC.md (FAST LANE first) and BUILD_LOG.md (full history) before working.

## Where things are
- Live: https://kupa-expense-tracker.netlify.app from `main`. Every push to `main` auto-deploys; every PR gets a deploy preview.
- Merged: partner sync (PR #1); earlier-cycle history, demo "simulate partner expense", faster first open (PR #2). No open PRs.
- Supabase https://xblsobdgqmwvnbdhowiq.supabase.co: migrations 0001 + 0002 applied. Keys: `.env.local` (git-ignored) and Netlify env vars.

## Verified on the live site (Oct 2, after both merges)
- `npm run test:rls` 36/36; two-browser sync suite 16/16 (a partner sees a new expense in about 1 s); offline suite 21/21 (offline save, undo, reload, personal code offline, disconnect refused while unsent).
- Asher tested both PR previews on two phones before merging.
- E2E scripts (not in the repo): sync-e2e.mjs, sync-offline.mjs, preview-regression.mjs in C:\Users\aholi\AppData\Local\Temp\claude\C--Users-aholi-Documents-claude-projects-pm-course-final-project\ac63e82d-bb0b-4a4b-bbfb-3046fe386f4f\scratchpad\shots (playwright-core installed there). Run with BASE=<url>; RELOAD_OFFLINE=1 for the offline reload check.

## Key decisions (why)
- Demo mode is always on-device, so the presentation can never break on the network.
- Nothing merges to `main` until Asher has tested the PR's preview (his safety net).
- `0001_init.sql` is exactly what was run; schema changes go in new files (0003...) that Asher runs in the Supabase SQL editor.
- Seats are retaken with the invite code plus a private 12-character personal code (it rotates after use), never by name.
- Netlify badge and preview Drawer are off (they covered taps). Unit tests are pinned to on-device mode (`test.env` in vite.config.ts).

## Known issues and not built
- iPhone SE (375x667): the edit sheet's date field sits under the keypad until the area above it is scrolled.
- From SPEC, still not built (P2): English toggle, dark mode, a Playwright smoke test in the repo.
- No usage data from real couples yet (only test data), so the three assumptions in SPEC section 1 are still unmeasured.

## Next steps
1. Asher picks what the two weeks are for (options proposed on Oct 2: a real-couples pilot with assumption metrics, the remaining P2s, polish, presentation prep). Update this file with the plan.
2. The day before Oct 18: open the Supabase dashboard (free projects pause after a week idle), reset the demo on the presenting phone, install the app to the home screen, put the QR codes from `presentation/` on a slide.
