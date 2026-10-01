import { CATEGORY_EMOJI, CATEGORY_IDS, type CategoryId } from '../domain/categories.ts'
import { categoryName, t } from '../i18n/index.ts'
import { cls } from './cls.ts'

/**
 * 4 x 2 category buttons in the fixed order.
 * `inactive` dims the buttons but keeps them tappable (so a tap can explain why);
 * `disabled` blocks them for real (while saving).
 */
export function CategoryGrid({
  onPick,
  selected,
  inactive = false,
  disabled = false,
}: {
  onPick: (id: CategoryId) => void
  selected?: CategoryId | null
  inactive?: boolean
  disabled?: boolean
}) {
  return (
    <div role="group" aria-label={t('add.categories')} className="grid grid-cols-4 gap-2">
      {CATEGORY_IDS.map((id) => {
        const isSelected = selected === id
        return (
          <button
            key={id}
            type="button"
            disabled={disabled}
            aria-disabled={inactive || undefined}
            aria-pressed={selected === undefined ? undefined : isSelected}
            onClick={() => onPick(id)}
            className={cls(
              'flex min-h-[76px] touch-manipulation flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-center transition-[opacity,transform,background-color] duration-150 ease-out',
              isSelected ? 'bg-primary-soft ring-2 ring-primary' : 'bg-bg',
              inactive || disabled ? 'opacity-40' : 'active:scale-95',
            )}
          >
            <span aria-hidden="true" className="text-[28px] leading-none">
              {CATEGORY_EMOJI[id]}
            </span>
            <span className="text-[13px] leading-tight">{categoryName(id)}</span>
          </button>
        )
      })}
    </div>
  )
}
