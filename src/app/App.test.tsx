// Core flow, end to end in jsdom with the real LocalRepo: create a budget, log ₪45, undo.

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { repoFor } from '../data/mode.ts'
import { addDays, todayInIsrael } from '../domain/cycle.ts'
import type { StoreData } from '../data/store.ts'
import { App } from './App.tsx'

const visible = (s: string) => s.replace(/[‎‏؜]/g, '').replace(/[  ]/g, ' ')

function bigNumber(): string {
  return visible(screen.getByRole('heading', { level: 2, name: /במחזור הזה|חריגה/ }).textContent ?? '')
}

function stored(): StoreData {
  return JSON.parse(localStorage.getItem('kupa.local.v1') ?? 'null') as StoreData
}

async function createBudget(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'פתיחת קופה משותפת' }))
  await user.type(screen.getByLabelText('איך קוראים לך?'), 'נועה')
  await user.type(screen.getByLabelText('כמה אתם רוצים להוציא בכל מחזור?'), '9000')
  await user.click(screen.getByRole('button', { name: 'יצירה' }))
  await screen.findByRole('button', { name: 'הוספת הוצאה' })
}

async function typeOnKeypad(user: ReturnType<typeof userEvent.setup>, keys: string) {
  for (const key of keys) await user.click(screen.getByRole('button', { name: key === '.' ? 'נקודה עשרונית' : key }))
}

beforeEach(async () => {
  window.history.replaceState(null, '', '/')
  await repoFor('local').resetDevice()
})

