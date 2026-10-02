import { afterEach, describe, expect, it } from 'vitest'
import { applyTheme, setThemeChoice, themeChoice } from './theme.ts'

afterEach(() => {
  localStorage.removeItem('kupa.theme')
  delete document.documentElement.dataset.theme
})

describe('theme', () => {
  it('follows the device by default (light when the device does not say dark)', () => {
    expect(themeChoice()).toBe('system')
    applyTheme()
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('keeps a light or dark choice on this device and applies it at once', () => {
    setThemeChoice('dark')
    expect(themeChoice()).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    setThemeChoice('light')
    expect(document.documentElement.dataset.theme).toBe('light')
    setThemeChoice('system')
    expect(localStorage.getItem('kupa.theme')).toBeNull()
    expect(themeChoice()).toBe('system')
  })
})
