import { ChevronLeft, Download, LogOut, Pencil, RotateCcw, Unplug, Users } from 'lucide-react'
import { useEffect, useId, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { useReadyData } from '../../app/DataProvider.tsx'
import { useMode } from '../../app/ModeContext.tsx'
import { useBack } from '../../app/useBack.ts'
import { csvFileName, downloadText, eventsCsv, expensesCsv } from '../../analytics/exportCsv.ts'
import { APP, LIMITS } from '../../config.ts'
import { todayInIsrael } from '../../domain/cycle.ts'
import { agorotToKeypad } from '../../domain/keypad.ts'
import { normalizeTypedAmount, parseAmount } from '../../domain/money.ts'
import type { Member } from '../../domain/types.ts'
import { appName, LANG, ownerName, setLang, t, tx, type Lang } from '../../i18n/index.ts'
import { Button } from '../../ui/Button.tsx'
import { cls } from '../../ui/cls.ts'
import { MemberChip } from '../../ui/MemberChip.tsx'
import { Money } from '../../ui/Money.tsx'
import { CopyButton } from '../../ui/CopyButton.tsx'
import { useToast } from '../../ui/Toast.tsx'
import { useOnline } from '../../ui/useOnline.ts'
import { syncEnabled } from '../../data/syncConfig.ts'
import { RepoError } from '../../data/repo.ts'
import { ShareInviteButton } from '../onboarding/InviteShare.tsx'

const DAYS = Array.from({ length: LIMITS.maxCycleDay - LIMITS.minCycleDay + 1 }, (_, i) => i + LIMITS.minCycleDay)

const fieldClass =
  'block min-h-12 w-full rounded-xl border border-border bg-surface px-4 text-base aria-invalid:border-over'

export function Settings() {
  const data = useReadyData()
  const { mode, setMode } = useMode()
  const navigate = useNavigate()
  const back = useBack('/')
  const toast = useToast()
  const { repo, run, household, members, session } = data

  const saved = () => toast.show({ message: t('settings.saved') })

  // This member's private code for taking their seat back from another device (shared backend only).
  // undefined: not known yet (loading, or offline with nothing cached); null: there is none.
  const [personalCode, setPersonalCode] = useState<string | null | undefined>(undefined)
  const online = useOnline()
  useEffect(() => {
    if (!syncEnabled || mode === 'demo') return
    let cancelled = false
    repo
      .getMyPersonalCode()
      .then((code) => {
        if (!cancelled) setPersonalCode(code)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
    // Tries again when the connection comes back.
  }, [repo, mode, online])
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
        <button
          type="button"
          onClick={back}
          aria-label={t('common.back')}
          className="grid size-12 place-items-center rounded-full text-muted active:bg-surface"
        >
          <ChevronLeft size={26} aria-hidden="true" className="rtl:-scale-x-100" />
        </button>
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

        {syncEnabled && mode !== 'demo' && (
          <Card title={t('settings.invite')}>
            <div className="divide-y divide-border">
              <CodeRow
                label={t('invite.codeLabel')}
                code={household.inviteCode}
                copyLabel={t('settings.copyInvite')}
                // A free seat: the code is for inviting the partner. Both seats taken: for getting back in.
                help={t(members.length < 2 ? 'settings.inviteHelpOpen' : 'settings.inviteHelp')}
              >
                {members.length < 2 && <ShareInviteButton code={household.inviteCode} className="mt-3 w-full" />}
              </CodeRow>
              {personalCode && (
                <CodeRow
                  label={t('settings.personalLabel')}
                  code={groupCode(personalCode)}
                  copyLabel={t('settings.copyPersonal')}
                  help={t('settings.personalHelp')}
                />
              )}
            </div>
          </Card>
        )}

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

        <Card title={t('settings.language')}>
          <div className="flex gap-2 p-4">
            {(['he', 'en'] as const satisfies readonly Lang[]).map((lang) => (
              <button
                key={lang}
                type="button"
                lang={lang}
                aria-pressed={LANG === lang}
                onClick={() => {
                  if (lang === LANG) return
                  repo.track('settings_change', { field: 'language' })
                  // The whole app reloads in the new language; a moment first lets the event be sent.
                  setTimeout(() => setLang(lang), 300)
                }}
                className={cls(
                  'min-h-12 flex-1 touch-manipulation rounded-full border text-base font-medium',
                  LANG === lang ? 'border-primary bg-primary-soft text-primary' : 'border-border bg-surface active:bg-bg',
                )}
              >
                {lang === 'he' ? 'עברית' : 'English'}
              </button>
            ))}
          </div>
        </Card>

        <Card title={t('settings.export')}>
          <ul className="divide-y divide-border">
            <li>
              <ExportRow
                title={t('settings.exportExpenses')}
                help={t('settings.exportExpensesHelp')}
                onClick={() => void exportCsv('expenses')}
              />
            </li>
            <li>
              <ExportRow
                title={t('settings.exportEvents')}
                help={t('settings.exportEventsHelp')}
                onClick={() => void exportCsv('events')}
              />
            </li>
          </ul>
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
                  navigate('/', { replace: true })
                }}
              >
                <RotateCcw size={20} aria-hidden="true" />
                {t('settings.resetDemo')}
              </Button>
              {repo.simulatePartnerExpense && (
                <Button
                  variant="secondary"
                  className="justify-start"
                  onClick={() => {
                    // Home first, so the partner's expense is seen arriving (SPEC: after 3 seconds).
                    toast.show({ message: t('settings.simulatePartnerSoon'), durationMs: 3000 })
                    navigate('/', { replace: true })
                    window.scrollTo({ top: 0 })
                    setTimeout(() => void repo.simulatePartnerExpense?.().catch(() => undefined), 3000)
                  }}
                >
                  <Users size={20} aria-hidden="true" />
                  {t('settings.simulatePartner')}
                </Button>
              )}
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
            inviteCode={syncEnabled ? household.inviteCode : null}
            personalCode={personalCode}
            onConfirm={async () => {
              try {
                await repo.resetDevice()
              } catch (e) {
                // Unsent offline expenses would be lost: the repo refuses until they are sent.
                toast.show({
                  message: t(e instanceof RepoError && e.code === 'network' ? 'settings.disconnectPending' : 'toast.actionFailed'),
                  durationMs: 6000,
                })
                return false
              }
              await data.refresh()
              navigate('/welcome', { replace: true })
              return true
            }}
          />
        )}

        <footer className="mt-auto flex flex-col gap-1 pt-4 text-center text-sm text-muted">
          <p>{t('app.footer', { name: appName(), version: APP.version })}</p>
          <p>{t('app.copyright', { year: APP.copyrightYear, owner: ownerName() })}</p>
        </footer>
      </main>
    </div>
  )
}

