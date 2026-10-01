import { describe, expect, it } from 'vitest'
import {
  agorotToDecimalString,
  exceedsMax,
  formatMoney,
  formatTyped,
  leftForDisplay,
  normalizeTypedAmount,
  parseAmount,
  perDayAgorot,
  roundToShekel,
} from './money.ts'

// Intl output contains bidi marks and narrow spaces; compare on visible characters.
const plain = (s: string) => s.replace(/[‎‏؜]/g, '').replace(/[  ]/g, ' ')

describe('parseAmount (SPEC section 6)', () => {
  it.each<[string, number | null]>([
    ['45', 4500],
    ['12.9', 1290],
    ['12.90', 1290],
    ['0', null],
    ['', null],
    ['100000', 10_000_000],
    ['100000.01', null],
  ])('"%s" → %s', (text, expected) => {
    expect(parseAmount(text)).toBe(expected)
  })

  it.each<[string, number | null]>([
    ['0.01', 1],
    ['0.', null],
    ['12.', 1200],
    ['12.999', null],
    ['1234567', null],
    ['-5', null],
    ['1e3', null],
    ['abc', null],
    ['0.00', null],
    ['99999.99', 9_999_999],
  ])('edge "%s" → %s', (text, expected) => {
    expect(parseAmount(text)).toBe(expected)
  })
})

describe('exceedsMax', () => {
  it.each<[string, boolean]>([
    ['100000', false],
    ['100000.01', true],
    ['999999', true],
    ['0.', false],
    ['', false],
  ])('"%s" → %s', (text, expected) => {
    expect(exceedsMax(text)).toBe(expected)
  })
})

describe('formatMoney', () => {
  it('whole amounts show no decimals', () => {
    const s = plain(formatMoney(4500))
    expect(s).toContain('45')
    expect(s).toContain('₪')
    expect(s).not.toMatch(/45\.00/)
  })

  it('non-whole amounts show 2 decimals', () => {
    expect(plain(formatMoney(1290))).toContain('12.90')
  })

  it('groups thousands', () => {
    expect(plain(formatMoney(124_000))).toContain('1,240')
  })

  it('works in English too', () => {
    expect(plain(formatMoney(124_000, 'en-US'))).toBe('₪1,240')
  })
})

describe('home number helpers', () => {
  it('rounds the big number to the nearest shekel, halves away from zero', () => {
    expect(roundToShekel(124_049)).toBe(124_000)
    expect(roundToShekel(124_050)).toBe(124_100)
    expect(roundToShekel(-23_040)).toBe(-23_000)
    expect(roundToShekel(-150)).toBe(-200)
    expect(roundToShekel(150)).toBe(200)
    expect(Object.is(roundToShekel(-30), 0)).toBe(true)
  })

  it('never shows "over budget by ₪0"', () => {
    expect(leftForDisplay(-30)).toBe(-1)
    expect(leftForDisplay(-1)).toBe(-1)
    expect(leftForDisplay(-150)).toBe(-2)
    expect(leftForDisplay(-23_040)).toBe(-230)
    expect(leftForDisplay(0)).toBe(0)
    expect(leftForDisplay(30)).toBe(0)
    expect(leftForDisplay(124_000)).toBe(1240)
  })

  it('per day is floor(max(left, 0) / daysLeft) in whole shekels', () => {
    expect(perDayAgorot(124_000, 12)).toBe(10_300) // 1240 / 12 = 103.33
    expect(perDayAgorot(-5_000, 12)).toBe(0)
    expect(perDayAgorot(99, 1)).toBe(0)
    expect(perDayAgorot(1_000, 0)).toBe(0)
  })
})

describe('CSV amount string', () => {
  it.each<[number, string]>([
    [4500, '45.00'],
    [1290, '12.90'],
    [1, '0.01'],
    [10_000_000, '100000.00'],
  ])('%i agorot → %s', (agorot, text) => {
    expect(agorotToDecimalString(agorot)).toBe(text)
  })
})

describe('normalizeTypedAmount (budget field)', () => {
  it.each<[string, string]>([
    ['9,000', '9000'],
    ['12,000.50', '12000.50'],
    ['12,5', '12.5'],
    [' 9000 ₪', '9000'],
  ])('"%s" → "%s"', (text, expected) => {
    expect(normalizeTypedAmount(text)).toBe(expected)
  })
})

describe('formatTyped (amount display while typing)', () => {
  it('keeps the trailing dot and partial decimals', () => {
    expect(plain(formatTyped('12.'))).toContain('12.')
    expect(plain(formatTyped('12.5'))).toContain('12.5')
    expect(plain(formatTyped('1234.56'))).toContain('1,234.56')
  })

  it('shows 0 for empty input', () => {
    expect(plain(formatTyped(''))).toContain('0')
    expect(plain(formatTyped(''))).toContain('₪')
  })
})
