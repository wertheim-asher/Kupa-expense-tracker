import type { Member } from '../domain/types.ts'
import { t } from '../i18n/index.ts'
import { cls } from './cls.ts'

export function initialOf(name: string): string {
  return Array.from(name.trim())[0] ?? '?'
}

/** Small colored initial for the member who paid. The full name is there for screen readers. */
export function MemberChip({
  member,
  size = 'sm',
  paidByLabel = true,
}: {
  member: Member | undefined
  size?: 'sm' | 'md'
  /** Screen-reader "paid by {name}" text; off where the name is already shown next to the chip. */
  paidByLabel?: boolean
}) {
  const name = member?.displayName ?? ''
  return (
    <span
      className={cls(
        'relative grid shrink-0 place-items-center rounded-full font-medium text-on-member',
        size === 'sm' ? 'size-6 text-[13px]' : 'size-9 text-base',
        member?.color === 'violet' ? 'bg-member-violet' : 'bg-member-teal',
      )}
    >
      <span aria-hidden="true">{initialOf(name)}</span>
      {paidByLabel && <span className="sr-only">{t('home.paidBy', { name })}</span>}
    </span>
  )
}
