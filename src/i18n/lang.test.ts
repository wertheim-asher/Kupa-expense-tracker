import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  localStorage.removeItem('kupa.lang')
  vi.resetModules()
})

describe('language', () => {
  it('is Hebrew, right to left, by default, and the app is called Kupa', async () => {
    localStorage.removeItem('kupa.lang')
    const i18n = await import('./index.ts')
    expect([i18n.LANG, i18n.DIR, i18n.LOCALE]).toEqual(['he', 'rtl', 'he-IL'])
    expect(i18n.t('home.lastDay')).toBe('יום אחרון במחזור')
    expect(i18n.categoryName('transport')).toBe('רכב ותחבורה')
    expect(i18n.appName()).toBe('Kupa')
  })

  it('switches everything to English, left to right, when chosen on this device', async () => {
    localStorage.setItem('kupa.lang', 'en')
    const i18n = await import('./index.ts')
    const { formatMoney } = await import('../domain/money.ts')
    expect([i18n.LANG, i18n.DIR, i18n.LOCALE]).toEqual(['en', 'ltr', 'en-IL'])
    expect(i18n.t('home.lastDay')).toBe('Last day of the cycle')
    expect(i18n.around('home.left', 'amount')).toEqual({ before: '', after: 'left this cycle' })
    expect(i18n.categoryName('transport')).toBe('Car and transport')
    expect(i18n.appName()).toBe('Kupa')
    expect(formatMoney(4500)).toBe('₪45')
  })

  it('stays Hebrew for a stored Hebrew choice or anything unknown', async () => {
    for (const value of ['he', 'fr', '']) {
      localStorage.setItem('kupa.lang', value)
      vi.resetModules()
      expect((await import('./lang.ts')).LANG).toBe('he')
    }
  })
})
