-- Kupa pilot: the numbers for the presentation, in one table.
-- Run it in the Supabase dashboard: SQL Editor > New query > paste all of this > Run.
-- Before running, set the two values in `params` below.
-- It reads only usage: counts and times. No amounts and no names leave this query.

with params as (
  select
    date '2026-10-03' as pilot_start,      -- the day the pilot invites went out
    array['TRRYBE']::text[] as also_include -- invite codes of budgets created earlier that count too (yours)
),
-- Budgets in the pilot: created since the start, or listed above. Test data ("rls-test-…") is left out.
ph as (
  select h.*
  from public.households h, params p
  where (h.created_at >= p.pilot_start or h.invite_code = any (p.also_include))
    and not exists (
      select 1 from public.members m where m.household_id = h.id and m.display_name like 'rls-test-%'
    )
),
pm as (
  select m.*, greatest(m.created_at::date, p.pilot_start) as since
  from public.members m join ph on ph.id = m.household_id, params p
),
-- Expenses logged during the pilot (by the moment they were logged, Israel time).
pe as (
  select e.*, (e.created_at at time zone 'Asia/Jerusalem')::date as logged_on
  from public.expenses e join ph on ph.id = e.household_id, params p
  where e.created_at >= p.pilot_start
),
-- Usage events during the pilot. Events saved offline carry the real time in props.queued_at.
ev as (
  select e.name, e.member_id, e.props,
         coalesce((e.props ->> 'queued_at')::timestamptz, e.created_at) as at
  from public.events e join ph on ph.id = e.household_id, params p
  where coalesce((e.props ->> 'queued_at')::timestamptz, e.created_at) >= p.pilot_start
),
member_days as (
  select greatest(1, sum(greatest(1, (now() at time zone 'Asia/Jerusalem')::date - pm.since + 1))) as n from pm
),
timed as (select log_duration_ms from pe where log_duration_ms is not null),
active_days as (
  select member_id, count(distinct logged_on) as days from pe group by member_id
)
select * from (
  select 1 as n, 'Setup' as part, 'Budgets in the pilot' as metric, (select count(*) from ph)::text as value
  union all select 2, 'Setup', 'Budgets where the partner joined',
    (select count(*) from ph where (select count(*) from pm where pm.household_id = ph.id) = 2)::text
  union all select 3, 'Setup', 'People (members)', (select count(*) from pm)::text
  union all select 4, 'Setup', 'People who logged at least one expense', (select count(distinct member_id) from pe)::text

  -- Assumption 1: people log every expense if it takes about 5 seconds.
  union all select 10, 'A1 speed', 'Expenses logged', (select count(*) from pe)::text
  union all select 11, 'A1 speed', 'Median time to log one expense (seconds)',
    (select round((percentile_cont(0.5) within group (order by log_duration_ms) / 1000)::numeric, 1) from timed)::text
  union all select 12, 'A1 speed', '75% of expenses were logged within (seconds)',
    (select round((percentile_cont(0.75) within group (order by log_duration_ms) / 1000)::numeric, 1) from timed)::text
  union all select 13, 'A1 speed', 'Share logged in 5 seconds or less (%)',
    (select round(100.0 * count(*) filter (where log_duration_ms <= 5000) / nullif(count(*), 0), 0) from timed)::text
  union all select 14, 'A1 speed', 'Add screens opened ("+")', (select count(*) from ev where name = 'add_start')::text
  union all select 15, 'A1 speed', 'Closed without saving (%)',
    (select round(100.0 * count(*) filter (where name = 'add_cancel') / nullif(count(*) filter (where name = 'add_start'), 0), 0) from ev)::text
  union all select 16, 'A1 speed', 'Undo right after saving', (select count(*) from ev where name = 'undo')::text

  -- Assumption 2: seeing "left this cycle" is reason enough to keep logging.
  union all select 20, 'A2 habit', 'Expenses per person per day',
    (select round(count(*)::numeric / (select n from member_days), 1) from pe)::text
  union all select 21, 'A2 habit', 'Days with at least one expense, per person (average)',
    (select round(avg(days), 1) from active_days)::text
  union all select 22, 'A2 habit', 'People who logged in the last 3 days',
    (select count(distinct member_id) from pe where created_at >= now() - interval '3 days')::text
  union all select 23, 'A2 habit', 'App opens per person per day',
    (select round(count(*)::numeric / (select n from member_days), 1) from ev where name = 'app_open')::text
  union all select 24, 'A2 habit', 'Opens from the home screen icon (%)',
    (select round(100.0 * count(*) filter (where props ->> 'standalone' = 'true') / nullif(count(*), 0), 0) from ev where name = 'app_open')::text

  -- Assumption 3: a billing-cycle budget matters more than a calendar month.
  union all select 30, 'A3 cycle', 'Budgets whose cycle starts on a day other than the 1st',
    (select count(*) filter (where cycle_start_day <> 1) || ' of ' || count(*) from ph)
  union all select 31, 'A3 cycle', 'Cycle start days chosen (day: budgets)',
    (select string_agg(cycle_start_day || ': ' || c, ', ' order by cycle_start_day)
       from (select cycle_start_day, count(*) as c from ph group by cycle_start_day) d)
) results
order by n;
