import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { t } from '../i18n/index.ts'

/** Full-height bottom sheet inside the 480px column. The page behind it is made inert by the caller. */
export function Sheet({
  title,
  titleId,
  onClose,
  children,
}: {
  title: string
  titleId: string
  onClose: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    ref.current?.focus({ preventScroll: true })
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  return (
    <>
      <div aria-hidden="true" className="fixed inset-0 z-40 animate-fade-in bg-black/30" onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.5rem)] bottom-0 z-50 mx-auto flex max-w-[480px] animate-sheet-up flex-col rounded-t-3xl bg-surface pb-[env(safe-area-inset-bottom)] shadow-2xl outline-none"
      >
        <header className="flex h-14 shrink-0 items-center justify-between gap-2 ps-5 pe-2 [@media(max-height:700px)]:h-12">
          <h2 id={titleId} className="text-lg font-medium">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="grid size-12 touch-manipulation place-items-center rounded-full text-muted active:bg-bg"
          >
            <X size={24} aria-hidden="true" />
          </button>
        </header>
        {children}
      </div>
    </>
  )
}
