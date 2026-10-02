import { ChevronLeft, ChevronRight, Clock, Plus, Settings as SettingsIcon, Wallet } from 'lucide-react'
import { Link, Outlet, useMatch, useNavigate } from 'react-router'
import { useReadyData } from '../../app/DataProvider.tsx'
import { LIMITS, TIMING } from '../../config.ts'
import { CATEGORY_EMOJI } from '../../domain/categories.ts'
import { addDays, daysLeft as countDaysLeft, shiftCycle } from '../../domain/cycle.ts'
import { leftForDisplay, perDayAgorot } from '../../domain/money.ts'
import type { Expense, IsoDate, Member } from '../../domain/types.ts'
import { cycleLabel, dayLabel } from '../../i18n/dates.ts'
import { around, categoryName, t, tx } from '../../i18n/index.ts'
import { cls } from '../../ui/cls.ts'
import { MemberChip } from '../../ui/MemberChip.tsx'
import { Money } from '../../ui/Money.tsx'
import { useAnimatedNumber } from '../../ui/motion.ts'
import { ProgressBar } from '../../ui/ProgressBar.tsx'
import { Skeleton } from '../../ui/Skeleton.tsx'
import { beginAddSession, justSaved } from '../add-expense/addSession.ts'

export function Home() {
  const { household, cycle, viewOffset, viewCycle, expenses, members, today, highlightIds, repo } = useReadyData()
  const navigate = useNavigate()
  const addOpen = useMatch('/add')
  const editOpen = useMatch('/expense/:id')
  const sheetOpen = Boolean(addOpen || editOpen)

  const spent = expenses.reduce((sum, e) => sum + e.amountAgorot, 0)
  const left = household.budgetAgorot - spent
  const days = countDaysLeft(today, cycle)
  // History: earlier cycles, back as far as expenses can be dated (a year).
  const past = viewOffset < 0
  const canGoBack = shiftCycle(cycle, household.cycleStartDay, -1).lastDay >= addDays(today, -LIMITS.maxPastDays)

  const startAdd = () => {
    beginAddSession(performance.now())
    repo.track('add_start')
    navigate('/add', { state: { fromApp: true } })
  }

  return (
    <>
      <div inert={sheetOpen} className="flex flex-1 flex-col">
        <header className="flex items-center justify-between gap-2 ps-1 pe-2 pt-2">
          <div className="flex min-w-0 items-center">
            <button
              type="button"
              onClick={() => viewCycle(viewOffset - 1)}
              disabled={!canGoBack}
              aria-label={t('home.prevCycle')}
              className="grid size-11 shrink-0 touch-manipulation place-items-center rounded-full text-muted active:bg-surface disabled:opacity-30"
            >
              <ChevronLeft size={22} aria-hidden="true" className="rtl:-scale-x-100" />
            </button>
            <h1 aria-live="polite" className="truncate text-[15px] font-medium text-muted">
              {cycleLabel(cycle, today)}
            </h1>
            <button
              type="button"
              onClick={() => viewCycle(viewOffset + 1)}
              disabled={!past}
              aria-label={t('home.nextCycle')}
              className={cls(
                'grid size-11 shrink-0 touch-manipulation place-items-center rounded-full text-muted active:bg-surface',
                !past && 'invisible',
              )}
            >
              <ChevronRight size={22} aria-hidden="true" className="rtl:-scale-x-100" />
            </button>
          </div>
          <Link
            to="/settings"
            state={{ fromApp: true }}
            aria-label={t('home.settings')}
            className="grid size-12 place-items-center rounded-full text-muted active:bg-surface"
          >
            <SettingsIcon size={24} aria-hidden="true" />
          </Link>
        </header>

        {past && (
          <div className="flex justify-center px-4 pt-1">
            <button
              type="button"
              onClick={() => viewCycle(0)}
              className="min-h-9 touch-manipulation rounded-full bg-primary-soft px-4 text-sm font-medium text-primary active:brightness-95"
            >
              {t('home.backToCurrent')}
            </button>
          </div>
        )}

        <main className="flex-1 px-4 pb-32">
          <Summary leftAgorot={left} spentAgorot={spent} budgetAgorot={household.budgetAgorot} daysLeft={days} past={past} />
          <section aria-labelledby="list-title" className="mt-8">
            <h2 id="list-title" className="sr-only">
              {t('home.listTitle')}
            </h2>
            {expenses.length === 0 ? (
              <EmptyState past={past} />
            ) : (
              <ExpenseList expenses={expenses} members={members} today={today} highlightIds={highlightIds} />
            )}
          </section>
        </main>

        {/* New expenses belong to the current cycle, so no "+" while looking at an earlier one. */}
        {!past && (
          <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[480px]">
            <button
              type="button"
              onClick={startAdd}
              aria-label={t('home.add')}
              className="pointer-events-auto absolute end-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] grid size-16 touch-manipulation place-items-center rounded-full bg-primary text-on-primary shadow-lg shadow-primary/30 transition-transform duration-150 ease-out active:scale-95"
            >
              <Plus size={32} strokeWidth={2.5} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
      <Outlet />
    </>
  )
}

function Summary({
  leftAgorot,
  spentAgorot,
  budgetAgorot,
  daysLeft,
  past,
}: {
  leftAgorot: number
  spentAgorot: number
  budgetAgorot: number
  daysLeft: number
  /** An earlier cycle: what was left at its end, and no days left. */
  past: boolean
}) {
  const shown = useAnimatedNumber(leftForDisplay(leftAgorot), TIMING.numberAnimMs)
  const isOver = leftAgorot < 0
  // Follows the animated value, so the text flips when the count crosses zero.
  const over = shown < 0
  const { before, after } = around(over ? 'home.over' : past ? 'home.leftPast' : 'home.left', 'amount')

  return (
    <section aria-labelledby="summary-title" className="pt-6 text-center">
      <h2 id="summary-title" className="flex flex-col items-center">
        {before && <span className={cls('text-lg', over ? 'font-medium text-over' : 'text-muted')}>{before}</span>}
        <span className={cls('text-[56px] leading-[1.15] font-bold', over ? 'text-over' : 'text-text')}>
          <Money agorot={Math.abs(shown) * 100} />
        </span>
        {after && <span className={cls('text-lg', over ? 'font-medium text-over' : 'text-muted')}>{after}</span>}
      </h2>
      <p className="mt-3 text-muted">
        {past
          ? t('home.cycleEnded')
          : daysLeft <= 1
          ? t('home.lastDay')
          : isOver
            ? t('home.daysLeftOnly', { n: daysLeft })
            : tx('home.daysLeft', { n: daysLeft, amount: <Money agorot={perDayAgorot(leftAgorot, daysLeft)} /> })}
      </p>
      <div className="mt-6">
        <ProgressBar spentAgorot={spentAgorot} budgetAgorot={budgetAgorot} />
      </div>
      <p className="mt-2 text-sm text-muted">
        {tx('home.spentOf', { spent: <Money agorot={spentAgorot} />, budget: <Money agorot={budgetAgorot} /> })}
      </p>
    </section>
  )
}

function groupByDay(expenses: Expense[]): Array<{ date: IsoDate; items: Expense[] }> {
  const groups: Array<{ date: IsoDate; items: Expense[] }> = []
  for (const e of expenses) {
    const last = groups[groups.length - 1]
    if (last?.date === e.spentOn) last.items.push(e)
    else groups.push({ date: e.spentOn, items: [e] })
  }
  return groups
}

function ExpenseList({
  expenses,
  members,
  today,
  highlightIds,
}: {
  expenses: Expense[]
  members: Member[]
  today: IsoDate
  highlightIds: ReadonlySet<string>
}) {
  return (
    <div className="space-y-5">
      {groupByDay(expenses).map((group) => (
        <section key={group.date} aria-labelledby={`day-${group.date}`}>
          <h3 id={`day-${group.date}`} className="mb-2 px-1 text-sm font-medium text-muted">
            {dayLabel(group.date, today)}
          </h3>
          <ul className="divide-y divide-border overflow-hidden rounded-2xl bg-surface">
            {group.items.map((e) => (
              <li key={e.id}>
                <Link
                  to={`/expense/${e.id}`}
                  state={{ fromApp: true }}
                  onClick={(event) => {
                    // The second tap of a double tap on a category lands here right after a save.
                    if (justSaved()) event.preventDefault()
                  }}
                  className={cls(
                    // Inset focus ring: the list's overflow-hidden would clip an outer one.
                    'flex min-h-16 items-center gap-3 px-4 py-3 active:bg-bg focus-visible:-outline-offset-3',
                    highlightIds.has(e.id) && 'animate-highlight',
                  )}
                >
                  <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-bg text-xl">
                    {CATEGORY_EMOJI[e.category]}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-start">{categoryName(e.category)}</span>
                  <MemberChip member={members.find((m) => m.id === e.memberId)} />
                  {/* Fixed-width amount slot keeps the member chips in one column across rows. */}
                  <span className="min-w-[6.5rem] shrink-0 text-end">
                    {e.pending && (
                      // Saved offline, waiting to be sent.
                      <span className="me-1 inline-flex align-middle text-muted">
                        <Clock size={14} aria-hidden="true" />
                        <span className="sr-only">{t('home.pending')}</span>
                      </span>
                    )}
                    <Money agorot={e.amountAgorot} className="font-medium" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function EmptyState({ past }: { past: boolean }) {
  return (
    <div className="rounded-2xl bg-surface px-6 py-10 text-center">
      <span aria-hidden="true" className="mx-auto grid size-14 place-items-center rounded-full bg-primary-soft text-primary">
        <Wallet size={28} />
      </span>
      <p className="mt-4 text-muted">{t(past ? 'home.emptyPast' : 'home.empty')}</p>
    </div>
  )
}

export function HomeSkeleton() {
  return (
    <div className="flex flex-1 flex-col px-4 pt-4" aria-busy="true">
      <span className="sr-only" role="status">
        {t('common.loading')}
      </span>
      <Skeleton className="h-4 w-36" />
      <div className="mt-10 flex flex-col items-center gap-3">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-14 w-52" />
        <Skeleton className="h-5 w-24" />
        <Skeleton className="mt-3 h-4 w-48" />
      </div>
      <Skeleton className="mt-8 h-2.5 w-full rounded-full" />
      <div className="mt-10 space-y-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  )
}