describe('core flow (LocalRepo)', () => {
  it('creates a budget, logs ₪45 groceries in 3 taps, shows the toast, and undo restores the number', async () => {
    const user = userEvent.setup()
    render(<App initialMode="local" />)
    await createBudget(user)
    expect(bigNumber()).toContain('9,000')
    expect(screen.getByText(/עוד אין הוצאות במחזור הזה/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'הוספת הוצאה' }))
    const sheet = await screen.findByRole('dialog', { name: 'הוצאה חדשה' })
    await typeOnKeypad(user, '45')
    await user.click(within(sheet).getByRole('button', { name: 'סופר' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(visible(screen.getByRole('status').textContent ?? '')).toMatch(/נשמר ✓ 45 ₪ · סופר/)
    await waitFor(() => expect(bigNumber()).toContain('8,955'))
    expect(screen.getByText('היום')).toBeInTheDocument()

    const data = stored()
    expect(data.expenses).toHaveLength(1)
    expect(data.expenses[0]).toMatchObject({ amountAgorot: 4500, category: 'groceries', deletedAt: null })
    expect(data.expenses[0].logDurationMs).toEqual(expect.any(Number))
    const save = data.events.find((e) => e.name === 'add_save')
    expect(save?.props).toEqual({ duration_ms: data.expenses[0].logDurationMs, category: 'groceries' })
    expect(data.events.map((e) => e.name)).toEqual(expect.arrayContaining(['household_created', 'add_start', 'add_save']))
    expect(data.events.find((e) => e.name === 'household_created')?.props).toEqual({ cycle_start_day: 10, budget_bucket: '5k_to_10k' })

    await user.click(screen.getByRole('button', { name: 'ביטול' }))
    await waitFor(() => expect(bigNumber()).toContain('9,000'))
    expect(stored().expenses[0].deletedAt).not.toBeNull()
    expect(stored().events.some((e) => e.name === 'undo')).toBe(true)
  })

  it('keeps categories inactive until the amount is valid, and saves exactly one expense on a double tap', async () => {
    const user = userEvent.setup()
    render(<App initialMode="local" />)
    await createBudget(user)
    await user.click(screen.getByRole('button', { name: 'הוספת הוצאה' }))
    const sheet = await screen.findByRole('dialog', { name: 'הוצאה חדשה' })
    const groceries = within(sheet).getByRole('button', { name: 'סופר' })
    expect(groceries).toHaveAttribute('aria-disabled', 'true')

    await user.click(groceries)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(stored().expenses).toHaveLength(0)

    await typeOnKeypad(user, '12.5')
    expect(groceries).not.toHaveAttribute('aria-disabled')
    await user.dblClick(groceries)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(stored().expenses).toHaveLength(1)
    expect(stored().expenses[0].amountAgorot).toBe(1250)
  })

  it('tracks add_cancel with had_amount when the sheet is closed without saving', async () => {
    const user = userEvent.setup()
    render(<App initialMode="local" />)
    await createBudget(user)
    await user.click(screen.getByRole('button', { name: 'הוספת הוצאה' }))
    await screen.findByRole('dialog', { name: 'הוצאה חדשה' })
    await typeOnKeypad(user, '7')
    await user.click(screen.getByRole('button', { name: 'סגירה' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(stored().events.some((e) => e.name === 'add_cancel')).toBe(true))
    const cancels = stored().events.filter((e) => e.name === 'add_cancel')
    expect(cancels).toHaveLength(1)
    expect(cancels[0].props).toEqual({ duration_ms: expect.any(Number), had_amount: true })
    expect(stored().expenses).toHaveLength(0)
  })

  it('defaults to today and can log an expense for yesterday or another date', async () => {
    const user = userEvent.setup()
    render(<App initialMode="local" />)
    await createBudget(user)
    const today = todayInIsrael()

    await user.click(screen.getByRole('button', { name: 'הוספת הוצאה' }))
    let sheet = await screen.findByRole('dialog', { name: 'הוצאה חדשה' })
    expect(within(sheet).getByRole('button', { name: 'היום' })).toHaveAttribute('aria-pressed', 'true')
    await typeOnKeypad(user, '30')
    await user.click(within(sheet).getByRole('button', { name: 'אתמול' }))
    expect(within(sheet).getByRole('button', { name: 'אתמול' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(within(sheet).getByRole('button', { name: 'בית' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(visible(screen.getByRole('status').textContent ?? '')).toMatch(/נשמר ✓ 30 ₪ · בית · אתמול/)
    expect(stored().expenses[0].spentOn).toBe(addDays(today, -1))

    await user.click(screen.getByRole('button', { name: 'הוספת הוצאה' }))
    sheet = await screen.findByRole('dialog', { name: 'הוצאה חדשה' })
    await typeOnKeypad(user, '20')
    const other = within(sheet).getByLabelText('תאריך אחר')
    expect(other).toHaveAttribute('max', today)
    expect(other).toHaveAttribute('min', addDays(today, -365))
    fireEvent.change(other, { target: { value: addDays(today, -5) } })
    await user.click(within(sheet).getByRole('button', { name: 'פנאי' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(stored().expenses[1].spentOn).toBe(addDays(today, -5))
    expect(stored().expenses.every((e) => e.amountAgorot > 0)).toBe(true)
  })

  it('refuses an out-of-range "other date" with the real reason, and never saves it', async () => {
    const user = userEvent.setup()
    render(<App initialMode="local" />)
    await createBudget(user)
    const today = todayInIsrael()
    await user.click(screen.getByRole('button', { name: 'הוספת הוצאה' }))
    const sheet = await screen.findByRole('dialog', { name: 'הוצאה חדשה' })
    await typeOnKeypad(user, '30')

    // iOS lets the picker go past max: a future date must not reach the repo.
    const other = within(sheet).getByLabelText('תאריך אחר')
    fireEvent.change(other, { target: { value: addDays(today, 2) } })
    expect(within(sheet).getByRole('alert')).toHaveTextContent('אפשר לבחור תאריך מהשנה האחרונה, לא בעתיד.')
    expect(other).toHaveAttribute('aria-invalid', 'true')
    const home = within(sheet).getByRole('button', { name: 'בית' })
    expect(home).toHaveAttribute('aria-disabled', 'true')
    await user.click(home)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(stored().expenses).toHaveLength(0)
    expect(within(sheet).queryByText('לא הצלחנו לשמור. לנסות שוב?')).not.toBeInTheDocument()

    // Too old is refused the same way; going back to "today" clears it and saves.
    fireEvent.change(other, { target: { value: addDays(today, -400) } })
    expect(within(sheet).getByRole('alert')).toHaveTextContent('אפשר לבחור תאריך מהשנה האחרונה')
    await user.click(within(sheet).getByRole('button', { name: 'היום' }))
    expect(within(sheet).queryByRole('alert')).not.toBeInTheDocument()
    await user.click(home)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(stored().expenses[0]).toMatchObject({ spentOn: today, amountAgorot: 3000 })
  })

  it('keeps keyboard digits on the amount while the date input has focus', async () => {
    const user = userEvent.setup()
    render(<App initialMode="local" />)
    await createBudget(user)
    await user.click(screen.getByRole('button', { name: 'הוספת הוצאה' }))
    const sheet = await screen.findByRole('dialog', { name: 'הוצאה חדשה' })
    within(sheet).getByLabelText('תאריך אחר').focus()
    await user.keyboard('45')
    await user.click(within(sheet).getByRole('button', { name: 'סופר' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(stored().expenses[0].amountAgorot).toBe(4500)
  })

  it('edits the category of an expense', async () => {
    const user = userEvent.setup()
    render(<App initialMode="local" />)
    await createBudget(user)
    await user.click(screen.getByRole('button', { name: 'הוספת הוצאה' }))
    const sheet = await screen.findByRole('dialog', { name: 'הוצאה חדשה' })
    await typeOnKeypad(user, '45')
    await user.click(within(sheet).getByRole('button', { name: 'סופר' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    await user.click(screen.getByRole('link', { name: /סופר/ }))
    const edit = await screen.findByRole('dialog', { name: 'עריכת הוצאה' })
    await user.click(within(edit).getByRole('button', { name: 'פנאי' }))
    await user.click(within(edit).getByRole('button', { name: 'שמירה' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('link', { name: /פנאי/ })).toBeInTheDocument()
    expect(stored().expenses[0].category).toBe('fun')
    expect(stored().events.find((e) => e.name === 'expense_edit')?.props).toEqual({ fields: ['category'] })
  })
})
