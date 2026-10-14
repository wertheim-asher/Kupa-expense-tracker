// Single place for the product name, limits and fixed lists.
// Imported by vite.config.ts too, so keep this file free of browser APIs.

export const APP = {
  /** Display name (Hebrew UI) and its English form. Change them here only. */
  name: 'קופה',
  nameEn: 'Kupa',
  /** Latin slug, used in file names and storage keys. */
  slug: 'kupa',
  version: '0.1.0',
  description: 'תמיד יודעים כמה נשאר עד החיוב הבא',
  descriptionEn: "Always know what's left until the next card bill",
  owner: 'אשר וורטהיים',
  ownerEn: 'Asher Wertheim',
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
