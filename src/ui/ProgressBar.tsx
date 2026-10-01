import { t } from '../i18n/index.ts'
import { cls } from './cls.ts'

export type BudgetLevel = 'ok' | 'warn' | 'over'

/** Under 80%: primary. 80% to 100%: warn. Over 100%: over, bar full. */
export function budgetLevel(spentAgorot: number, budgetAgorot: number): BudgetLevel {
  if (spentAgorot > budgetAgorot) return 'over'
  if (spentAgorot >= budgetAgorot * 0.8) return 'warn'
  return 'ok'
}

const FILL: Record<BudgetLevel, string> = { ok: 'bg-primary', warn: 'bg-warn', over: 'bg-over' }

export function ProgressBar({ spentAgorot, budgetAgorot }: { spentAgorot: number; budgetAgorot: number }) {
  const percent = Math.round((spentAgorot / budgetAgorot) * 100)
  const width = Math.min(100, Math.max(0, (spentAgorot / budgetAgorot) * 100))
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.min(percent, 100)}
      aria-valuetext={t('home.progress', { percent })}
      className="h-2.5 w-full overflow-hidden rounded-full bg-border"
    >
      <div
        className={cls('h-full rounded-full transition-[width] duration-200 ease-out', FILL[budgetLevel(spentAgorot, budgetAgorot)])}
        style={{ width: `${width}%` }}
      />
    </div>
  )
}
