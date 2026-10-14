// Opening on cached data (shared budget): speed and the risky cases, against a fake Supabase with
// latency, on a slow-phone stand-in (CPU 4x): reopen, seat taken back elsewhere, a save right after
// open, the first open after the cache-first update, a new cycle, offline. Expect ALL PASS.
// Build against a fake Supabase (requests are answered by this script), serve, run:
//   VITE_SUPABASE_URL=https://fake-project.invalid VITE_SUPABASE_ANON_KEY=fake-anon-key npx vite build --outDir /tmp/kupa-fake
//   npx vite preview --outDir /tmp/kupa-fake --port 4191
//   BASE=http://localhost:4191 node scripts/checks/launch-cache.cjs
// (Windows PowerShell: $env:VITE_SUPABASE_URL="https://fake-project.invalid"; $env:VITE_SUPABASE_ANON_KEY="fake-anon-key" first.)
const { chromium } = require('playwright')
const BASE = process.env.BASE || 'http://localhost:4191'
const results = []
const ok = (n, c, x = '') => results.push(`${c ? 'PASS' : 'FAIL'} ${n}${x ? '  ' + x : ''}`)
const now = '2026-10-01T08:00:00.000Z'

// The current cycle for start day 10, Israel time, as the app computes it.
function cycleKey() {
  const t = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date())
  let [y, m, d] = t.split('-').map(Number)
  if (d < 10) m -= 1
  if (m === 0) { m = 12; y -= 1 }
  const s = new Date(Date.UTC(y, m - 1, 10)), e = new Date(Date.UTC(y, m, 10))
  const iso = (x) => x.toISOString().slice(0, 10)
  return { from: iso(s), to: iso(e), today: t }
}
const K = cycleKey()
const row = (id, member, amount, spentOn, createdAt) => ({ id, household_id: 'h1', member_id: member, amount_agorot: amount, category: 'groceries', spent_on: spentOn, log_duration_ms: 1000, created_at: createdAt, updated_at: createdAt, deleted_at: null })
const toExpense = (r) => ({ id: r.id, householdId: r.household_id, memberId: r.member_id, amountAgorot: r.amount_agorot, category: r.category, spentOn: r.spent_on, logDurationMs: r.log_duration_ms, createdAt: r.created_at, updatedAt: r.updated_at, deletedAt: null })
const OLD = row('e-old', 'm1', 10000, K.from, now)
const PARTNER = row('e-partner', 'm2', 8400, K.today, new Date().toISOString())
const household = { id: 'h1', budget_agorot: 900000, cycle_start_day: 10, invite_code: 'ABC234', created_at: now, updated_at: now }
const members = [
  { id: 'm1', household_id: 'h1', display_name: 'נועה', color: 'teal', created_at: now },
  { id: 'm2', household_id: 'h1', display_name: 'דן', color: 'violet', created_at: now },
]
const auth = { access_token: 'x.y.z', refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: 'u1', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: now, is_anonymous: true } }

function cache({ withUserId = true, withRange = true } = {}) {
  return {
    session: { householdId: 'h1', memberId: 'm1' },
    ...(withUserId ? { sessionUserId: 'u1' } : {}),
    household: { id: 'h1', budgetAgorot: 900000, cycleStartDay: 10, inviteCode: 'ABC234', createdAt: now, updatedAt: now },
    members: members.map((m) => ({ id: m.id, householdId: 'h1', displayName: m.display_name, color: m.color, createdAt: now })),
    expenses: withRange ? { [`${K.from}|${K.to}`]: [toExpense(OLD)] } : {},
  }
}

