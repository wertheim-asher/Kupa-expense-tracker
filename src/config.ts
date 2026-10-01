// Single place for the product name, limits and fixed lists.
// Imported by vite.config.ts too, so keep this file free of browser APIs.

export const APP = {
  /** Display name (Hebrew UI). Change it here only. */
  name: 'קופה',
  /** Latin slug, used in file names and storage keys. */
  slug: 'kupa',
  version: '0.1.0',
  description: 'תמיד יודעים כמה נשאר עד החיוב הבא',
  owner: 'אשר וורטהיים',
  copyrightYear: 2026,
} as const

export const LIMITS = {
  /** ₪100,000 in agorot. */
  maxAmountAgorot: 10_000_000,
  maxIntegerDigits: 6,
  maxDecimals: 2,
  maxNameLength: 30,
  minCycleDay: 1,
  maxCycleDay: 28,
  defaultCycleDay: 10,
  /** How far back an expense date may go. */
  maxPastDays: 365,
} as const

export const TIMING = {
  undoMs: 5000,
  highlightMs: 1500,
  numberAnimMs: 400,
} as const

export const TIME_ZONE = 'Asia/Jerusalem'
export const LOCALE = 'he-IL'
