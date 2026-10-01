// Fixed list, fixed order (SPEC section 8). Never sort by usage.

export const CATEGORY_IDS = [
  'groceries',
  'eating_out',
  'transport',
  'home',
  'kids',
  'health',
  'fun',
  'other',
] as const

export type CategoryId = (typeof CATEGORY_IDS)[number]

export const CATEGORY_EMOJI: Record<CategoryId, string> = {
  groceries: '🛒',
  eating_out: '🍕',
  transport: '⛽',
  home: '🏠',
  kids: '🧸',
  health: '💊',
  fun: '🎉',
  other: '📦',
}

export function isCategoryId(value: unknown): value is CategoryId {
  return typeof value === 'string' && (CATEGORY_IDS as readonly string[]).includes(value)
}