/** "ABCDEFGHJKMN" → "ABCD EFGH JKMN", easier to copy down. */
function groupCode(code: string): string {
  return code.replace(/(.{4})(?=.)/g, '$1 ')
}

/** One code per row: what it is, the code itself (bold, with a copy button), then what it is for. */
function CodeRow({
  label,
  code,
  copyLabel,
  help,
  children,
}: {
  label: string
  code: string
  copyLabel: string
  help: string
  children?: ReactNode
}) {
  return (
    <div className="p-4">
      <p className="text-sm font-medium text-muted">{label}</p>
      <div className="mt-1 flex items-center gap-1">
        <p aria-hidden="true" dir="ltr" className="text-2xl font-bold tracking-[0.12em] tabular-nums">
          {code}
        </p>
        {/* Screen readers get the code letter by letter; it sits apart so copying by hand copies only the code. */}
        <span className="sr-only">{code.replace(/ /g, '').split('').join(' ')}</span>
        <CopyButton text={code} label={copyLabel} className="text-primary" />
      </div>
      <p className="mt-1 text-sm text-muted">{help}</p>
      {children}
    </div>
  )
}

/** A code in the disconnect warning: its title on top, then the code with its copy button. Same for both codes. */
function WarningCode({ label, code, copyLabel }: { label: string; code: string; copyLabel: string }) {
  return (
    <div className="mt-2">
      <p>{label}</p>
      <p className="flex items-center gap-1">
        <bdi className="font-bold tracking-[0.08em] whitespace-nowrap">{code}</bdi>
        <CopyButton text={code} label={copyLabel} className="active:bg-over/10" />
      </p>
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

/** One download per row: what the file is, and in one line what is inside it. */
function ExportRow({ title, help, onClick }: { title: string; help: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-16 w-full touch-manipulation items-center gap-3 px-4 py-3 text-start active:bg-bg focus-visible:-outline-offset-3"
    >
      <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
        <Download size={20} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{title}</span>
        <span className="block text-sm text-muted">{help}</span>
      </span>
    </button>
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

/**
 * On-device only: disconnecting deletes this device's data. With partner sync: the data stays on the
 * server, and the invite code plus the personal code (both shown in the warning) are the way back.
 */
function DisconnectCard({
  onConfirm,
  inviteCode,
  personalCode,
}: {
  /** Resolves false when nothing changed (for example unsent expenses), so the buttons come back. */
  onConfirm: () => Promise<boolean>
  inviteCode: string | null
  /** undefined while not known: disconnecting then could lose the way back, so it waits. */
  personalCode: string | null | undefined
}) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const waitingForCode = inviteCode !== null && personalCode === undefined
  return (
    <Card title={t('settings.danger')}>
      <div className="flex flex-col gap-3 p-4">
        {confirming ? (
          <div role="alertdialog" aria-labelledby="disconnect-warn" className="flex flex-col gap-3">
            <div id="disconnect-warn" className="rounded-xl bg-over-soft px-4 py-3 text-sm font-medium text-over">
              {inviteCode ? (
                <>
                  <p>{t('settings.disconnectWarn')}</p>
                  <WarningCode label={t('invite.codeLabel')} code={inviteCode} copyLabel={t('settings.copyInvite')} />
                  {personalCode && (
                    <WarningCode
                      label={t('settings.personalLabel')}
                      code={groupCode(personalCode)}
                      copyLabel={t('settings.copyPersonal')}
                    />
                  )}
                  {waitingForCode && <p className="mt-2">{t('settings.personalWaiting')}</p>}
                </>
              ) : (
                <p>{t('settings.disconnectWarnLocal')}</p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirming(false)} disabled={busy}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="danger"
                autoFocus
                disabled={busy || waitingForCode}
                onClick={async () => {
                  setBusy(true)
                  if (!(await onConfirm())) setBusy(false)
                }}
              >
                {inviteCode ? t('settings.disconnectSyncYes') : t('settings.disconnectYes')}
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
