// After a deploy: a page opened before it (welcome screen, under the service worker) while a new version goes
// live and its service worker takes over. Then "Create" on the old page must still work: the page reloads
// once onto the new version (src/app/staleCode.ts). Expect "outcome: invite screen | reloads after the deploy: 1".
// BREAK=1 also breaks the new version's Supabase files: expect one reload, then the normal error (no loop).
// Build two versions against a fake Supabase (a different key gives new file names), then run:
//   VITE_SUPABASE_URL=https://fake-project.invalid VITE_SUPABASE_ANON_KEY=fake-anon-key npx vite build --outDir /tmp/kupa-v1
//   VITE_SUPABASE_URL=https://fake-project.invalid VITE_SUPABASE_ANON_KEY=fake-anon-key-2 npx vite build --outDir /tmp/kupa-v2
//   node scripts/checks/stale-deploy.cjs /tmp/kupa-v1 /tmp/kupa-v2
// It serves the files itself like Netlify (any unknown path gets index.html with 200, the _redirects rule).
const http = require('http')
const fs = require('fs')
const path = require('path')
const { chromium } = require('playwright')
const [V1, V2] = process.argv.slice(2)
const PORT = Number(process.env.PORT || 4195)
let root = V1
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff', '.webmanifest': 'application/manifest+json', '.json': 'application/json' }
const served = []
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  let file = path.join(root, p === '/' ? 'index.html' : p)
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory() || (process.env.BREAK && root === V2 && /supabase/.test(p))) file = path.join(root, 'index.html')
  served.push(`${p} -> ${path.basename(file)}`)
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': p === '/sw.js' || file.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable' })
  fs.createReadStream(file).pipe(res)
})
const now = '2026-10-14T08:00:00.000Z'
const session = (uid) => ({ access_token: 'x.y.z', refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: uid, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: now, is_anonymous: true } })
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
    await route.fulfill({ status, contentType: 'application/json', body: body === null ? '' : JSON.stringify(body) }).catch(() => {})
  })
}
;(async () => {
  await new Promise((r) => server.listen(PORT, r))
  const base = `http://localhost:${PORT}`
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, serviceWorkers: 'allow' })
  await backend(ctx, {})
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  let loads = 0
  page.on('load', () => loads++)
  await page.goto(base + '/')
  await page.getByRole('button', { name: 'Start a shared budget' }).waitFor()
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 30000 })
  const v1Entry = await page.evaluate(() => [...document.scripts].map((s) => s.src).find((s) => s.includes('/assets/index-')))
  await page.evaluate(() => { window.__swaps = 0; navigator.serviceWorker.addEventListener('controllerchange', () => window.__swaps++) })
  console.log('v1 page open on welcome, controlled by the service worker; entry', v1Entry)
  // Deploy v2: new files only (Netlify's atomic deploy), then another visit finds the new service worker.
  root = V2
  const other = await ctx.newPage()
  await other.goto(base + '/')
  await page.waitForFunction(() => window.__swaps > 0, null, { timeout: 30000 })
  await other.close()
  console.log('v2 deployed; its service worker took over the old page')
  const loadsBefore = loads
  // On the old page: open the form and create a budget.
  await page.getByRole('button', { name: 'Start a shared budget' }).click()
  await page.getByLabel("What's your name?").waitFor()
  await page.waitForTimeout(3000)
  await page.getByLabel("What's your name?").fill('Noa')
  await page.getByLabel('How much do you want to spend per cycle?').fill('9000')
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  const outcome = await Promise.race([
    page.getByText('Now invite your partner').waitFor({ timeout: 15000 }).then(() => 'invite screen'),
    page.getByText("Couldn't create the budget").waitFor({ timeout: 15000 }).then(() => 'ERROR: could not create'),
  ]).catch(() => 'neither within 15 s')
  const entryNow = await page.evaluate(() => [...document.scripts].map((s) => s.src).find((s) => s.includes('/assets/index-')))
  console.log('outcome:', outcome, '| reloads after the deploy:', loads - loadsBefore, '| entry now', entryNow === v1Entry ? 'v1 (old)' : 'v2 (new)')
  console.log('requests for old chunks served index.html:', served.filter((s) => /supabase/.test(s) && s.endsWith('index.html')))
  if (errors.length) console.log('page errors:', errors)
  await browser.close()
  server.close()
})().catch((e) => { console.error(e); process.exit(1) })
