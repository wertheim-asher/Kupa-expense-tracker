// Speed and responsiveness on a mid-range phone stand-in: Chromium, 360x740, CPU slowed 4x.
// Demo mode (no network). Interaction latency = Event Timing durations (what INP uses: input
// delay + handlers + until the next frame is painted). Prints medians; compare two builds by
// running it against each (RUNS=7 for steadier numbers).
// Any build works (demo mode is on the device):
//   npm run build && npx vite preview --port 4173
//   BASE=http://localhost:4173 node scripts/checks/taps.cjs
const { chromium } = require('playwright')
const BASE = process.env.BASE || 'http://localhost:4173'
const RUNS = Number(process.env.RUNS || 5)
const RATE = Number(process.env.RATE || 4)

async function session(browser) {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'he-IL', serviceWorkers: 'block' })
  await ctx.addInitScript(() => {
    // The script finds buttons by their Hebrew names (Hebrew is the default; kept so the check never depends on it).
    localStorage.setItem('kupa.lang', 'he')
    window.__events = []
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) if (e.interactionId) window.__events.push({ name: e.name, d: e.duration, id: e.interactionId })
    }).observe({ type: 'event', durationThreshold: 16, buffered: true })
    window.__long = 0
    new PerformanceObserver((list) => { for (const e of list.getEntries()) window.__long += e.duration }).observe({ type: 'longtask', buffered: true })
  })
  const page = await ctx.newPage()
  const cdp = await ctx.newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: RATE })
  return { ctx, page }
}

/** Worst event duration of the interaction(s) since the last call: like INP for one tap. */
async function lastInteraction(page) {
  await page.waitForTimeout(250)
  return page.evaluate(() => {
    const ev = window.__events
    window.__events = []
    return ev.length ? Math.round(Math.max(...ev.map((e) => e.d))) : 0
  })
}

const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]

;(async () => {
  const browser = await chromium.launch()
  const out = {}
  const add = (k, v) => (out[k] ??= []).push(v)
  for (let run = 0; run < RUNS; run++) {
    const { ctx, page } = await session(browser)
    // Cold start (no cache): navigation start to the big number on screen, plus long tasks.
    await page.goto(BASE + '/?demo=1')
    await page.getByRole('button', { name: 'הוספת הוצאה' }).waitFor()
    const nav = await page.evaluate(() => {
      const n = performance.getEntriesByType('navigation')[0]
      const fcp = performance.getEntriesByName('first-contentful-paint')[0]
      return { fcp: Math.round(fcp?.startTime ?? -1), long: Math.round(window.__long) }
    })
    const t0 = await page.evaluate(() => performance.now())
    add('cold: first paint (ms)', nav.fcp)
    add('cold: long tasks total (ms)', nav.long)
    // Warm start: reload with the HTTP cache.
    await page.reload()
    await page.getByRole('button', { name: 'הוספת הוצאה' }).waitFor()
    add('warm: home ready (ms)', await page.evaluate(() => Math.round(performance.now())))
    await page.waitForTimeout(500)
    await page.evaluate(() => { window.__events = [] })

    // + : open the add sheet.
    await page.getByRole('button', { name: 'הוספת הוצאה' }).click()
    await page.getByRole('button', { name: '4', exact: true }).waitFor()
    add('tap +, open add sheet (ms)', await lastInteraction(page))
    // Keypad digits.
    for (const k of ['4', '5']) {
      await page.getByRole('button', { name: k, exact: true }).click()
      add('tap a keypad digit (ms)', await lastInteraction(page))
    }
    // Category: save, close the sheet, update home.
    await page.getByRole('button', { name: 'סופר' }).click()
    await page.getByRole('dialog').waitFor({ state: 'detached' })
    add('tap category, save (ms)', await lastInteraction(page))
    await page.waitForTimeout(400)
    // Undo from the toast.
    const undo = page.getByRole('button', { name: 'ביטול' })
    if (await undo.count()) {
      await undo.click()
      add('tap undo (ms)', await lastInteraction(page))
    }
    await page.waitForTimeout(300)
    // Open an expense to edit, then close it.
    await page.locator('main li button, ul li a, ul li button').first().click().catch(() => {})
    await page.getByRole('dialog').waitFor().catch(() => {})
    add('tap a row, open edit (ms)', await lastInteraction(page))
    await page.keyboard.press('Escape')
    await page.getByRole('dialog').waitFor({ state: 'detached' }).catch(() => {})
    await page.waitForTimeout(300)
    await page.evaluate(() => { window.__events = [] })
    // Settings and back.
    await page.getByRole('link', { name: 'הגדרות' }).click()
    await page.getByRole('heading', { name: 'הגדרות' }).waitFor()
    add('tap settings (ms)', await lastInteraction(page))
    await page.getByRole('button', { name: 'חזרה' }).click()
    await page.getByRole('button', { name: 'הוספת הוצאה' }).waitFor()
    add('tap back to home (ms)', await lastInteraction(page))
    // Previous cycle.
    await page.getByRole('button', { name: 'המחזור הקודם' }).click()
    await page.waitForTimeout(300)
    add('tap previous cycle (ms)', await lastInteraction(page))
    await ctx.close()
  }
  await browser.close()
  for (const [k, v] of Object.entries(out)) console.log(`${k.padEnd(32)} median ${String(median(v)).padStart(5)}   all ${v.join(', ')}`)
})().catch((e) => { console.error(e); process.exit(1) })
