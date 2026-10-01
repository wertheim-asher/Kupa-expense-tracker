import { formatTyped } from '../domain/money.ts'
import { t } from '../i18n/index.ts'
import { cls } from './cls.ts'

/** The amount being typed. `shakeKey` > 0 replays a short shake (tap on a disabled category). */
export function AmountDisplay({ raw, shakeKey, className }: { raw: string; shakeKey: number; className?: string }) {
  return (
    <div className={cls('text-center font-bold tabular-nums', className)}>
      <span className="sr-only">{t('add.amount')}</span>
      <span key={shakeKey} className={cls('inline-block', shakeKey > 0 && 'animate-shake', raw ? 'text-text' : 'text-muted')}>
        <bdi className="whitespace-nowrap">{formatTyped(raw)}</bdi>
      </span>
    </div>
  )
}
