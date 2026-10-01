import { ChevronLeft } from 'lucide-react'
import { useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { useData } from '../../app/DataProvider.tsx'
import { useBack } from '../../app/useBack.ts'
import { syncEnabled } from '../../data/supabase.ts'
import { budgetBucket } from '../../analytics/track.ts'
import { LIMITS } from '../../config.ts'
import { normalizeTypedAmount, parseAmount } from '../../domain/money.ts'
import { t, tx } from '../../i18n/index.ts'
import { Button } from '../../ui/Button.tsx'
import { Money } from '../../ui/Money.tsx'

const DAYS = Array.from({ length: LIMITS.maxCycleDay - LIMITS.minCycleDay + 1 }, (_, i) => i + LIMITS.minCycleDay)

const fieldClass =
  'block min-h-12 w-full rounded-xl border border-border bg-surface px-4 text-base aria-invalid:border-over'

// One screen, three fields. The invite step is skipped in the fast lane.
export function Create() {
  const navigate = useNavigate()
  const back = useBack('/welcome')
  const { repo, refresh } = useData()
  const [name, setName] = useState('')
  const [budget, setBudget] = useState('')
  const [cycleDay, setCycleDay] = useState<number>(LIMITS.defaultCycleDay)
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)
  const budgetRef = useRef<HTMLInputElement>(null)

  const nameOk = name.trim().length >= 1 && name.trim().length <= LIMITS.maxNameLength
  const budgetAgorot = parseAmount(normalizeTypedAmount(budget))
  const showNameError = submitted && !nameOk
  const showBudgetError = submitted && budgetAgorot === null

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitted(true)
    if (!nameOk) return nameRef.current?.focus()
    if (budgetAgorot === null) return budgetRef.current?.focus()
    setBusy(true)
    setFailed(false)
    try {
      await repo.createHousehold({ displayName: name, budgetAgorot, cycleStartDay: cycleDay })
    } catch {
      setBusy(false)
      setFailed(true)
      return
    }
    repo.track('household_created', { cycle_start_day: cycleDay, budget_bucket: budgetBucket(budgetAgorot) })
    if (syncEnabled) {
      // Next step: invite the partner (also possible later in settings). Leave this screen before
      // the reload, so the signed-out guard here cannot redirect home first.
      navigate('/invite', { replace: true, state: { justCreated: true } })
      await refresh()
      return
    }
    await refresh()
    navigate('/', { replace: true })
  }

  return (
    <main className="flex flex-1 flex-col px-4 pt-2 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
      <header className="flex items-center gap-1">
        <button
          type="button"
          onClick={back}
          aria-label={t('common.back')}
          className="grid size-12 place-items-center rounded-full text-muted active:bg-surface"
        >
          <ChevronLeft size={26} aria-hidden="true" className="rtl:-scale-x-100" />
        </button>
        <h1 className="text-2xl font-bold">{t('create.title')}</h1>
      </header>

      <form onSubmit={(e) => void submit(e)} noValidate className="mt-6 flex flex-1 flex-col gap-6 px-1">
        <div className="flex flex-col gap-2">
          <label htmlFor="name" className="font-medium">
            {t('create.name')}
          </label>
          <input
            ref={nameRef}
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={LIMITS.maxNameLength}
            autoComplete="given-name"
            enterKeyHint="next"
            aria-invalid={showNameError || undefined}
            aria-describedby={showNameError ? 'name-error' : undefined}
            className={fieldClass}
          />
          {showNameError && (
            <p id="name-error" className="text-sm font-medium text-over">
              {t('create.nameRequired')}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="budget" className="font-medium">
            {t('create.budget')}
          </label>
          <div className="relative">
            <input
              ref={budgetRef}
              id="budget"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              inputMode="decimal"
              autoComplete="off"
              enterKeyHint="next"
              placeholder={t('create.budgetPlaceholder')}
              aria-invalid={showBudgetError || undefined}
              aria-describedby={showBudgetError ? 'budget-error' : undefined}
              className={`${fieldClass} pe-10 tabular-nums`}
            />
            <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 end-4 grid place-items-center text-muted">
              ₪
            </span>
          </div>
          {showBudgetError && (
            <p id="budget-error" className="text-sm font-medium text-over">
              {tx('create.budgetInvalid', { max: <Money agorot={LIMITS.maxAmountAgorot} /> })}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="cycle-day" className="font-medium">
            {t('create.cycleDay')}
          </label>
          <select
            id="cycle-day"
            value={cycleDay}
            onChange={(e) => setCycleDay(Number(e.target.value))}
            aria-describedby="cycle-help"
            className={fieldClass}
          >
            {DAYS.map((day) => (
              <option key={day} value={day}>
                {t('create.dayOption', { day })}
              </option>
            ))}
          </select>
          <p id="cycle-help" className="text-sm text-muted">
            {t('create.cycleHelp')}
          </p>
        </div>

        <div className="mt-auto flex flex-col gap-3">
          {failed && (
            <p role="alert" className="rounded-2xl bg-over-soft px-4 py-2 text-sm font-medium text-over">
              {t('create.error')}
            </p>
          )}
          <Button type="submit" className="min-h-14 w-full text-lg" disabled={busy}>
            {t('create.submit')}
          </Button>
        </div>
      </form>
    </main>
  )
}
