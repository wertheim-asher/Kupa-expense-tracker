import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

export interface ToastOptions {
  message: ReactNode
  action?: { label: string; onClick: () => void }
  durationMs?: number
}

interface ToastState extends ToastOptions {
  id: number
}

interface ToastApi {
  show(options: ToastOptions): void
  dismiss(): void
}

const ToastContext = createContext<ToastApi | null>(null)

export function useToast(): ToastApi {
  const api = useContext(ToastContext)
  if (!api) throw new Error('useToast outside ToastProvider')
  return api
}

/** One toast at a time; a new one replaces the old. Announced politely to screen readers. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null)
  const nextId = useRef(1)

  const dismiss = useCallback(() => setToast(null), [])
  const show = useCallback((options: ToastOptions) => setToast({ ...options, id: nextId.current++ }), [])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast((t) => (t?.id === toast.id ? null : t)), toast.durationMs ?? 3000)
    return () => clearTimeout(timer)
  }, [toast])

  const api = useMemo(() => ({ show, dismiss }), [show, dismiss])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-[35] mx-auto flex max-w-[480px] justify-center px-4"
      >
        {toast && (
          <div
            key={toast.id}
            className="pointer-events-auto flex w-full animate-toast-in items-center gap-2 rounded-2xl bg-text py-2 ps-4 pe-2 text-white shadow-lg"
          >
            <p className="min-w-0 flex-1 py-1.5">{toast.message}</p>
            {toast.action && (
              <button
                type="button"
                onClick={() => {
                  const action = toast.action
                  setToast(null)
                  action?.onClick()
                }}
                className="min-h-12 shrink-0 touch-manipulation rounded-full px-4 font-medium text-primary-soft active:bg-white/10"
              >
                {toast.action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  )
}
