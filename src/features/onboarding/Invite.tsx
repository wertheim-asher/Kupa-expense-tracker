import { useNavigate } from 'react-router'
import { useReadyData } from '../../app/DataProvider.tsx'
import { t } from '../../i18n/index.ts'
import { Button } from '../../ui/Button.tsx'
import { InviteCode, ShareInviteButton } from './InviteShare.tsx'

/** Right after creating a budget: invite the partner, or do it later from settings. */
export function Invite() {
  const { household } = useReadyData()
  const navigate = useNavigate()

  return (
    <main className="flex flex-1 flex-col px-6 pt-12 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <h1 className="text-3xl font-bold">{t('invite.title')}</h1>
        <p className="max-w-xs text-lg text-muted">{t('invite.body')}</p>
        <div className="mt-6 w-full rounded-2xl bg-surface px-6 py-6">
          <p className="text-sm text-muted">{t('invite.codeLabel')}</p>
          <InviteCode code={household.inviteCode} className="mt-1 text-5xl" />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <ShareInviteButton code={household.inviteCode} className="min-h-14 w-full text-lg" />
        <Button variant="ghost" className="w-full" onClick={() => navigate('/', { replace: true })}>
          {t('invite.later')}
        </Button>
      </div>
    </main>
  )
}
