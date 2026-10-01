// Keypad input reducer (SPEC section 6): the text the amount display shows.

import { LIMITS } from '../config.ts'

export type KeypadAction =
  | { type: 'digit'; digit: string }
  | { type: 'dot' }
  | { type: 'backspace' }
  | { type: 'clear' }
  | { type: 'set'; value: string }

export function keypadReducer(state: string, action: KeypadAction): string {
  switch (action.type) {
    case 'digit': {
      if (!/^\d$/.test(action.digit)) return state
      const dot = state.indexOf('.')
      if (dot === -1) {
        // Leading zeros are dropped: "0" then "7" becomes "7".
        if (state === '0') return action.digit
        if (state.length >= LIMITS.maxIntegerDigits) return state
        return state + action.digit
      }
      // A third decimal digit is ignored.
      if (state.length - dot - 1 >= LIMITS.maxDecimals) return state
      return state + action.digit
    }
    case 'dot': {
      if (state.includes('.')) return state
      // A leading "." becomes "0.".
      return state === '' ? '0.' : `${state}.`
    }
    case 'backspace':
      return state.slice(0, -1)
    case 'clear':
      return ''
    case 'set':
      return action.value
  }
}

/** Keypad text for an existing amount (edit sheet): 4500 → "45", 1290 → "12.9". */
export function agorotToKeypad(agorot: number): string {
  const whole = Math.floor(agorot / 100)
  const frac = agorot % 100
  if (frac === 0) return String(whole)
  return `${whole}.${String(frac).padStart(2, '0').replace(/0$/, '')}`
}
