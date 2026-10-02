import { useNavigate } from 'react-router'
import { useMode } from '../../app/ModeContext.tsx'
import { APP } from '../../config.ts'
import { t } from '../../i18n/index.ts'
import { Button } from '../../ui/Button.tsx'
import { syncEnabled } from '../../data/supabase.ts'

// "Join with a code" appears only when this build has the shared backend.
export function Welcome() {
  const navigate = useNavigate()
  const { setMode } = useMode()

  return (
    <main className="flex flex-1 flex-col px-6 pt-12 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <img src="/icon.svg" alt="" width={96} height={96} className="size-24" />
        <h1 className="mt-6 text-5xl font-bold">{APP.name}</h1>
        <p className="mt-3 max-w-xs text-xl text-muted">{t('welcome.tagline')}</p>
      </div>
      <div className="flex flex-col gap-2">
        <Button className="min-h-14 w-full text-lg" onClick={() => navigate('/create', { state: { fromApp: true } })}>
          {t('welcome.create')}
        </Button>
        {syncEnabled && (
          <Button variant="secondary" className="min-h-14 w-full text-lg" onClick={() => navigate('/join', { state: { fromApp: true } })}>
            {t('welcome.join')}
          </Button>
        )}
        <Button
          variant="ghost"
          className="w-full underline underline-offset-4"
          onClick={() => {
            setMode('demo')
            navigate('/', { replace: true })
          }}
        >
          {t('welcome.demo')}
        </Button>
      </div>
    </main>
  )
}
