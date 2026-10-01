import { ChevronLeft, Download, LogOut, Pencil, RotateCcw, Unplug } from 'lucide-react'
import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { useReadyData } from '../../app/DataProvider.tsx'
import { useMode } from '../../app/ModeContext.tsx'
import { csvFileName, downloadText, eventsCsv, expensesCsv } from '../../analytics/exportCsv.ts'
import { APP, LIMITS } from '../../config.ts'
import { todayInIsrael } from '../../domain/cycle.ts'
import { agorotToKeypad } from '../../domain/keypad.ts'
import { normalizeTypedAmount, parseAmount } from '../../domain/money.ts'
import type { Member } from '../../domain/types.ts'
import { t, tx } from '../../i18n/index.ts'
import { Button } from '../../ui/Button.tsx'
import { MemberChip } from '../../ui/MemberChip.tsx'
import { Money } from '../../ui/Money.tsx'
import { useToast } from '../../ui/Toast.tsx'

const DAYS = Array.from({ length: LIMITS.maxCycleDay - LIMITS.minCycleDay + 1 }, (_, i) => i + LIMITS.minCycleDay)

const fieldClass =
  'block min-h-12 w-full rounded-xl border border-border bg-surface px-4 text-base aria-invalid:border-over'

export function Settings() {
  const data = useReadyData()
  const { mode, setMode } = useMode()
  const navigate = useNavigate()
  const toast = useToast()
  const { repo, run, household, members, session } = data

  const saved = () => toast.show({ message: t('settings.saved') })
  const failed = () => toast.show({ message: t('toast.actionFailed') })

  const exportCsv = async (type: 'expenses' | 'events') => {
    try {
      const exported = await repo.exportData()
      const text = type === 'expenses' ? expensesCsv(exported.expenses) : eventsCsv(exported.events)
      downloadText(csvFileName(type, todayInIsrael()), text)
      repo.track('export', { type })
    } catch {
      failed()
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center gap-1 px-2 pt-2">
        <Link to="/" aria-label={t('common.back')} className="grid size-12 place-items-center rounded-full text-muted active:bg-surface">
          <ChevronLeft size={26} aria-hidden="true" className="rtl:-scale-x-100" />
        </Link>
        <h1 className="text-2xl font-bold">{t('settings.title')}</h1>
      </header>

      <main className="flex flex-1 flex-col gap-6 px-4 pt-4 pb-[calc(2rem+env(safe-area-inset-bottom))]">
        <Card title={t('settings.members')}>
          <ul className="divide-y divide-border">
            {members.map((m) => (
              <li key={m.id}>
                <MemberRow
                  member={m}
                  isMe={m.id === session.memberId}
                  onRename={async (name) => {
                    try {
                      await run((r) => r.updateMyName(name))
                      repo.track('settings_change', { field: 'display_name' })
                      saved()
                      return true
                    } catch {
                      failed()
                      return false
                    }
                  }}
                />
              </li>
            ))}
          </ul>
        </Card>

        <Card title={t('settings.budgetSection')}>
          <div className="flex flex-col gap-5 p-4">
            <BudgetForm
              key={household.budgetAgorot}
              budgetAgorot={household.budgetAgorot}
              onSave={async (budgetAgorot) => {
                try {
                  await run((r) => r.updateHousehold({ budgetAgorot }))
                  repo.track('settings_change', { field: 'budget' })
                  saved()
                } catch {
                  failed()
                }
              }}
            />
            <div className="flex flex-col gap-2">
              <label htmlFor="settings-cycle-day" className="font-medium">
                {t('settings.cycleDay')}
              </label>
              <select
                id="settings-cycle-day"
                value={household.cycleStartDay}
                aria-describedby="settings-cycle-help"
                onChange={async (e) => {
                  const cycleStartDay = Number(e.target.value)
                  try {
                    await run((r) => r.updateHousehold({ cycleStartDay }))
                    repo.track('settings_change', { field: 'cycle_start_day' })
                    saved()
                  } catch {
                    failed()
                  }
                }}
                className={fieldClass}
              >
                {DAYS.map((day) => (
                  <option key={day} value={day}>
                    {t('create.dayOption', { day })}
                  </option>
                ))}
              </select>
              <p id="settings-cycle-help" className="text-sm text-muted">
                {t('settings.cycleHelp')}
              </p>
            </div>
          </div>
        </Card>

        <Card title={t('settings.export')}>
          <div className="flex flex-col gap-2 p-4">
            <Button variant="secondary" className="justify-start" onClick={() => void exportCsv('expenses')}>
              <Download size={20} aria-hidden="true" />
              {t('settings.exportExpenses')}
            </Button>
            <Button variant="secondary" className="justify-start" onClick={() => void exportCsv('events')}>
              <Download size={20} aria-hidden="true" />
              {t('settings.exportEvents')}
            </Button>
          </div>
        </Card>

        {mode === 'demo' ? (
          <Card title={t('settings.demo')}>
            <div className="flex flex-col gap-2 p-4">
              <Button
                variant="secondary"
                className="justify-start"
                onClick={async () => {
                  await repo.resetDevice()
                  await data.refresh()
                  toast.show({ message: t('settings.resetDemoDone') })
                  navigate('/')
                }}
              >
                <RotateCcw size={20} aria-hidden="true" />
                {t('settings.resetDemo')}
              </Button>
              <Button
                variant="secondary"
                className="justify-start"
                onClick={() => {
                  setMode('local')
                  navigate('/', { replace: true })
                }}
              >
                <LogOut size={20} aria-hidden="true" className="rtl:-scale-x-100" />
                {t('settings.exitDemo')}
              </Button>
            </div>
          </Card>
        ) : (
          <DisconnectCard
            onConfirm={async () => {
              await repo.resetDevice()
              await data.refresh()
              navigate('/welcome', { replace: true })
            }}
          />
        )}

        <footer className="mt-auto pt-4 text-center text-sm text-muted">
          {t('app.footer', { name: APP.name, version: APP.version })}
        </footer>
      </main>
    </div>
  )
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  const id = useId()
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="mb-2 px-1 text-sm font-medium text-muted">
        {title}
      </h2>
      <div className="overflow-hidden rounded-2xl bg-surface">{children}</div>
    </section>
  )
}

