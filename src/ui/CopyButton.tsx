import { Check, Copy } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { t } from '../i18n/index.ts'
import { cls } from './cls.ts'
import { useToast } from './Toast.tsx'

/** The Clipboard API, or a hidden text field where it is missing (older WebViews). */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const area = document.createElement('textarea')
      area.value = text
      area.setAttribute('readonly', '')
      area.style.position = 'fixed'
      area.style.opacity = '0'
      document.body.append(area)
      area.select()
      const ok = document.execCommand('copy')
      area.remove()
      return ok
    } catch {
      return false
    }
  }
}

/**
 * A small copy icon next to a code. Copied: a check mark for a moment (and a word for screen
 * readers), no toast, so nothing covers the next code. Only a failure gets a toast.
 */
export function CopyButton({ text, label, className }: { text: string; label: string; className?: string }) {
  const toast = useToast()
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  const copy = async () => {
    const ok = await copyText(text)
    if (!ok) {
      toast.show({ message: t('common.copyFailed'), durationMs: 5000 })
      return
    }
    setCopied(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => void copy()}
      className={cls(
        'grid size-10 shrink-0 touch-manipulation place-items-center rounded-full transition-colors duration-150 active:bg-black/5',
        className,
      )}
    >
      {copied ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
      <span role="status" className="sr-only">
        {copied ? t('common.copied') : ''}
      </span>
    </button>
  )
}
