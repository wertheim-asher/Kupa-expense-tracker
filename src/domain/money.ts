// Money (SPEC section 6). Integer agorot only, never floats for stored values.

import { LIMITS } from '../config.ts'
import { LOCALE } from '../i18n/lang.ts'

const AMOUNT_RE = /^(\d+)(?:\.(\d{0,2}))?$/

/**
 * Parses a typed amount ("45", "12.9", "12.90") into agorot.
 * Returns null when the text is malformed, has more than 2 decimals,
 * is zero, or is above ₪100,000.
 */
export function parseAmount(text: string): number | null {
  const agorot = toAgorot(text)
  if (agorot === null || agorot <= 0 || agorot > LIMITS.maxAmountAgorot) return null
  return agorot
}

/** True when well-formed text is above ₪100,000 (drives the "up to" hint). */
export function exceedsMax(text: string): boolean {
  const agorot = toAgorot(text)
  return agorot !== null && agorot > LIMITS.maxAmountAgorot
}

/** Well-formed text (max 6 integer digits, max 2 decimals) to agorot, no range check. */
function toAgorot(text: string): number | null {
  const m = AMOUNT_RE.exec(text)
  if (!m) return null
  const whole = m[1]
  if (whole.replace(/^0+/, '').length > LIMITS.maxIntegerDigits) return null
  const frac = (m[2] ?? '').padEnd(2, '0')
  const agorot = Number(whole) * 100 + Number(frac)
  return Number.isSafeInteger(agorot) ? agorot : null
}

export function isValidAmount(agorot: number): boolean {
  return Number.isInteger(agorot) && agorot > 0 && agorot <= LIMITS.maxAmountAgorot
}

/**
 * Normalizes what people type into a regular text field (budget input):
 * drops spaces and ₪, removes thousands separators ("9,000"),
 * and treats a decimal comma ("12,5") as a dot.
 */
export function normalizeTypedAmount(text: string): string {
  const s = text.replace(/[\s ₪]/g, '')
  if (/^\d{1,3}(,\d{3})+(\.\d*)?$/.test(s)) return s.replace(/,/g, '')
  return s.replace(',', '.')
}

const formatters = new Map<string, Intl.NumberFormat>()

function currencyFormat(locale: string, decimals: 0 | 2): Intl.NumberFormat {
  const key = `${locale}|${decimals}`
  let f = formatters.get(key)
  if (!f) {
    f = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'ILS',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
    formatters.set(key, f)
  }
  return f
}

/** Whole amounts show no decimals, others show 2. Agorot in, display text out. */
export function formatMoney(agorot: number, locale: string = LOCALE): string {
  const whole = agorot % 100 === 0
  return currencyFormat(locale, whole ? 0 : 2).format(agorot / 100)
}

/** Rounded to the nearest shekel, halves away from zero, so -₪1.50 and ₪1.50 round alike. */
export function roundToShekel(agorot: number): number {
  return Math.sign(agorot) * Math.round(Math.abs(agorot) / 100) * 100 || 0
}

/**
 * The home big number in whole shekels: nearest shekel, except that any overage
 * shows as at least ₪1, so the screen never says "over budget by ₪0".
 */
export function leftForDisplay(leftAgorot: number): number {
  const shekels = roundToShekel(leftAgorot) / 100
  return leftAgorot < 0 ? Math.min(shekels, -1) : shekels
}

/** Floor of max(left, 0) / daysLeft, in whole shekels, returned as agorot. */
export function perDayAgorot(leftAgorot: number, daysLeft: number): number {
  if (daysLeft <= 0) return 0
  return Math.floor(Math.max(leftAgorot, 0) / 100 / daysLeft) * 100
}

/** Agorot as a plain decimal string for CSV ("45.00"). */
export function agorotToDecimalString(agorot: number): string {
  const sign = agorot < 0 ? '-' : ''
  const abs = Math.abs(agorot)
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`
}

/**
 * Formats keypad text while typing ("1234.5" → "1,234.5 ₪" in he-IL), keeping
 * a trailing dot and partial decimals that formatMoney would round away.
 */
export function formatTyped(raw: string, locale: string = LOCALE): string {
  const [whole, frac] = raw.split('.')
  const parts = currencyFormat(locale, 0).formatToParts(Number(whole || '0'))
  let firstNumeric = -1
  let lastNumeric = -1
  parts.forEach((p, i) => {
    if (p.type === 'integer' || p.type === 'group') {
      if (firstNumeric === -1) firstNumeric = i
      lastNumeric = i
    }
  })
  const decimalSep = currencyFormat(locale, 2).formatToParts(1.5).find((p) => p.type === 'decimal')?.value ?? '.'
  // The number sits in a left-to-right isolate (LRI ... PDI), so a trailing "." stays after the digits in RTL.
  return parts
    .map((p, i) => {
      let value = p.value
      if (i === lastNumeric && frac !== undefined) value = `${value}${decimalSep}${frac}`
      if (i === firstNumeric) value = `⁦${value}`
      if (i === lastNumeric) value = `${value}⁩`
      return value
    })
    .join('')
}