async function open(browser, { latency = 300, seatGone = false, offline = false, cacheOpts = {} } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, locale: 'he-IL', serviceWorkers: 'block' })
  await ctx.addInitScript(({ c, auth, offline }) => {
    window.__t = { errorSeen: false, saveFailed: false }
    new MutationObserver(() => {
      const text = document.body?.innerText ?? ''
      if (text.includes('לא הצלחנו לטעון')) window.__t.errorSeen = true
      if (text.includes('לא הצלחנו לשמור')) window.__t.saveFailed = true
      if (!window.__t.home && document.querySelector('button[aria-label="הוספת הוצאה"]')) window.__t.home = performance.now()
      if (!window.__t.partner && text.includes('84')) window.__t.partner = performance.now()
      if (!window.__t.welcome && location.pathname === '/welcome') window.__t.welcome = performance.now()
    }).observe(document, { childList: true, subtree: true, characterData: true })
    if (offline) Object.defineProperty(Navigator.prototype, 'onLine', { configurable: true, get: () => false })
    if (sessionStorage.getItem('seeded')) return
    sessionStorage.setItem('seeded', '1')
    localStorage.clear()
    localStorage.setItem('kupa.auth', JSON.stringify(auth))
    localStorage.setItem('kupa.cache.v1', JSON.stringify(c))
    // The checks read Hebrew text (English is the default since 2026-10-14).
    localStorage.setItem('kupa.lang', 'he')
  }, { c: cache(cacheOpts), auth, offline })
  const log = []
  const server = { expenses: [PARTNER, OLD] }
  await ctx.route('https://fake-project.invalid/**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const single = (req.headers()['accept'] || '').includes('vnd.pgrst.object')
    log.push(`${req.method()} ${url.pathname}${url.searchParams.get('user_id') ? '?user_id' : ''}`)
    let status = 200
    let body = []
    if (url.pathname === '/rest/v1/members') body = url.searchParams.get('user_id') ? (seatGone ? [] : [{ id: 'm1', household_id: 'h1' }]) : seatGone ? [] : members
    else if (url.pathname === '/rest/v1/households') {
      if (seatGone) { status = single ? 406 : 200; body = single ? { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' } : [] }
      else body = single ? household : [household]
    } else if (url.pathname === '/rest/v1/expenses' && req.method() === 'GET') body = seatGone ? [] : server.expenses
    else if (url.pathname === '/rest/v1/expenses' && req.method() === 'POST') {
      const input = JSON.parse(req.postData())
      const r = { ...(Array.isArray(input) ? input[0] : input), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), deleted_at: null }
      server.expenses = [r, ...server.expenses]
      status = 201
      body = single ? r : [r]
    } else if (url.pathname === '/rest/v1/member_secrets') body = single ? { personal_code: 'ABCDEFGHJKMN' } : [{ personal_code: 'ABCDEFGHJKMN' }]
    else if (url.pathname === '/rest/v1/events') status = 201
    else if (url.pathname === '/auth/v1/user') body = auth.user
    await new Promise((r) => setTimeout(r, latency))
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }).catch(() => {})
  })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  const cdp = await ctx.newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  await page.goto(BASE + '/')
  return { ctx, page, log, errors, server }
}
const t = (page) => page.evaluate(() => window.__t)

