// The app's language (SPEC section 9): Hebrew by default, English as a choice kept on this device.
// It is read once at startup. Switching reloads the app, so every text, date and amount follows it.

import { APP } from '../config.ts'

export type Lang = 'he' | 'en'

const KEY = `${APP.slug}.lang`

function stored(): Lang {
  try {
    return localStorage.getItem(KEY) === 'en' ? 'en' : 'he'
  } catch {
    return 'he'
  }
}

export const LANG: Lang = typeof window === 'undefined' ? 'he' : stored()
export const DIR: 'rtl' | 'ltr' = LANG === 'en' ? 'ltr' : 'rtl'
/** Dates and amounts: Hebrew, or English as used in Israel ("₪45", "10 Sept"). */
export const LOCALE = LANG === 'en' ? 'en-IL' : 'he-IL'

export function setLang(lang: Lang): void {
  try {
    localStorage.setItem(KEY, lang)
  } catch {
    // Without storage the choice cannot be kept.
  }
  window.location.reload()
}
