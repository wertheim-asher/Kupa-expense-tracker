// Hebrew by default, named Kupa: a new visitor's screens on a phone (360 and 390 px), against a fake Supabase:
// welcome, create, invite, home, add, settings, join, the way back, then the switch to English (kept
// after a reload), and the manifest. Expect ALL PASS. OUT=<folder> also saves screenshots.
// Build against a fake Supabase (requests are answered by this script), serve, run:
//   VITE_SUPABASE_URL=https://fake-project.invalid VITE_SUPABASE_ANON_KEY=fake-anon-key npx vite build --outDir /tmp/kupa-fake
//   npx vite preview --outDir /tmp/kupa-fake --port 4191
//   BASE=http://localhost:4191 node scripts/checks/new-visitor.cjs
// (Windows PowerShell: $env:VITE_SUPABASE_URL="https://fake-project.invalid"; $env:VITE_SUPABASE_ANON_KEY="fake-anon-key" first.)
const { chromium } = require('playwright')
const BASE = process.env.BASE || 'http://localhost:4191'
const OUT = process.env.OUT ? process.env.OUT + '/' : null
const results = []
const ok = (name, cond, extra = '') => results.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? '  ' + extra : ''}`)
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
    await route.fulfill({ status, contentType: 'application/json', body: body === null ? '' : JSON.stringify(body) }).catch(() => {})
  })
}
async function fresh(browser, w, h, path) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'he-IL', serviceWorkers: 'block' })
  await backend(ctx, {})
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(BASE + path)
  return { ctx, page, errors }
}
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
const dir = (page) => page.evaluate(() => `${document.documentElement.lang}/${document.documentElement.dir}`)

;(async () => {
  const browser = await chromium.launch()
  for (const [w, h] of [[360, 740], [390, 844]]) {
    const tag = `${w}`
    const { ctx, page, errors } = await fresh(browser, w, h, '/')
    await page.waitForURL('**/welcome')
    await page.waitForTimeout(400)
    ok(`${tag} welcome in Hebrew, right to left, title Kupa`, (await dir(page)) === 'he/rtl' && (await page.title()) === 'Kupa', `${await dir(page)} "${await page.title()}"`)
    ok(`${tag} welcome: no sideways scroll`, !(await overflow(page)))
    if (OUT) await page.screenshot({ path: `${OUT}${tag}-1-welcome.png` })
    console.log(`${tag} welcome text:`, (await page.locator('main, body').first().innerText()).replace(/\s+/g, ' ').slice(0, 300))
    await page.getByRole('button', { name: 'פתיחת קופה משותפת' }).click()
    await page.waitForURL('**/create')
    await page.waitForTimeout(300)
    if (OUT) await page.screenshot({ path: `${OUT}${tag}-2-create.png` })
    ok(`${tag} create: no sideways scroll`, !(await overflow(page)))
    const inputs = page.locator('input')
    console.log(`${tag} create inputs:`, await inputs.count(), (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 300))
    await page.getByLabel('איך קוראים לך?').fill('נועה')
    const budget = page.getByLabel('כמה אתם רוצים להוציא בכל מחזור?')
    await budget.fill('9000')
    await page.getByRole('button', { name: 'יצירה', exact: true }).click()
    await page.waitForURL(/\/(invite|$)/, { timeout: 10000 })
    await page.waitForTimeout(500)
    if (OUT) await page.screenshot({ path: `${OUT}${tag}-3-after-create.png` })
    console.log(`${tag} after create at`, new URL(page.url()).pathname, (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 300))
    await page.goto(BASE + '/')
    await page.getByRole('button', { name: 'הוספת הוצאה' }).waitFor()
    await page.waitForTimeout(500)
    if (OUT) await page.screenshot({ path: `${OUT}${tag}-4-home-empty.png` })
    ok(`${tag} home in Hebrew`, (await page.getByRole('heading', { level: 2 }).first().textContent()).includes('במחזור הזה'))
    await page.getByRole('button', { name: 'הוספת הוצאה' }).click()
    await page.waitForTimeout(500)
    if (OUT) await page.screenshot({ path: `${OUT}${tag}-5-add.png` })
    ok(`${tag} add sheet: no sideways scroll`, !(await overflow(page)))
    await page.keyboard.press('Escape')
    await page.waitForTimeout(400)
    await page.getByRole('link', { name: 'הגדרות' }).click()
    await page.getByRole('heading', { name: 'הגדרות' }).waitFor()
    await page.waitForTimeout(500)
    if (OUT) await page.screenshot({ path: `${OUT}${tag}-6-settings.png`, fullPage: true })
    ok(`${tag} settings: no sideways scroll`, !(await overflow(page)))
    const langButtons = await page.locator('button[lang]').allTextContents()
    ok(`${tag} language buttons: Hebrew first, Hebrew pressed`, langButtons.join(',') === 'עברית,English' && (await page.locator('button[lang="he"]').getAttribute('aria-pressed')) === 'true', langButtons.join(','))
    await page.getByRole('button', { name: 'English' }).click()
    await page.getByRole('heading', { name: 'Settings' }).waitFor({ timeout: 10000 })
    ok(`${tag} switch to English: left to right, title Kupa`, (await dir(page)) === 'en/ltr' && (await page.title()) === 'Kupa', `${await dir(page)} "${await page.title()}"`)
    ok(`${tag} English kept after reload`, await page.reload().then(() => page.getByRole('heading', { name: 'Settings' }).waitFor()).then(() => dir(page)).then((d) => d === 'en/ltr'))
    ok(`${tag} no page errors`, errors.length === 0, errors.join(' | '))
    await ctx.close()

    // Join with a code and the way back, as a new visitor.
    for (const [name, path] of [['7-join', '/join/ABC234'], ['8-back', '/back#ABCDEFGHJKMN']]) {
      const v = await fresh(browser, w, h, path)
      await v.page.waitForTimeout(800)
      if (OUT) await v.page.screenshot({ path: `${OUT}${tag}-${name}.png` })
      ok(`${tag} ${name} in Hebrew, no sideways scroll`, (await dir(v.page)) === 'he/rtl' && !(await overflow(v.page)))
      ok(`${tag} ${name}: no page errors`, v.errors.length === 0, v.errors.join(' | '))
      await v.ctx.close()
    }
  }
  // The installed app's manifest.
  const api = await browser.newContext()
  const res = await (await api.request.get(BASE + '/manifest.webmanifest')).json()
  await api.close()
  ok('manifest: Kupa, Hebrew, right to left', res.name === 'Kupa' && res.short_name === 'Kupa' && res.lang === 'he' && res.dir === 'rtl', JSON.stringify({ name: res.name, lang: res.lang, dir: res.dir, description: res.description }))
  await browser.close()
  console.log(results.join('\n'))
  console.log(results.some((r) => r.startsWith('FAIL')) ? '\nSOME FAILED' : '\nALL PASS')
})().catch((e) => { console.error(e); process.exit(1) })
