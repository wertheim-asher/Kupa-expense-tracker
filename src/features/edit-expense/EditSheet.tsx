import { useEffect, useReducer, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { useReadyData } from '../../app/DataProvider.tsx'
import { LIMITS } from '../../config.ts'
import type { CategoryId } from '../../domain/categories.ts'
import { addDays, cycleFor, todayInIsrael } from '../../domain/cycle.ts'
import { agorotToKeypad, keypadReducer } from '../../domain/keypad.ts'
import { exceedsMax, parseAmount } from '../../domain/money.ts'
import type { Expense, ExpensePatch } from '../../domain/types.ts'
import { isAllowedSpentOn } from '../../data/validate.ts'
import { t, tx } from '../../i18n/index.ts'
import { AmountDisplay } from '../../ui/AmountDisplay.tsx'
import { Button } from '../../ui/Button.tsx'
import { CategoryGrid } from '../../ui/CategoryGrid.tsx'
import { Keypad } from '../../ui/Keypad.tsx'
import { MemberChip } from '../../ui/MemberChip.tsx'
import { Money } from '../../ui/Money.tsx'
import { Sheet } from '../../ui/Sheet.tsx'
import { useToast } from '../../ui/Toast.tsx'
import { useOnline } from '../../ui/useOnline.ts'
import { syncEnabled } from '../../data/supabase.ts'

export function EditSheet() {
  const { id } = useParams()
  const { expenses, repo } = useReadyData()
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()
  const expense = expenses.find((e) => e.id === id)
  const seen = useRef(false)
  const done = useRef(false)

  const close = () => {
    if ((location.state as { fromApp?: boolean } | null)?.fromApp) navigate(-1)
    else navigate('/', { replace: true })
  }
  const closeRef = useRef(close)
  closeRef.current = close

  // The expense vanished from the current cycle while open: close, then say why. It was either
  // deleted somewhere else, or it still exists but now belongs to another cycle (its date moved
  // in another tab, the cycle day changed, or the cycle rolled over at midnight).
  useEffect(() => {
    if (expense) {
      seen.current = true
      return
    }
    if (done.current) return
    done.current = true
    closeRef.current()
    if (!seen.current || !id) return
    const today = todayInIsrael()
    repo
      .listExpenses({ from: addDays(today, -LIMITS.maxPastDays - 31), toExclusive: addDays(today, 1) })
      .then((all) => toast.show({ message: t(all.some((e) => e.id === id) ? 'toast.leftCycle' : 'toast.goneElsewhere') }))
      .catch(() => {
        // Unknown either way; the sheet is closed and the list is current, so say nothing rather than guess.
      })
  }, [expense, toast, repo, id])

  if (!expense) return null
  return <EditForm expense={expense} onClose={close} setDone={(value) => (done.current = value)} />
}

function EditForm({
  expense,
  onClose,
  setDone,
}: {
  expense: Expense
  onClose: () => void
  /** Tells the parent this sheet is closing itself, so a vanished expense is not reported as deleted elsewhere. */
  setDone: (value: boolean) => void
}) {
  const { repo, run, highlight, members, household, mode } = useReadyData()
  const online = useOnline()
  // With the shared backend, edits need the server: not while offline, not before the expense was sent.
  const blocked: 'edit.pending' | 'edit.offline' | null =
    syncEnabled && mode !== 'demo' ? (expense.pending ? 'edit.pending' : online ? null : 'edit.offline') : null
  const toast = useToast()
  // What the form opened with. Diffing against this (not the live expense) means a change
  // made in another tab to a field the user did not touch is never reverted.
  const [original] = useState(expense)
  const [raw, dispatch] = useReducer(keypadReducer, agorotToKeypad(expense.amountAgorot))
  const [category, setCategory] = useState<CategoryId>(expense.category)
  const [date, setDate] = useState(expense.spentOn)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [shakeKey, setShakeKey] = useState(0)

  const today = todayInIsrael()
  const amount = parseAmount(raw)
  const dateOk = isAllowedSpentOn(date, today)
  const payer = members.find((m) => m.id === expense.memberId)

  const save = async () => {
    if (amount === null) {
      setShakeKey((k) => k + 1)
      return
    }
    if (!dateOk) return
    const patch: ExpensePatch = {}
    const fields: string[] = []
    if (amount !== original.amountAgorot) {
      patch.amountAgorot = amount
      fields.push('amount')
    }
    if (category !== original.category) {
      patch.category = category
      fields.push('category')
    }
    if (date !== original.spentOn) {
      patch.spentOn = date
      fields.push('spent_on')
    }
    setDone(true)
    if (fields.length === 0) {
      onClose()
      return
    }
    setBusy(true)
    setFailed(false)
    try {
      await run((r) => r.updateExpense(expense.id, patch))
    } catch {
      setDone(false)
      setBusy(false)
      setFailed(true)
      return
    }
    repo.track('expense_edit', { fields })
    highlight(expense.id)
    // A new date in an earlier cycle takes the row out of this list; say so instead of a bare 'saved'.
    const movedEarlier = patch.spentOn !== undefined && patch.spentOn < cycleFor(todayInIsrael(), household.cycleStartDay).start
    toast.show({ message: t(movedEarlier ? 'toast.updatedEarlierCycle' : 'toast.updated') })
    onClose()
  }

  const remove = async () => {
    setDone(true)
    setBusy(true)
    setFailed(false)
    try {
      await run((r) => r.deleteExpense(expense.id))
    } catch {
      setDone(false)
      setBusy(false)
      setFailed(true)
      return
    }
    repo.track('expense_delete')
    toast.show({ message: t('toast.deleted') })
    onClose()
  }

  return (
    <Sheet title={t('edit.title')} titleId="edit-title" onClose={onClose}>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4">
        <AmountDisplay raw={raw} shakeKey={shakeKey} className="pt-2 text-4xl leading-tight" />
        <p className="flex items-center justify-center gap-2 text-sm text-muted">
          <span>{t('edit.paidBy')}</span>
          <MemberChip member={payer} paidByLabel={false} />
          <span className="max-w-40 truncate font-medium text-text">{payer?.displayName}</span>
        </p>
        {exceedsMax(raw) && (
          <p aria-live="polite" className="text-center text-sm font-medium text-over">
            {tx('add.tooMuch', { max: <Money agorot={LIMITS.maxAmountAgorot} /> })}
          </p>
        )}

        <div className="mt-2">
          <CategoryGrid onPick={setCategory} selected={category} disabled={busy} />
        </div>

        <div className="mt-3">
          <label className="flex items-center gap-3">
            <span className="shrink-0 text-muted">{t('edit.date')}</span>
            <input
              type="date"
              value={date}
              min={addDays(today, -LIMITS.maxPastDays)}
              max={today}
              required
              disabled={busy}
              aria-invalid={!dateOk || undefined}
              aria-describedby={dateOk ? undefined : 'edit-date-error'}
              onChange={(e) => setDate(e.target.value)}
              className="block min-w-0 flex-1 appearance-none rounded-xl border border-border bg-surface px-3 text-start text-base"
            />
          </label>
        </div>
        {!dateOk && (
          <p id="edit-date-error" className="mt-1 text-sm font-medium text-over">
            {t('edit.dateInvalid')}
          </p>
        )}

        {blocked && (
          <p role="status" className="mt-3 rounded-2xl bg-warn-soft px-4 py-2 text-sm font-medium text-warn">
            {t(blocked)}
          </p>
        )}
        {failed && (
          <p role="alert" className="mt-3 rounded-2xl bg-over-soft px-4 py-2 text-sm font-medium text-over">
            {t('error.save')}
          </p>
        )}
      </div>

      <Keypad onKey={dispatch} disabled={busy || confirming} />

      <div className="shrink-0 px-4 pb-3">
        {confirming ? (
          <div role="alertdialog" aria-labelledby="delete-q" className="flex items-center gap-2">
            <p id="delete-q" className="flex-1 font-medium">
              {t('edit.deleteConfirm')}
            </p>
            <Button variant="secondary" onClick={() => setConfirming(false)} disabled={busy}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" onClick={() => void remove()} disabled={busy} autoFocus>
              {t('edit.deleteYes')}
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button variant="danger-ghost" onClick={() => setConfirming(true)} disabled={busy || blocked !== null}>
              {t('edit.delete')}
            </Button>
            <Button className="flex-1" onClick={() => void save()} disabled={busy || blocked !== null || amount === null || !dateOk}>
              {t('edit.save')}
            </Button>
          </div>
        )}
      </div>
    </Sheet>
  )
}
