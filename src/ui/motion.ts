import { useEffect, useRef, useState } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.(QUERY).matches === true
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(prefersReducedMotion)
  useEffect(() => {
    const mq = window.matchMedia?.(QUERY)
    if (!mq) return
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

/** Counts from the previous value to `target` (integers) with ease-out. No animation on first render. */
export function useAnimatedNumber(target: number, durationMs: number): number {
  const reduced = useReducedMotion()
  const [value, setValue] = useState(target)
  const current = useRef(target)

  useEffect(() => {
    const from = current.current
    if (reduced || from === target || typeof requestAnimationFrame === 'undefined') {
      current.current = target
      setValue(target)
      return
    }
    const start = performance.now()
    let frame = requestAnimationFrame(function step() {
      // Read the clock here: the rAF timestamp's origin is not the same in every engine.
      const p = Math.min(1, Math.max(0, (performance.now() - start) / durationMs))
      const eased = 1 - (1 - p) ** 3
      const next = Math.round(from + (target - from) * eased)
      current.current = next
      setValue(next)
      if (p < 1) frame = requestAnimationFrame(step)
    })
    return () => cancelAnimationFrame(frame)
  }, [target, durationMs, reduced])

  return value
}