function MemberRow({
  member,
  isMe,
  onRename,
}: {
  member: Member
  isMe: boolean
  onRename: (name: string) => Promise<boolean>
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(member.displayName)
  const [busy, setBusy] = useState(false)
  const valid = name.trim().length >= 1 && name.trim().length <= LIMITS.maxNameLength

  if (editing) {
    const submit = async (event: FormEvent) => {
      event.preventDefault()
      if (!valid) return
      setBusy(true)
      const ok = await onRename(name)
      setBusy(false)
      if (ok) setEditing(false)
    }
    return (
      <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-3 p-4">
        <label htmlFor="my-name" className="font-medium">
          {t('settings.yourName')}
        </label>
        <input
          id="my-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={LIMITS.maxNameLength}
          autoComplete="given-name"
          autoFocus
          aria-invalid={!valid || undefined}
          className={fieldClass}
        />
        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setName(member.displayName)
              setEditing(false)
            }}
          >
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={!valid || busy}>
            {t('common.save')}
          </Button>
        </div>
      </form>
    )
  }

  return (
    <div className="flex min-h-16 items-center gap-3 ps-4 pe-2">
      <MemberChip member={member} size="md" paidByLabel={false} />
      <p className="min-w-0 flex-1">
        <span className="block truncate font-medium">{member.displayName}</span>
        {isMe && <span className="block text-sm text-muted">{t('settings.thisDevice')}</span>}
      </p>
      {isMe && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label={t('settings.editName')}
          className="grid size-12 shrink-0 place-items-center rounded-full text-muted active:bg-bg"
        >
          <Pencil size={20} aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

function BudgetForm({ budgetAgorot, onSave }: { budgetAgorot: number; onSave: (agorot: number) => Promise<void> }) {
  const [text, setText] = useState(agorotToKeypad(budgetAgorot))
  const [busy, setBusy] = useState(false)
  const parsed = parseAmount(normalizeTypedAmount(text))
  const changed = parsed !== null && parsed !== budgetAgorot

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!changed || parsed === null) return
    setBusy(true)
    await onSave(parsed)
    setBusy(false)
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-2">
      <label htmlFor="settings-budget" className="font-medium">
        {t('settings.budget')}
      </label>
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <input
            id="settings-budget"
            value={text}
            onChange={(e) => setText(e.target.value)}
            inputMode="decimal"
            autoComplete="off"
            aria-invalid={parsed === null || undefined}
            aria-describedby={parsed === null ? 'settings-budget-error' : undefined}
            className={`${fieldClass} pe-10 tabular-nums`}
          />
          <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 end-4 grid place-items-center text-muted">
            ₪
          </span>
        </div>
        <Button type="submit" disabled={!changed || busy}>
          {t('common.save')}
        </Button>
      </div>
      {parsed === null && (
        <p id="settings-budget-error" className="text-sm font-medium text-over">
          {tx('create.budgetInvalid', { max: <Money agorot={LIMITS.maxAmountAgorot} /> })}
        </p>
      )}
    </form>
  )
}

function DisconnectCard({ onConfirm }: { onConfirm: () => Promise<void> }) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  return (
    <Card title={t('settings.danger')}>
      <div className="flex flex-col gap-3 p-4">
        {confirming ? (
          <div role="alertdialog" aria-labelledby="disconnect-warn" className="flex flex-col gap-3">
            <p id="disconnect-warn" className="rounded-xl bg-over-soft px-4 py-3 text-sm font-medium text-over">
              {t('settings.disconnectWarnLocal')}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirming(false)} disabled={busy}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="danger"
                autoFocus
                disabled={busy}
                onClick={async () => {
                  setBusy(true)
                  await onConfirm()
                }}
              >
                {t('settings.disconnectYes')}
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="danger-ghost" className="justify-start" onClick={() => setConfirming(true)}>
            <Unplug size={20} aria-hidden="true" />
            {t('settings.disconnect')}
          </Button>
        )}
      </div>
    </Card>
  )
}
