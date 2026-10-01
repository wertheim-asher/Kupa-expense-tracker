import { ChevronLeft } from 'lucide-react'
import { useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useData } from '../../app/DataProvider.tsx'
import { useBack } from '../../app/useBack.ts'
import { LIMITS } from '../../config.ts'
import { RepoError } from '../../data/repo.ts'
import { t, type MessageKey } from '../../i18n/index.ts'
import { Button } from '../../ui/Button.tsx'

const fieldClass =
  'block min-h-12 w-full rounded-xl border border-border bg-surface px-4 text-base aria-invalid:border-over'

/** Accepts a typed code, a pasted code with spaces, or a whole invite link. */
/** A personal code (12 characters), typed or pasted with or without the spaces it is shown with. */
export function normalizePersonalCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12)
}

export function normalizeCode(input: string): string {
  const fromLink = /\/join\/([A-Za-z0-9 ]+)/.exec(input)?.[1] ?? input
  return fromLink.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
}

const ERRORS: Partial<Record<string, MessageKey>> = {
  code_not_found: 'join.notFound',
  household_full: 'join.full',
  already_member: 'join.already',
  personal_code_invalid: 'join.personalInvalid',
  network: 'error.network',
}

/** /join and /join/:code. A device that already has a budget gets a message, not a form. */
export function JoinRoute() {
  const { status } = useData()
  const navigate = useNavigate()
  // Set once this device has just joined, so the reload does not flash "already connected".
  const [joined, setJoined] = useState(false)
  if (status === 'ready' && !joined) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-lg">{t('join.already')}</p>
        <Button onClick={() => navigate('/', { replace: true })}>{t('join.goHome')}</Button>
      </main>
    )
  }
  return <Join onJoined={() => setJoined(true)} />
}

function Join({ onJoined }: { onJoined: () => void }) {
  const params = useParams()
  const navigate = useNavigate()
  const back = useBack('/welcome')
  const { repo, refresh } = useData()
  const [code, setCode] = useState(() => normalizeCode(params.code ?? ''))
  const [name, setName] = useState('')
  // Coming back from another device: the personal code replaces the name.
  const [rejoin, setRejoin] = useState(false)
  const [personal, setPersonal] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<MessageKey | null>(null)
  const codeRef = useRef<HTMLInputElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const personalRef = useRef<HTMLInputElement>(null)

  const codeOk = code.length === 6
  const nameOk = name.trim().length >= 1 && name.trim().length <= LIMITS.maxNameLength
  const personalOk = personal.length === 12

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitted(true)
    if (!codeOk) return codeRef.current?.focus()
    if (rejoin && !personalOk) return personalRef.current?.focus()
    if (!rejoin && !nameOk) return nameRef.current?.focus()
    setBusy(true)
    setError(null)
    try {
      await repo.joinHousehold(code, rejoin ? '' : name, rejoin ? personal : undefined)
    } catch (e) {
      setBusy(false)
      setError((e instanceof RepoError && ERRORS[e.code]) || 'join.error')
      return
    }
    onJoined()
    repo.track('household_joined', rejoin ? { rejoined: true } : {})
    if (rejoin) {
      // With the second seat free, taking a seat back also changes the invite code (so the old
      // device cannot walk back in). Any link already sent to the partner stops working, so go
      // straight to the invite screen to send the new one.
      const household = await repo.getHousehold().catch(() => null)
      if (household && household.inviteCode !== code) {
        navigate('/invite', { replace: true, state: { justCreated: true, inviteChanged: true } })
        await refresh()
        return
      }
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
        <h1 className="text-2xl font-bold">{t('join.title')}</h1>
      </header>

      <form onSubmit={(e) => void submit(e)} noValidate className="mt-6 flex flex-1 flex-col gap-6 px-1">
        <div className="flex flex-col gap-2">
          <label htmlFor="join-code" className="font-medium">
            {t('join.code')}
          </label>
          <input
            ref={codeRef}
            id="join-code"
            value={code}
            onChange={(e) => setCode(normalizeCode(e.target.value))}
            onPaste={(e) => {
              e.preventDefault()
              setCode(normalizeCode(e.clipboardData.getData('text')))
            }}
            dir="ltr"
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="next"
            aria-invalid={(submitted && !codeOk) || undefined}
            aria-describedby="join-code-help"
            className={`${fieldClass} text-center text-2xl font-bold tracking-[0.3em] uppercase`}
          />
          <p id="join-code-help" className={submitted && !codeOk ? 'text-sm font-medium text-over' : 'text-sm text-muted'}>
            {submitted && !codeOk ? t('join.codeInvalid') : t('join.codeHelp')}
          </p>
        </div>

        {rejoin ? (
          <div className="flex flex-col gap-2">
            <label htmlFor="join-personal" className="font-medium">
              {t('join.personal')}
            </label>
            <input
              ref={personalRef}
              id="join-personal"
              value={personal}
              onChange={(e) => setPersonal(normalizePersonalCode(e.target.value))}
              dir="ltr"
              autoCapitalize="characters"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="go"
              aria-invalid={(submitted && !personalOk) || undefined}
              aria-describedby="join-personal-help"
              className={`${fieldClass} text-center text-xl font-bold tracking-[0.15em] uppercase`}
            />
            <p id="join-personal-help" className={submitted && !personalOk ? 'text-sm font-medium text-over' : 'text-sm text-muted'}>
              {submitted && !personalOk ? t('join.personalLength') : t('join.personalHelp')}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <label htmlFor="join-name" className="font-medium">
              {t('create.name')}
            </label>
            <input
              ref={nameRef}
              id="join-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={LIMITS.maxNameLength}
              autoComplete="given-name"
              enterKeyHint="go"
              aria-invalid={(submitted && !nameOk) || undefined}
              aria-describedby={submitted && !nameOk ? 'join-name-error' : undefined}
              className={fieldClass}
            />
            {submitted && !nameOk && (
              <p id="join-name-error" className="text-sm font-medium text-over">
                {t('create.nameRequired')}
              </p>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            setRejoin((r) => !r)
            setSubmitted(false)
            setError(null)
          }}
          className="min-h-12 self-start text-start font-medium text-primary underline underline-offset-4"
        >
          {rejoin ? t('join.newToggle') : t('join.rejoinToggle')}
        </button>

        <div className="mt-auto flex flex-col gap-3">
          {error && (
            <p role="alert" className="rounded-2xl bg-over-soft px-4 py-2 text-sm font-medium text-over">
              {t(error)}
            </p>
          )}
          <Button type="submit" className="min-h-14 w-full text-lg" disabled={busy}>
            {rejoin ? t('join.rejoinSubmit') : t('join.submit')}
          </Button>
        </div>
      </form>
    </main>
  )
}
