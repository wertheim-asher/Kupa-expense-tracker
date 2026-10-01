import { Delete } from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { KeypadAction } from '../domain/keypad.ts'
import { t } from '../i18n/index.ts'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back'] as const

function actionFor(key: string): KeypadAction | null {
  if (/^\d$/.test(key)) return { type: 'digit', digit: key }
  if (key === '.' || key === ',') return { type: 'dot' }
  if (key === 'back' || key === 'Backspace') return { type: 'backspace' }
  return null
}

/** 3 x 4 phone keypad, always left-to-right. Also accepts a physical keyboard. */
export function Keypad({ onKey, disabled = false }: { onKey: (action: KeypadAction) => void; disabled?: boolean }) {
  const onKeyRef = useRef(onKey)
  onKeyRef.current = onKey

  useEffect(() => {
    if (disabled) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      const typingInField = target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')
      // The add sheet's hidden date input keeps focus after a pick; typing still means the amount.
      if (typingInField && target.dataset.keypadPassthrough === undefined) return
      const action = actionFor(event.key)
      if (!action) return
      event.preventDefault()
      onKeyRef.current(action)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [disabled])

  return (
    <div dir="ltr" className="grid shrink-0 grid-cols-3 gap-2 px-4 pt-2 pb-3">
      {KEYS.map((key) => {
        const label = key === 'back' ? t('key.backspace') : key === '.' ? t('key.dot') : key
        return (
          <button
            key={key}
            type="button"
            disabled={disabled}
            aria-label={label}
            onClick={() => {
              const action = actionFor(key)
              if (action) onKey(action)
            }}
            className="grid min-h-16 touch-manipulation select-none place-items-center rounded-2xl bg-bg text-[26px] font-medium tabular-nums transition-colors duration-150 active:bg-border disabled:opacity-50"
          >
            {key === 'back' ? <Delete size={28} aria-hidden="true" /> : <span aria-hidden="true">{key}</span>}
          </button>
        )
      })}
    </div>
  )
}
