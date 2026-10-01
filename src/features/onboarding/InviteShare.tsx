import { Send } from 'lucide-react'
import { t } from '../../i18n/index.ts'
import { Button } from '../../ui/Button.tsx'
import { useToast } from '../../ui/Toast.tsx'

export function inviteLink(code: string): string {
  return `${window.location.origin}/join/${code}`
}

/** The invite code, big and readable, letters spaced for reading aloud. */
export function InviteCode({ code, className = 'text-4xl' }: { code: string; className?: string }) {
  return (
    <p className={`font-bold tracking-[0.25em] tabular-nums ${className}`} dir="ltr" aria-label={code.split('').join(' ')}>
      {code}
    </p>
  )
}

/** "Send invite": the phone's share sheet with the SPEC text and link; falls back to copying the link. */
export function ShareInviteButton({ code, className }: { code: string; className?: string }) {
  const toast = useToast()
  const share = async () => {
    const link = inviteLink(code)
    const text = t('invite.shareText', { link })
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ text })
        return
      } catch (error) {
        // Closing the share sheet is a normal choice, not an error.
        if (error instanceof DOMException && error.name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(link)
      toast.show({ message: t('invite.copied') })
    } catch {
      toast.show({ message: link, durationMs: 8000 })
    }
  }
  return (
    <Button className={className} onClick={() => void share()}>
      <Send size={20} aria-hidden="true" className="rtl:-scale-x-100" />
      {t('invite.share')}
    </Button>
  )
}