;(async () => {
  const browser = await chromium.launch()

  // A. Reopen: home from the cache at once, the partner's newer expense with the refresh.
  {
    const { ctx, page, log, errors } = await open(browser, { latency: 300 })
    await page.getByText('84', { exact: false }).first().waitFor({ timeout: 10000 })
    await page.waitForTimeout(300)
    const x = await t(page)
    ok('A reopen: home shows before any server answer', x.home !== undefined && x.home < x.partner - 250, `home ${Math.round(x.home)} ms, partner expense ${Math.round(x.partner)} ms`)
    const lookupIdx = log.indexOf('GET /rest/v1/members?user_id')
    const dataIdx = log.findIndex((l) => l.startsWith('GET /rest/v1/households'))
    ok('A reopen: seat check goes out with the first reads (logged in request order)', lookupIdx >= 0 && dataIdx >= 0, log.slice(0, 6).join(' | '))
    ok('A reopen: no error, no page errors', !x.errorSeen && errors.length === 0, errors.join(' | '))
    await ctx.close()
  }

  // B. The seat was taken back on another device: cached home, then welcome, never the error screen.
  {
    const { ctx, page, errors } = await open(browser, { latency: 300, seatGone: true })
    await page.waitForURL('**/welcome', { timeout: 10000 })
    await page.waitForTimeout(500)
    const x = await t(page)
    ok('B seat taken back: welcome, with no error screen on the way', !x.errorSeen && x.welcome !== undefined, `home ${Math.round(x.home ?? -1)} ms, welcome ${Math.round(x.welcome)} ms`)
    ok('B seat taken back: cache cleared of that seat', await page.evaluate(() => !JSON.parse(localStorage.getItem('kupa.cache.v1') || '{}').session), '')
    ok('B no page errors', errors.length === 0, errors.join(' | '))
    await ctx.close()
  }

  // C. A save tapped right after open, before the server has answered anything.
  {
    const { ctx, page, log, errors } = await open(browser, { latency: 400 })
    await page.getByRole('button', { name: 'הוספת הוצאה' }).click()
    await page.getByRole('button', { name: '4', exact: true }).click()
    await page.getByRole('button', { name: '5', exact: true }).click()
    const tapped = await page.evaluate(() => performance.now())
    await page.getByRole('button', { name: 'סופר' }).click()
    await page.getByRole('dialog').waitFor({ state: 'detached', timeout: 10000 })
    await page.getByText('נשמר ✓', { exact: false }).waitFor({ timeout: 5000 })
    const x = await t(page)
    ok('C early save: saved, with no error', !x.saveFailed && log.includes('POST /rest/v1/expenses'), `category tapped at ${Math.round(tapped)} ms`)
    ok('C no page errors', errors.length === 0, errors.join(' | '))
    await ctx.close()
  }

  // D. First open after this version (cache without the login id): the old path, which then stores it.
  {
    const { ctx, page, errors } = await open(browser, { latency: 150, cacheOpts: { withUserId: false } })
    await page.getByText('84', { exact: false }).first().waitFor({ timeout: 10000 })
    await page.waitForTimeout(400)
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('kupa.cache.v1')).sessionUserId)
    ok('D first open after the update: works and stores the login id', stored === 'u1', String(stored))
    ok('D no page errors', errors.length === 0, errors.join(' | '))
    await ctx.close()
  }

  // E. A new cycle since the last visit (its list not cached): loading first, then home, as before.
  {
    const { ctx, page, errors } = await open(browser, { latency: 300, cacheOpts: { withRange: false } })
    await page.getByText('84', { exact: false }).first().waitFor({ timeout: 10000 })
    const x = await t(page)
    ok('E new cycle: home appears with the server data (no cached list)', Math.abs(x.home - x.partner) < 120, `home ${Math.round(x.home)}, partner ${Math.round(x.partner)}`)
    ok('E no page errors', errors.length === 0, errors.join(' | '))
    await ctx.close()
  }

  // F. Offline open: home from the cache at once.
  {
    const { ctx, page, errors } = await open(browser, { latency: 300, offline: true })
    await page.getByRole('button', { name: 'הוספת הוצאה' }).waitFor({ timeout: 10000 })
    const x = await t(page)
    ok('F offline open: home from the cache', x.home !== undefined && !x.errorSeen, `home ${Math.round(x.home)} ms`)
    ok('F offline banner shown', (await page.getByText('אין חיבור', { exact: false }).count()) >= 1)
    ok('F no page errors', errors.length === 0, errors.join(' | '))
    await ctx.close()
  }

  await browser.close()
  console.log(results.join('\n'))
  console.log(results.some((r) => r.startsWith('FAIL')) ? '\nSOME FAILED' : '\nALL PASS')
})().catch((e) => { console.error(e); process.exit(1) })
