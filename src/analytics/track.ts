// Event helpers (SPEC section 11). Never put amounts or names in props.

export type BudgetBucket = 'under_5k' | '5k_to_10k' | '10k_to_20k' | 'over_20k'

export function budgetBucket(budgetAgorot: number): BudgetBucket {
  const shekels = budgetAgorot / 100
  if (shekels < 5_000) return 'under_5k'
  if (shekels < 10_000) return '5k_to_10k'
  if (shekels <= 20_000) return '10k_to_20k'
  return 'over_20k'
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
  return iosStandalone || window.matchMedia?.('(display-mode: standalone)').matches === true
}
