// Light or dark (SPEC section 10): the person's choice in settings, or the device's setting.
// The choice is kept on this device. index.html applies it before the first paint (no flash);
// keep its small inline script in step with this file.

import { APP } from '../config.ts'

export type ThemeChoice = 'light' | 'dark' | 'system'

const KEY = `${APP.slug}.theme`
const THEME_COLOR = { light: '#0F766E', dark: '#111113' } as const

export function themeChoice(): ThemeChoice {
  try {
    const value = localStorage.getItem(KEY)
    return value === 'light' || value === 'dark' ? value : 'system'
  } catch {
    return 'system'
  }
}

function systemIsDark(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches
}

/** Sets `data-theme` on <html> (the CSS reads it) and the browser bar color. */
export function applyTheme(choice: ThemeChoice = themeChoice()): void {
  const theme = choice === 'system' ? (systemIsDark() ? 'dark' : 'light') : choice
  document.documentElement.dataset.theme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme])
}

export function setThemeChoice(choice: ThemeChoice): void {
  try {
    if (choice === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, choice)
  } catch {
    // Without storage the choice lasts until the app is closed.
  }
  applyTheme(choice)
}

/** "Same as device": follow the device when it switches (for example at sunset). */
export function followSystemTheme(): () => void {
  if (typeof window.matchMedia !== 'function') return () => undefined
  const query = window.matchMedia('(prefers-color-scheme: dark)')
  const onChange = () => {
    if (themeChoice() === 'system') applyTheme('system')
  }
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}
