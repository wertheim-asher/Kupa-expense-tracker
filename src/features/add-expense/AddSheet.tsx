import { useEffect, useReducer, useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { useReadyData } from '../../app/DataProvider.tsx'
import { LIMITS, TIMING } from '../../config.ts'
import type { CategoryId } from '../../domain/categories.ts'
import { todayInIsrael } from '../../domain/cycle.ts'
import { keypadReducer } from '../../domain/keypad.ts'
import { exceedsMax, parseAmount } from '../../domain/money.ts'
import { uuid } from '../../data/uuid.ts'
import { isAllowedSpentOn } from '../../data/validate.ts'
import { dayLabel } from '../../i18n/dates.ts'
import { categoryName, t, tx } from '../../i18n/index.ts'
import { AmountDisplay } from '../../ui/AmountDisplay.tsx'
import { Button } from '../../ui/Button.tsx'
import { CategoryGrid } from '../../ui/CategoryGrid.tsx'
import { cls } from '../../ui/cls.ts'
import { Keypad } from '../../ui/Keypad.tsx'
import { Money } from '../../ui/Money.tsx'
import { Sheet } from '../../ui/Sheet.tsx'
import { useToast } from '../../ui/Toast.tsx'
import { addSessionStart, endAddSession } from './addSession.ts'
import { DateChips, resolveDay, type DayChoice } from './DateChips.tsx'

/** The core flow: type an amount, tap a category, and it is saved. */
export function AddSheet() {
  const [startedAt] = useState(addSessionStart)
  if (startedAt === null) return <Navigate to="/" replace />
  return <AddSheetBody startedAt={startedAt} />
}

function AddSheetBody({ startedAt }: { startedAt: number }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { repo, run, highlight } = useReadyData()
  const toast = useToast()

  const [raw, dispatch] = useReducer(keypadReducer, '')
  const [saving, setSaving] = useState(false)
  const [failedCategory, setFailedCategory] = useState<CategoryId | null>(null)
  const [shakeKey, setShakeKey] = useState(0)
  const [nudged, setNudged] = useState(false)
  const [day, setDay] = useState<DayChoice>({ kind: 'today' })
  const [dateError, setDateError] = useState(false)

  const rawRef = useRef(raw)
  rawRef.current = raw
  const savingRef = useRef(false)
  const finishedRef = useRef(false)
  const idRef = useRef<string | null>(null)
  const mountedRef = useRef(false)

  const amount = parseAmount(raw)
  const tooMuch = exceedsMax(raw)
  const today = todayInIsrael()
  const dateOk = isAllowedSpentOn(resolveDay(day, today), today)
  const showDateError = dateError || !dateOk

  const close = () => {
    if ((location.state as { fromApp?: boolean } | null)?.fromApp) navigate(-1)
    else navigate('/', { replace: true })
  }

  // Closing without saving (close button, Escape, back button) counts as add_cancel.
  // The deferred check skips StrictMode's test unmount, which remounts right away.
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      setTimeout(() => {
        if (mountedRef.current || finishedRef.current) return
        finishedRef.current = true
        endAddSession()
        repo.track('add_cancel', {
          duration_ms: Math.round(performance.now() - startedAt),
          had_amount: rawRef.current !== '',
        })
      }, 0)
    }
  }, [repo, startedAt])

  const undo = async (id: string) => {
    try {
      await run((r) => r.deleteExpense(id))
      repo.track('undo')
      toast.show({ message: t('toast.undone') })
    } catch {
      toast.show({ message: t('toast.actionFailed') })
    }
  }

  const save = async (category: CategoryId) => {
    if (savingRef.current) return
    if (amount === null) {
      setShakeKey((k) => k + 1)
      setNudged(true)
      return
    }
    savingRef.current = true
    setSaving(true)
    setFailedCategory(null)
    const id = (idRef.current ??= uuid())
    const durationMs = Math.round(performance.now() - startedAt)
    // The Israel date at the moment of saving, not when the sheet opened (midnight).
    const now = todayInIsrael()
    const spentOn = resolveDay(day, now)
    // Never send a date the repo will reject (iOS picker range, or the oldest date after midnight).
    if (!isAllowedSpentOn(spentOn, now)) {
      savingRef.current = false
      setSaving(false)
      setDateError(true)
      return
    }
    try {
      await run((r) => r.addExpense({ id, amountAgorot: amount, category, spentOn, logDurationMs: durationMs }))
    } catch {
      savingRef.current = false
      setSaving(false)
      setFailedCategory(category)
      return
    }
    finishedRef.current = true
    endAddSession()
    repo.track('add_save', { duration_ms: durationMs, category })
    highlight(id)
    toast.show({
      message: (
        <>
          {t('toast.saved')} <Money agorot={amount} /> · {categoryName(category)}
          {spentOn !== now && <> · {dayLabel(spentOn, now)}</>}
        </>
      ),
      action: { label: t('toast.undo'), onClick: () => void undo(id) },
      durationMs: TIMING.undoMs,
    })
    if (mountedRef.current) close()
  }

  return (
    <Sheet title={t('add.title')} titleId="add-title" onClose={close}>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4">
        {/* Reads top to bottom in the order things are decided: when, how much, what (tapping a category saves). */}
        <div className="pt-1">
          <DateChips
            value={day}
            onChange={(next) => {
              setDay(next)
              setDateError(false)
            }}
            today={today}
            disabled={saving}
          />
          {showDateError && (
            <p id="add-date-error" role="alert" className="mt-1 text-center text-sm font-medium text-over">
              {t('edit.dateInvalid')}
            </p>
          )}
        </div>

        <div className="flex flex-1 flex-col justify-center py-2">
          <AmountDisplay raw={raw} shakeKey={shakeKey} className="text-5xl leading-tight" />
          <p
            aria-live="polite"
            className={cls(
              'mt-2 min-h-6 text-center text-sm',
              tooMuch ? 'font-medium text-over' : nudged ? 'font-medium text-text' : 'text-muted',
            )}
          >
            {tooMuch ? tx('add.tooMuch', { max: <Money agorot={LIMITS.maxAmountAgorot} /> }) : t('add.hint')}
          </p>
        </div>

        {failedCategory && (
          <div role="alert" className="mb-3 flex items-center gap-3 rounded-2xl bg-over-soft py-2 ps-4 pe-2 text-over">
            <p className="flex-1 text-sm font-medium">{t('error.save')}</p>
            <Button variant="danger" className="min-h-10 px-4" onClick={() => void save(failedCategory)}>
              {t('common.retry')}
            </Button>
          </div>
        )}

        <div className="pb-2">
          <CategoryGrid onPick={(id) => void save(id)} inactive={amount === null || !dateOk} disabled={saving} />
        </div>
      </div>
      <Keypad onKey={dispatch} disabled={saving} />
    </Sheet>
  )
}
