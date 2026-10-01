import { LIMITS } from '../../config.ts'
import { addDays } from '../../domain/cycle.ts'
import { isAllowedSpentOn } from '../../data/validate.ts'
import type { IsoDate } from '../../domain/types.ts'
import { fullDate, shortDate } from '../../i18n/dates.ts'
import { t } from '../../i18n/index.ts'
import { cls } from '../../ui/cls.ts'

export type DayChoice = { kind: 'today' } | { kind: 'yesterday' } | { kind: 'other'; date: IsoDate }

/** The Israel date a choice stands for, computed when it is used (so midnight is handled). */
export function resolveDay(choice: DayChoice, today: IsoDate): IsoDate {
  if (choice.kind === 'today') return today
  if (choice.kind === 'yesterday') return addDays(today, -1)
  return choice.date
}

const chip =
  'relative inline-flex min-h-12 touch-manipulation items-center justify-center rounded-full border px-4 text-sm font-medium transition-colors duration-150 disabled:opacity-50'
const on = 'border-primary bg-primary-soft text-primary'
const off = 'border-border bg-surface text-text active:bg-bg'

/**
 * "Today" (default) / "Yesterday" / "Other date". Other date is a native date input laid
 * transparently over the chip, so every phone opens its own picker; min 365 days ago, max today.
 */
export function DateChips({
  value,
  onChange,
  today,
  disabled = false,
}: {
  value: DayChoice
  onChange: (choice: DayChoice) => void
  today: IsoDate
  disabled?: boolean
}) {
  const yesterday = addDays(today, -1)
  // iOS ignores min/max in its picker and desktop lets you type a year, so the value can be out of range.
  const otherInvalid = value.kind === 'other' && !isAllowedSpentOn(value.date, today)
  const pickOther = (date: string) => {
    if (!date) return
    if (date === today) onChange({ kind: 'today' })
    else if (date === yesterday) onChange({ kind: 'yesterday' })
    else onChange({ kind: 'other', date })
  }

  return (
    <div role="group" aria-label={t('add.date')} className="flex flex-wrap justify-center gap-2">
      <button
        type="button"
        disabled={disabled}
        aria-pressed={value.kind === 'today'}
        onClick={() => onChange({ kind: 'today' })}
        className={cls(chip, value.kind === 'today' ? on : off)}
      >
        {t('add.dateToday')}
      </button>
      <button
        type="button"
        disabled={disabled}
        aria-pressed={value.kind === 'yesterday'}
        onClick={() => onChange({ kind: 'yesterday' })}
        className={cls(chip, value.kind === 'yesterday' ? on : off)}
      >
        {t('add.dateYesterday')}
      </button>
      <label
        className={cls(
          chip,
          otherInvalid ? 'border-over bg-over-soft text-over' : value.kind === 'other' ? on : off,
          'has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary',
          disabled && 'pointer-events-none opacity-50',
        )}
      >
        <span aria-hidden="true">
          {value.kind !== 'other' ? `${t('add.dateOther')}…` : otherInvalid ? fullDate(value.date) : shortDate(value.date)}
        </span>
        <input
          type="date"
          disabled={disabled}
          aria-label={t('add.dateOther')}
          aria-invalid={otherInvalid || undefined}
          aria-describedby={otherInvalid ? 'add-date-error' : undefined}
          data-keypad-passthrough=""
          min={addDays(today, -LIMITS.maxPastDays)}
          max={today}
          value={value.kind === 'other' ? value.date : ''}
          onChange={(e) => pickOther(e.target.value)}
          onClick={(e) => {
            // Desktop browsers only open the calendar from its icon; open it from anywhere on the chip.
            try {
              e.currentTarget.showPicker?.()
            } catch {
              // Not allowed here (or already open); the native control still works.
            }
          }}
          className="absolute inset-0 h-full w-full cursor-pointer text-base opacity-0"
        />
      </label>
    </div>
  )
}
