import { Send } from 'lucide-react'
import { t } from '../../i18n/index.ts'
import { Button } from '../../ui/Button.tsx'
import { useToast, type ToastApi } from '../../ui/Toast.tsx'

export function inviteLink(code: string): string {
  return `${window.location.origin}/join/${code}`
}

/** The way back to your own seat: the personal code in a link. What follows the # never reaches a server. */
export function returnLink(personalCode: string): string {
  return `${window.location.origin}/back#${personalCode}`
}

/** The invite code, big and readable. */
export function InviteCode({ code, className = 'text-4xl' }: { code: string; className?: string }) {
  // aria-label on a <p> is ignored, so screen readers get their own copy, letter by letter. It sits
  // outside the visible code, so selecting and copying the code copies only the code.
  return (
    <>
      <p aria-hidden="true" className={`font-bold tracking-[0.25em] tabular-nums ${className}`} dir="ltr">
        {code}
      </p>
      <span className="sr-only">{code.split('').join(' ')}</span>
    </>
  )
}

/** The phone's share sheet with a message that holds a link; without a share sheet, the link is copied. */
async function shareOrCopy(text: string, link: string, copiedMessage: string, toast: ToastApi): Promise<void> {
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
    toast.show({ message: copiedMessage })
  } catch {
    toast.show({ message: link, durationMs: 8000 })
  }
}

/** "Send to myself": the return link, to keep in a chat with yourself, a note or an email. */
export function sendReturnLink(personalCode: string, toast: ToastApi): Promise<void> {
  const link = returnLink(personalCode)
  return shareOrCopy(t('settings.selfShareText', { link }), link, t('settings.selfCopied'), toast)
}

/** "Send invite": the phone's share sheet with the SPEC text and link; falls back to copying the link. */
export function ShareInviteButton({ code, className }: { code: string; className?: string }) {
  const toast = useToast()
  const share = () => {
    const link = inviteLink(code)
    return shareOrCopy(t('invite.shareText', { link }), link, t('invite.copied'), toast)
  }
  return (
    <Button className={className} onClick={() => void share()}>
      <Send size={20} aria-hidden="true" className="rtl:-scale-x-100" />
      {t('invite.share')}
    </Button>
  )
}

/** "Send to myself", under the personal code. */
export function SendToSelfButton({ personalCode, className }: { personalCode: string; className?: string }) {
  const toast = useToast()
  return (
    <Button variant="secondary" className={className} onClick={() => void sendReturnLink(personalCode, toast)}>
      <Send size={20} aria-hidden="true" className="rtl:-scale-x-100" />
      {t('settings.sendToSelf')}
    </Button>
  )
}
