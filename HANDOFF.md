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

## Open problems (client review, confirmed, NOT fixed; client-only)
1. [medium] EditSheet.tsx: at 360x740 the offline/pending "blocked" message sits below the keypad; move it into the footer above Save/Delete and disable keypad/categories while blocked.
2. [medium] Settings.tsx: if the personal code fails to load, the disconnect warning omits it (lockout risk). Cache it in offlineCache; disable "כן, לנתק" until it is known.
3. [low] supabaseRepo.ts getSession: falls back to the cached session on any auth error; limit that to offline / retryable fetch errors.
4. [low] Join.tsx: the personal code rotates after every rejoin, but the UI never says so; add a notice and a line in settings.personalHelp.
5. [low] InviteShare.tsx: aria-label on a <p> is ignored; render the code aria-hidden plus an sr-only span with spaced letters.
6. [low] App.tsx offline banner (and the edit-sheet message): keep the role=status container mounted and toggle only its text.
7. [low] EditSheet.tsx: the delete confirmation stays enabled if the connection drops; disable it when blocked.
8. [low] he.ts `invite.body` is masculine singular; use 'שולחים את הקישור, ודרכו מצטרפים לקופה הזאת.'

## Next steps
1. `git pull` on `sync`; fix 1-8; `npx tsc --noEmit && npm test`; log the client review (17 confirmed: 8 fixed in 293cad1, 8 open) in BUILD_LOG Problems; commit + push.
2. Re-run on the preview with BASE=<preview url>: sync-e2e.mjs, sync-offline.mjs (RELOAD_OFFLINE=1), preview-regression.mjs in C:\Users\aholi\AppData\Local\Temp\claude\C--Users-aholi-Documents-claude-projects-pm-course-final-project\ac63e82d-bb0b-4a4b-bbfb-3046fe386f4f\scratchpad\shots (playwright-core installed there; if gone, test by hand).
3. Asher: two-phone test on the preview (create, send invite link, join, partner expense in under 2 s, airplane-mode save, rejoin with personal code).
4. If solid before 16:00: merge PR #1 (auto-deploys), check the live site, run `npm run test:rls`, update the BUILD_LOG timeline. Otherwise use the fallback above.
5. Before Sunday: open the Supabase dashboard (free tier pauses after a week idle), reset the demo on the presenting phone, put the QR codes on a slide.
