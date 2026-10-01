import { formatMoney } from '../domain/money.ts'
import { cls } from './cls.ts'

/** Every amount sits in <bdi>, so digits and ₪ never flip in RTL text. */
export function Money({ agorot, className }: { agorot: number; className?: string }) {
  return <bdi className={cls('whitespace-nowrap tabular-nums', className)}>{formatMoney(agorot)}</bdi>
}
