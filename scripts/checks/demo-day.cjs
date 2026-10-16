// The demo on the presentation day (clock set to Oct 18, 2026, 12:00 Israel): the current cycle,
// every earlier cycle with its total and row count, three "simulate partner expense" taps from an
// earlier cycle (home must switch to the current cycle; each tap a different expense), and a reload.
// DAY=<ISO time> picks another day; OUT=<folder> also saves screenshots.
// Any build works (demo mode is on the device):
//   npm run build && npx vite preview --port 4173
//   BASE=http://localhost:4173 node scripts/checks/demo-day.cjs
const { chromium } = require('playwright')
const BASE = process.env.BASE || 'http://localhost:4173'
const OUT = process.env.OUT
const DAY = process.env.DAY || '2026-10-18T09:00:00Z' // 12:00 in Israel
;(async () => {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'he-IL', serviceWorkers: 'block' })
  await ctx.clock.install({ time: new Date(DAY) })
  // Buttons are found by their Hebrew names (Hebrew is the default; kept so the check never depends on it).
  await ctx.addInitScript(() => localStorage.setItem('kupa.lang', 'he'))
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  const h1 = () => page.getByRole('heading', { level: 1 }).textContent()
  const big = () => page.getByRole('heading', { level: 2 }).first().textContent()
  const rows = () => page.locator('a[href^="/expense/"]').count()
  await page.goto(BASE + '/?demo=1')
  await page.getByRole('button', { name: 'הוספת הוצאה' }).waitFor()
  console.log('current:', await h1(), '|', await big(), '|', await rows(), 'rows')
  if (OUT) await page.screenshot({ path: `${OUT}/0-current.png` })
  for (let back = 1; back <= 12; back++) {
    const prev = page.getByRole('button', { name: 'המחזור הקודם' })
    if (await prev.isDisabled()) { console.log(`back ${back}: arrow disabled`); break }
    await prev.click()
    await page.waitForTimeout(700)
    console.log(`back ${back}:`, await h1(), '|', await big(), '|', await rows(), 'rows')
    if (OUT && [1, 2, 9, 10].includes(back)) await page.screenshot({ path: `${OUT}/${back}-back.png` })
  }
  // Simulate from an earlier cycle: home must show the current cycle and each tap a new expense.
  for (let i = 0; i < 3; i++) {
    await page.getByRole('link', { name: 'הגדרות' }).click()
    await page.getByRole('button', { name: 'הדמיה: הוצאה של בן או בת הזוג' }).click()
    await page.getByRole('button', { name: 'הוספת הוצאה' }).waitFor()
    await page.clock.runFor(3200)
    await page.waitForTimeout(400)
    const first = await page.locator('a[href^="/expense/"]').first().textContent()
    console.log(`simulate ${i + 1}:`, await h1(), '|', first)
  }
  if (OUT) await page.screenshot({ path: `${OUT}/sim.png` })
  // A reload keeps the simulated expenses the same day.
  await page.reload()
  await page.getByRole('button', { name: 'הוספת הוצאה' }).waitFor()
  console.log('after reload, first row:', await page.locator('a[href^="/expense/"]').first().textContent())
  console.log('page errors:', errors.length ? errors : 'none')
  await browser.close()
})().catch((e) => { console.error(e); process.exit(1) })
