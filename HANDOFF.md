# Handoff: Kupa (קופה), PM course MVP. Fri 2026-10-02, 07:15 Israel time
Goal: shared-budget PWA for couples (Hebrew RTL): log an expense in 3 taps, always see "left this cycle". Live by Fri Oct 2 evening; presentation Sun Oct 4. Read CLAUDE.md, SPEC.md (FAST LANE first) and BUILD_LOG.md (full history) before working.

## Where things are
- Live (`main`, on-device only): https://kupa-expense-tracker.netlify.app. Every push to `main` auto-deploys to production.
- Partner sync: branch `sync`, PR #1 https://github.com/wertheim-asher/Kupa-expense-tracker/pull/1, preview https://deploy-preview-1--kupa-expense-tracker.netlify.app (rebuilds on every push).
- Supabase https://xblsobdgqmwvnbdhowiq.supabase.co: 0001 + 0002 applied by Asher; `npm run test:rls` passes 36/36. Keys: `.env.local` (git-ignored) and Netlify env vars.

## Done
- Fast-lane app live and verified (core flow, edit, settings, CSV, demo, PWA); Asher's feedback round 1 shipped; class QR codes in `presentation/`.
- On `sync` (code as of 293cad1): Supabase repo, anonymous auth only on create/join, join/invite, realtime, 12-char personal-code rejoin, offline outbox + cache + banner, 8 offline data-integrity fixes.
- Verified on the preview: two-browser sync suite (partner sees an expense in ~1.1-1.3 s), offline suite incl. offline reload, regression at 360/390 px; 167 unit tests pass.

## Key decisions (why)
- Never merge PR #1 before Asher's two-phone test. Cutoff Fri 16:00; fallback: close the PR, keep `main`, add the demo "simulate partner expense" button (~30 min).
- Demo mode is always on-device, so the presentation cannot break on the network.
- `0001_init.sql` is exactly what was run; schema changes go in a new file (0003...) that Asher must run. The open problems below need no SQL.
- Seats are retaken with invite code + private personal code, not by name (name matching let anyone with the invite code take a seat).
- Netlify badge and preview Drawer are off (they covered taps). Unit tests are pinned to on-device mode (`test.env` in vite.config.ts).

## Files changed on `sync` vs `main` (31)
supabase/migrations/{0001_init,0002_harder_codes}.sql; src/data/{supabase,supabaseRepo,offline,mode,repo,localStoreRepo}.ts + offline.test.ts; src/features/onboarding/{Join,Invite,InviteShare,Create,Welcome}.tsx + Join.test.ts; src/features/{settings/Settings,edit-expense/EditSheet,home/Home}.tsx; src/app/{App,DataProvider}.tsx; src/ui/useOnline.ts; src/i18n/he.ts; src/domain/types.ts; src/vite-env.d.ts; scripts/test-rls.mjs; vite.config.ts; package*.json; SETUP.md; README.md; BUILD_LOG.md.

## Client review: fixed on 2026-10-02 (10:30 Israel time)
All 8 open problems are fixed, plus one found while checking: "Couldn't save" after a failed edit was also hidden under the keypad at 360x740. Details in BUILD_LOG (Decisions and Problems, 2026-10-02). 172 unit tests pass; headless checks with a fake server at 360x740 and 390x844 pass.
- The work is on branch `claude/epic-galileo-bn5lcb` (= `sync` + 1 commit). `sync` and the preview get it only after Asher OKs a fast-forward push to `sync`.
- E2E scripts: the visible invite code is now `p[aria-hidden=true]`, with a separate `sr-only` span for screen readers. A script that reads the code from the page text must read the `<p>`.
- Known, not fixed: at 375x667 (iPhone SE) the edit sheet's date field is under the keypad until the area above it is scrolled (same on `main`).

## Next steps
1. Done: fixes 1-8, tests, BUILD_LOG. Left: fast-forward `sync` to the fix commit (needs Asher's OK), so the preview rebuilds.
2. Re-run on the preview with BASE=<preview url>: sync-e2e.mjs, sync-offline.mjs (RELOAD_OFFLINE=1), preview-regression.mjs in C:\Users\aholi\AppData\Local\Temp\claude\C--Users-aholi-Documents-claude-projects-pm-course-final-project\ac63e82d-bb0b-4a4b-bbfb-3046fe386f4f\scratchpad\shots (playwright-core installed there; if gone, test by hand).
3. Asher: two-phone test on the preview (create, send invite link, join, partner expense in under 2 s, airplane-mode save, rejoin with personal code).
4. If solid before 16:00: merge PR #1 (auto-deploys), check the live site, run `npm run test:rls`, update the BUILD_LOG timeline. Otherwise use the fallback above.
5. Before Sunday: open the Supabase dashboard (free tier pauses after a week idle), reset the demo on the presenting phone, put the QR codes on a slide.
