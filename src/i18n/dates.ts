import { LOCALE } from '../config.ts'
import { addDays, type Cycle } from '../domain/cycle.ts'
import type { IsoDate } from '../domain/types.ts'
import { t } from './index.ts'

// Calendar dates are formatted at UTC midnight with timeZone UTC, so no shift can move the day.
const dayMonth = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', timeZone: 'UTC' })
const weekdayDayMonth = new Intl.DateTimeFormat(LOCALE, {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
})

function utc(date: IsoDate): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

/** "10 בספט׳ עד 9 באוק׳" */
export function cycleLabel(cycle: Cycle): string {
  return t('home.cycleLabel', { start: dayMonth.format(utc(cycle.start)), end: dayMonth.format(utc(cycle.lastDay)) })
}

/** "29 בספט׳" */
export function shortDate(date: IsoDate): string {
  return dayMonth.format(utc(date))
}

/** "היום", "אתמול", or a short localized date. */
export function dayLabel(date: IsoDate, today: IsoDate): string {
  if (date === today) return t('home.today')
  if (date === addDays(today, -1)) return t('home.yesterday')
  return weekdayDayMonth.format(utc(date))
}
