# קופה (Kupa)

A shared budget app for couples, built as a Product Management course MVP. Both partners log expenses by hand in seconds and always see one number: how much is left until the next credit card billing cycle.

- **Live:** https://kupa-expense-tracker.netlify.app
- **Code:** https://github.com/wertheim-asher/Kupa-expense-tracker (private)
- **Demo:** add `?demo=1` to the URL (or tap "צפייה בדמו" on the welcome screen). `?demo=0` or "יציאה מהדמו" in settings returns to the real app. The demo always runs on the phone only, so it works without internet.

Partner sync (Supabase) is live since October 2, 2026. Hebrew is the default; English and dark mode are in too (Settings, and the phone's dark setting). See [SPEC.md](SPEC.md) for the plan, [BUILD_LOG.md](BUILD_LOG.md) for every decision, problem and cut, and [pilot/](pilot/README.md) for the pilot with real couples.

## How it works

- **Two modes for the real app.** With the two Supabase variables set (see [SETUP.md](SETUP.md)), budgets are shared: one partner creates, sends an invite link, the other joins, and each sees the other's expenses live. Without them, everything stays in this browser (the fast-lane build).
- **No accounts.** Each phone gets an anonymous user when someone creates or joins a budget. Every table has row level security: a household can only ever see and change its own data (`npm run test:rls`).
- **Back on a new phone.** Settings shows a private 12-character personal code. The invite code plus the personal code takes your seat back with all your history.
- **Offline.** Expenses saved without a connection appear at once with a small clock icon and are sent when the connection returns, never twice. Edit and delete wait for the connection.

## Run locally

Requires Node 20 or newer.

```bash
npm install
npm run dev
```

To try it on a phone on the same Wi-Fi: `npm run dev -- --host`, then open the "Network" URL it prints.

For partner sync locally, put the two values from [SETUP.md](SETUP.md) in `.env.local`.

Other scripts: `npm test` (unit and flow tests, always on-device), `npm run test:e2e` (the phone smoke test, below), `npm run test:rls` (security checks against the real Supabase project), `npm run build` (typecheck and production build), `npm run icons` (regenerate PWA icons).

### Phone smoke test

`npm run test:e2e` builds the app, opens it on an iPhone 13 screen (in Chromium) and goes through the core flow in demo mode: add ₪45, undo, edit a category, switch to English (SPEC section 14). The first time on a computer, install its browser once: `npx playwright install chromium`. On GitHub it runs on every pull request, together with the type check and the unit tests (`.github/workflows/tests.yml`); merge only when it is green.

## Deploy

Every push to `main` builds and deploys the live site on Netlify automatically, except a push that only changes notes, the pilot kit or the QR codes (`ignore` in `netlify.toml`). Every pull request gets its own preview link, which is free. On Netlify's free plan each production deploy costs 15 of 300 monthly credits, and at 300 the site pauses until the next cycle, so changes reach the live site in batches. To deploy by hand:

```bash
npx netlify-cli login
npm run build
npx netlify-cli deploy --prod --no-build --dir dist --site kupa-expense-tracker
```

Site settings in place: site protection off (public), "Built with Netlify" badge off and the deploy-preview Drawer off (both covered part of the app), manifest served as `application/manifest+json` (see `netlify.toml`), and `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` set for all deploy contexts.

Database changes live in `supabase/migrations/`, run in order in the Supabase SQL editor (see [SETUP.md](SETUP.md)).

## Manual device checklist

- [ ] iPhone Safari: Share → Add to Home Screen, open from the icon, full core flow ("+", type 45, tap סופר, see the number drop). The keypad and "+" sit clear of the home indicator.
- [ ] Android Chrome: install the app from the menu, full core flow. The back button closes the add sheet without saving.
- [ ] Two phones in one household: create on one, send the invite, join on the other; an expense on one appears on the other within 2 seconds.
- [ ] Airplane mode on one phone: log an expense (clock icon), turn airplane mode off, it reaches the other phone once.
- [ ] Undo: log an expense, tap "ביטול" in the toast within 5 seconds, the number goes back.
- [ ] Edit: tap an expense, change the category and the date, save. Move one to last month: it leaves the list and the totals.
- [ ] Settings: change the cycle start day, home recalculates right away. Download both CSV files and open them in Excel (Hebrew shows correctly).
- [ ] Demo: `?demo=1` shows Noa and Dan's seeded cycle; "איפוס הדמו" restores it.
- [ ] History: the arrow next to the cycle dates shows the previous cycle; edit an expense there; "חזרה למחזור הנוכחי" returns.
- [ ] English: Settings → English. The app turns left to right; "עברית" switches back.
- [ ] Dark mode: turn on the phone's dark mode; every screen stays readable.

## Known limitations

- Sessions are anonymous and tied to one browser on one phone. Clearing site data signs that phone out; the invite code plus your personal code brings you back.
- At most 2 members per household. There is no way to remove a partner.
- Anyone who has a member's live phone (or both codes) can use that seat; keep the personal code private.
- Basic security for an MVP: row level security on every table, no rate limiting, no captcha.
- Free Supabase projects pause after a week without activity; open the dashboard the day before a demo.
- No bank sync, by design. Categories are fixed. Hebrew only in this build.
