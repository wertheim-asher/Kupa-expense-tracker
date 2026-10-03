import { expect, test, type Page } from '@playwright/test'

/** The big number in whole shekels ("נשארו ₪1,548 במחזור הזה" → 1548). */
async function bigNumber(page: Page): Promise<number> {
  const text = await page.getByRole('heading', { level: 2 }).first().textContent()
  return Number((text ?? '').replace(/[^\d]/g, ''))
}

test('core flow in demo mode: add ₪45, undo, edit a category, switch to English', async ({ page }) => {
  // 1. The demo opens with the big number and the list.
  await page.goto('/?demo=1')
  await expect(page.getByRole('heading', { level: 2 }).first()).toContainText('במחזור הזה')
  const start = await bigNumber(page)
  expect(start).toBeGreaterThan(0)
  await expect(page.locator('a[href^="/expense/"]').first()).toBeVisible()

  // 2. "+", 4, 5, Groceries: three taps after the amount.
  await page.getByRole('button', { name: 'הוספת הוצאה' }).click()
  const sheet = page.getByRole('dialog', { name: 'הוצאה חדשה' })
  await sheet.getByRole('button', { name: '4', exact: true }).click()
  await sheet.getByRole('button', { name: '5', exact: true }).click()
  await sheet.getByRole('button', { name: 'סופר' }).click()

  // 3. The toast, the new row, and exactly ₪45 less.
  await expect(sheet).toBeHidden()
  const toast = page.getByRole('status').filter({ hasText: 'נשמר' })
  await expect(toast).toContainText('45')
  await expect(page.getByRole('heading', { level: 3, name: 'היום' })).toBeVisible()
  await expect.poll(() => bigNumber(page)).toBe(start - 45)

  // 4. Undo brings the number back.
  await toast.getByRole('button', { name: 'ביטול' }).click()
  await expect.poll(() => bigNumber(page)).toBe(start)

  // 5. Open an expense, change its category, save, see the change.
  await page.waitForTimeout(700) // taps on the list are ignored for 600 ms after a save
  const row = page.locator('a[href^="/expense/"]').first()
  const href = await row.getAttribute('href')
  const was = await row.textContent()
  const target = was?.includes('פנאי') ? 'בית' : 'פנאי'
  await row.click()
  const edit = page.getByRole('dialog', { name: 'עריכת הוצאה' })
  await expect(edit).toBeVisible()
  await edit.getByRole('button', { name: target, exact: true }).click()
  await edit.getByRole('button', { name: 'שמירה' }).click()
  await expect(edit).toBeHidden()
  await expect(page.getByRole('status').filter({ hasText: 'השינויים נשמרו' })).toBeVisible()
  await expect(page.locator(`a[href="${href}"]`)).toContainText(target)

  // 6. English: left to right, and the big number in English.
  await page.getByRole('link', { name: 'הגדרות' }).click()
  await page.getByRole('button', { name: 'English' }).click()
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
  await page.getByRole('button', { name: 'Back' }).click()
  await expect(page.getByRole('heading', { level: 2 }).first()).toContainText(/left this cycle|over budget/)
})
