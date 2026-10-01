# קופה (Kupa)

A shared budget app for couples, built as a Product Management course MVP. Both partners log expenses by hand in seconds and always see one number: how much is left until the next credit card billing cycle.

- **Live:** the Netlify URL is added here after the first deploy.
- **Demo:** add `?demo=1` to the URL (or tap "צפייה בדמו" on the welcome screen). `?demo=0` or "יציאה מהדמו" in settings returns to the real app.

This is the **fast-lane build**: data is stored only in this browser (`localStorage`), one device, no accounts and no sync yet. See [SPEC.md](SPEC.md) for the full plan and [BUILD_LOG.md](BUILD_LOG.md) for every decision and cut.

## Run locally

Requires Node 20 or newer.

```bash
npm install
npm run dev
```

To try it on a phone on the same Wi-Fi: `npm run dev -- --host`, then open the "Network" URL it prints.

Other scripts: `npm test` (unit and flow tests), `npm run build` (typecheck and production build), `npm run icons` (regenerate PWA icons).

## Manual device checklist

- [ ] iPhone Safari: Share → Add to Home Screen, open from the icon, full core flow ("+", type 45, tap סופר, see the number drop). The keypad and "+" sit clear of the home indicator.
- [ ] Android Chrome: install the app from the menu, full core flow. The back button closes the add sheet without saving.
- [ ] Undo: log an expense, tap "ביטול" in the toast within 5 seconds, the number goes back.
- [ ] Edit: tap an expense, change the category and the date, save. Move one to last month: it leaves the list and the totals.
- [ ] Settings: change the cycle start day, home recalculates right away. Download both CSV files and open them in Excel (Hebrew shows correctly).
- [ ] Airplane mode: the installed app opens and logging still works (everything is local in this build).
- [ ] Demo: `?demo=1` shows Noa and Dan's seeded cycle; "איפוס הדמו" restores it.

## Known limitations

- Data lives in one browser on one device. Clearing site data deletes it; export the CSV first.
- No partner sync yet (join, invite and realtime are planned for the Supabase phase).
- No bank sync, by design. Categories are fixed.
- Hebrew only in this build.
