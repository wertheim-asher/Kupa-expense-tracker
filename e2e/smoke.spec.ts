import { expect, test, type Page } from '@playwright/test'

/** The big number in whole shekels ("₪1,548 left this cycle" → 1548). */
async function bigNumber(page: Page): Promise<number> {
  const text = await page.getByRole('heading', { level: 2 }).first().textContent()
  return Number((text ?? '').replace(/[^\d]/g, ''))
}

test('core flow in demo mode: add ₪45, undo, edit a category, switch to Hebrew', async ({ page }) => {
  // 1. The demo opens in English (the default) with the big number and the list.
  await page.goto('/?demo=1')
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
  await expect(page.getByRole('heading', { level: 2 }).first()).toContainText('left this cycle')
  const start = await bigNumber(page)
  expect(start).toBeGreaterThan(0)
  await expect(page.locator('a[href^="/expense/"]').first()).toBeVisible()

  // 2. "+", 4, 5, Groceries: three taps after the amount.
  await page.getByRole('button', { name: 'Add expense' }).click()
  const sheet = page.getByRole('dialog', { name: 'New expense' })
  await sheet.getByRole('button', { name: '4', exact: true }).click()
  await sheet.getByRole('button', { name: '5', exact: true }).click()
  await sheet.getByRole('button', { name: 'Groceries' }).click()

  // 3. The toast, the new row, and exactly ₪45 less.
  await expect(sheet).toBeHidden()
  const toast = page.getByRole('status').filter({ hasText: 'Saved' })
  await expect(toast).toContainText('45')
  await expect(page.getByRole('heading', { level: 3, name: 'Today' })).toBeVisible()
  await expect.poll(() => bigNumber(page)).toBe(start - 45)

  // 4. Undo brings the number back.
  await toast.getByRole('button', { name: 'Undo' }).click()
  await expect.poll(() => bigNumber(page)).toBe(start)

  // 5. Open an expense, change its category, save, see the change.
  await page.waitForTimeout(700) // taps on the list are ignored for 600 ms after a save
  const row = page.locator('a[href^="/expense/"]').first()
  const href = await row.getAttribute('href')
  const was = await row.textContent()
  const target = was?.includes('Fun') ? 'Home' : 'Fun'
  await row.click()
  const edit = page.getByRole('dialog', { name: 'Edit expense' })
  await expect(edit).toBeVisible()
  await edit.getByRole('button', { name: target, exact: true }).click()
  await edit.getByRole('button', { name: 'Save' }).click()
  await expect(edit).toBeHidden()
  await expect(page.getByRole('status').filter({ hasText: 'Changes saved' })).toBeVisible()
  await expect(page.locator(`a[href="${href}"]`)).toContainText(target)

  // 6. Hebrew: right to left, and the big number in Hebrew.
  await page.getByRole('link', { name: 'Settings' }).click()
  await page.getByRole('button', { name: 'עברית' }).click()
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await page.getByRole('button', { name: 'חזרה' }).click()
  await expect(page.getByRole('heading', { level: 2 }).first()).toContainText(/במחזור הזה|חריגה/)
})
