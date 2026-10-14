// First visit, create a budget: time from the tap on "Create" to the invite screen, comparing two builds
// (A, B) in alternating runs. A slow-phone stand-in (CPU 4x), the network slowed by Chrome (slow3g: 400 ms,
// 50 KB/s; 4g: 150 ms, 200 KB/s), and a fake Supabase that adds the same delay to each request.
// The service worker is off unless SW=1 (with it on, the code may already be on the phone before the tap).
// Build each version against a fake Supabase (requests are answered by this script) and serve both:
//   VITE_SUPABASE_URL=https://fake-project.invalid VITE_SUPABASE_ANON_KEY=fake-anon-key npx vite build --outDir /tmp/kupa-a
//   npx vite preview --outDir /tmp/kupa-a --port 4191   (and the other build on 4192)
//   A=http://localhost:4191 B=http://localhost:4192 PROFILE=4g RUNS=5 node scripts/checks/first-visit.cjs
// (Windows PowerShell: $env:VITE_SUPABASE_URL="https://fake-project.invalid"; $env:VITE_SUPABASE_ANON_KEY="fake-anon-key" first.)
const { chromium } = require('playwright')
const A = process.env.A || 'http://localhost:4191'
const B = process.env.B || 'http://localhost:4192'
const RUNS = Number(process.env.RUNS || 5)
const THINK = Number(process.env.THINK || 4000)
const PROFILES = {
  slow3g: { latency: 400, downloadThroughput: 50_000, uploadThroughput: 50_000 },
  '4g': { latency: 150, downloadThroughput: 200_000, uploadThroughput: 94_000 },
}
const P = PROFILES[process.env.PROFILE || 'slow3g']
const now = '2026-10-14T08:00:00.000Z'
const session = (uid) => ({
  access_token: 'x.y.z', refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: { id: uid, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: now, is_anonymous: true },
})
async function backend(ctx, state) {
  await ctx.route('https://fake-project.invalid/**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const single = (req.headers()['accept'] || '').includes('vnd.pgrst.object')
    let status = 200
    let body = null
    if (url.pathname.startsWith('/auth/v1/signup')) body = session('u1')
    else if (url.pathname === '/auth/v1/user') body = session('u1').user
    else if (url.pathname === '/rest/v1/rpc/create_household') { state.member = true; body = { household_id: 'h1', member_id: 'm1', invite_code: 'ABC234' } }
    else if (url.pathname === '/rest/v1/members') body = url.searchParams.get('user_id') ? (state.member ? [{ id: 'm1', household_id: 'h1' }] : []) : [{ id: 'm1', household_id: 'h1', display_name: 'Noa', color: 'teal', created_at: now }]
    else if (url.pathname === '/rest/v1/households') { const h = { id: 'h1', budget_agorot: 900000, cycle_start_day: 10, invite_code: 'ABC234', created_at: now, updated_at: now }; body = single ? h : [h] }
    else if (url.pathname === '/rest/v1/member_secrets') body = single ? { personal_code: 'ABCDEFGHJKMN' } : [{ personal_code: 'ABCDEFGHJKMN' }]
    else if (url.pathname === '/rest/v1/expenses') body = []
    else if (url.pathname === '/rest/v1/events') status = 201
    else { status = 404; body = { message: 'not mocked' } }
    if (req.method() !== 'OPTIONS') await new Promise((r) => setTimeout(r, P.latency))
    await route.fulfill({ status, contentType: 'application/json', body: body === null ? '' : JSON.stringify(body) }).catch(() => {})
  })
}
async function once(browser, base) {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, serviceWorkers: process.env.SW ? 'allow' : 'block' })
  await ctx.addInitScript(() => {
    window.__t = {}
    document.addEventListener('click', (e) => { if (e.target.closest?.('button[type=submit]')) window.__t.tap = performance.now() }, true)
    new MutationObserver(() => {
      if (!window.__t.invite && location.pathname === '/invite' && document.body.innerText.includes('Now invite your partner')) window.__t.invite = performance.now()
    }).observe(document, { childList: true, subtree: true, characterData: true })
  })
  await backend(ctx, {})
  const page = await ctx.newPage()
  const cdp = await ctx.newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  await cdp.send('Network.enable')
  await cdp.send('Network.emulateNetworkConditions', { offline: false, ...P })
  const t0 = Date.now()
  await page.goto(base + '/')
  await page.getByRole('button', { name: 'Start a shared budget' }).waitFor({ timeout: 60000 })
  const welcome = Date.now() - t0
  await page.getByRole('button', { name: 'Start a shared budget' }).click()
  await page.getByLabel("What's your name?").waitFor()
  const formOpen = Date.now()
  await page.getByLabel("What's your name?").fill('Noa')
  await page.getByLabel('How much do you want to spend per cycle?').fill('9000')
  const left = THINK - (Date.now() - formOpen)
  if (left > 0) await page.waitForTimeout(left)
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await page.getByText('Now invite your partner').waitFor({ timeout: 60000 })
  const t = await page.evaluate(() => window.__t)
  await ctx.close()
  return { welcome, tapToInvite: Math.round(t.invite - t.tap) }
}
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]
;(async () => {
  const browser = await chromium.launch()
  const res = { A: [], B: [] }
  for (let i = 0; i < RUNS; i++) {
    for (const [k, base] of i % 2 ? [['B', B], ['A', A]] : [['A', A], ['B', B]]) res[k].push(await once(browser, base))
  }
  await browser.close()
  console.log(`profile ${process.env.PROFILE || 'slow3g'}, think ${THINK} ms, SW ${process.env.SW ? 'allowed' : 'blocked'}, runs ${RUNS}`)
  for (const k of ['A', 'B']) {
    const tap = res[k].map((r) => r.tapToInvite)
    const w = res[k].map((r) => r.welcome)
    console.log(`${k}: tap Create -> invite median ${median(tap)} ms  [${tap.join(', ')}]   welcome ${median(w)} ms`)
  }
})().catch((e) => { console.error(e); process.exit(1) })
