-- Kupa: initial schema (SPEC section 3).
-- Run once in the Supabase SQL editor (see SETUP.md). Safe to read top to bottom:
-- tables, guards, row level security, the two RPCs, and realtime.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.households (
  id uuid primary key default gen_random_uuid(),
  budget_agorot integer not null check (budget_agorot > 0 and budget_agorot <= 10000000),
  cycle_start_day smallint not null check (cycle_start_day between 1 and 28),
  invite_code text not null unique check (invite_code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{6}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  -- One household per device user.
  user_id uuid not null unique references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 30 and display_name = btrim(display_name)),
  color text not null check (color in ('teal', 'violet')),
  created_at timestamptz not null default now()
);

create table public.expenses (
  -- Generated on the client, so a retried insert is idempotent.
  id uuid primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  member_id uuid not null references public.members (id),
  amount_agorot integer not null check (amount_agorot > 0 and amount_agorot <= 10000000),
  category text not null check (
    category in ('groceries', 'eating_out', 'transport', 'home', 'kids', 'health', 'fun', 'other')
  ),
  spent_on date not null,
  log_duration_ms integer check (log_duration_ms is null or log_duration_ms >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Soft delete only, so realtime sends updates and analytics keep history.
  deleted_at timestamptz
);

create table public.events (
  id bigint generated always as identity primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 64),
  props jsonb not null default '{}'::jsonb check (pg_column_size(props) <= 2048),
  created_at timestamptz not null default now()
);

create index expenses_household_spent_on on public.expenses (household_id, spent_on);
create index events_household_created_at on public.events (household_id, created_at);
create index members_household on public.members (household_id);

-- ---------------------------------------------------------------------------
-- Guards: timestamps, dates in range, columns that never change after insert
-- ---------------------------------------------------------------------------

-- Today in Israel (the app's calendar), never UTC.
create or replace function public.israel_today()
returns date
language sql
stable
set search_path = ''
as $$ select (now() at time zone 'Asia/Jerusalem')::date $$;

create or replace function public.households_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.id := old.id;
  -- The invite code changes only inside join_household (a rejoin while the second seat is free).
  if current_setting('kupa.rejoin', true) is distinct from 'on' then
    new.invite_code := old.invite_code;
  end if;
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end $$;

create trigger households_guard before update on public.households
for each row execute function public.households_guard();

create or replace function public.expenses_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.household_id := old.household_id;
    new.member_id := old.member_id;
    new.log_duration_ms := old.log_duration_ms;
    new.created_at := old.created_at;
    new.updated_at := now();
  else
    new.created_at := now();
    new.updated_at := new.created_at;
    new.deleted_at := null;
  end if;
  -- No future dates, nothing older than 365 days (SPEC 13.5). Only checked when the date is set or changed.
  if tg_op = 'INSERT' or new.spent_on is distinct from old.spent_on then
    if new.spent_on > public.israel_today() or new.spent_on < public.israel_today() - 365 then
      raise exception 'spent_on out of range' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;

create trigger expenses_guard before insert or update on public.expenses
for each row execute function public.expenses_guard();

create or replace function public.members_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.display_name := btrim(new.display_name);
  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.household_id := old.household_id;
    new.color := old.color;
    new.created_at := old.created_at;
    -- user_id may only change inside join_household (a member taking their own seat back with their personal code).
    if current_setting('kupa.rejoin', true) is distinct from 'on' then
      new.user_id := old.user_id;
    end if;
  end if;
  return new;
end $$;

create trigger members_guard before insert or update on public.members
for each row execute function public.members_guard();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.households enable row level security;
alter table public.members enable row level security;
alter table public.expenses enable row level security;
alter table public.events enable row level security;

-- True when the caller is a member of the household.
create or replace function public.is_member(hid uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (select 1 from public.members m where m.household_id = hid and m.user_id = auth.uid())
$$;

-- The caller's member id in a household (null if not a member).
create or replace function public.my_member_id(hid uuid)
returns uuid
language sql
security definer
stable
set search_path = ''
as $$
  select m.id from public.members m where m.household_id = hid and m.user_id = auth.uid()
$$;

-- Nothing for signed-out requests; signed-in (including anonymous) users go through RLS.
revoke all on public.households, public.members, public.expenses, public.events from anon;
revoke all on public.households, public.members, public.expenses, public.events from authenticated;
grant select on public.households, public.members, public.expenses, public.events to authenticated;
grant update (budget_agorot, cycle_start_day) on public.households to authenticated;
grant update (display_name) on public.members to authenticated;
grant insert (id, household_id, member_id, amount_agorot, category, spent_on, log_duration_ms) on public.expenses to authenticated;
grant update (amount_agorot, category, spent_on, deleted_at) on public.expenses to authenticated;
grant insert (household_id, member_id, name, props) on public.events to authenticated;

-- households: read and update only your own. No direct insert or delete.
create policy households_select on public.households
  for select to authenticated using (public.is_member(id));
create policy households_update on public.households
  for update to authenticated using (public.is_member(id)) with check (public.is_member(id));

-- members: read your household; update only your own row (display_name only, by grant). No direct insert or delete.
create policy members_select on public.members
  for select to authenticated using (public.is_member(household_id));
create policy members_update_own on public.members
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- expenses: read, insert, update within your household; insert only as yourself. No hard delete.
create policy expenses_select on public.expenses
  for select to authenticated using (public.is_member(household_id));
create policy expenses_insert on public.expenses
  for insert to authenticated
  with check (public.is_member(household_id) and member_id = public.my_member_id(household_id));
create policy expenses_update on public.expenses
  for update to authenticated using (public.is_member(household_id)) with check (public.is_member(household_id));

-- events: insert as yourself into your household; read your household (CSV export).
create policy events_insert on public.events
  for insert to authenticated
  with check (public.is_member(household_id) and member_id = public.my_member_id(household_id));
create policy events_select on public.events
  for select to authenticated using (public.is_member(household_id));

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- p_len characters from ABCDEFGHJKMNPQRSTUVWXYZ23456789 (no 0, O, 1, I, L), from a secure random
-- source. Bytes of 248 and above are skipped, so every character is equally likely.
create or replace function public.random_code(p_len int)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  bytes bytea;
  b int;
  code text := '';
begin
  while char_length(code) < p_len loop
    bytes := extensions.gen_random_bytes(16);
    for i in 0..15 loop
      b := get_byte(bytes, i);
      if b < 248 and char_length(code) < p_len then
        code := code || substr(alphabet, (b % 31) + 1, 1);
      end if;
    end loop;
  end loop;
  return code;
end $$;

-- Invite code: 6 characters, easy to read out and type (SPEC section 3).
create or replace function public.new_invite_code()
returns text
language sql
volatile
set search_path = ''
as $$ select public.random_code(6) $$;

-- Personal code: 12 characters (about 59 bits), so it cannot be guessed even with unlimited tries.
create or replace function public.new_personal_code()
returns text
language sql
volatile
set search_path = ''
as $$ select public.random_code(12) $$;

-- Each member's private personal code: with the invite code, it lets that member take their own
-- seat back from a new device (lost session, new phone). Readable only by its owner; changes after use.
create table public.member_secrets (
  member_id uuid primary key references public.members (id) on delete cascade,
  personal_code text not null check (personal_code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{12}$')
);

alter table public.member_secrets enable row level security;
revoke all on public.member_secrets from anon, authenticated;
grant select on public.member_secrets to authenticated;
create policy member_secrets_select_own on public.member_secrets
  for select to authenticated
  using (exists (select 1 from public.members m where m.id = member_id and m.user_id = (select auth.uid())));

create or replace function public.create_household(p_display_name text, p_budget_agorot int, p_cycle_start_day int)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := btrim(coalesce(p_display_name, ''));
  v_code text;
  v_personal text := public.new_personal_code();
  v_hid uuid;
  v_mid uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if char_length(v_name) < 1 or char_length(v_name) > 30
    or p_budget_agorot is null or p_budget_agorot <= 0 or p_budget_agorot > 10000000
    or p_cycle_start_day is null or p_cycle_start_day < 1 or p_cycle_start_day > 28 then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  if exists (select 1 from public.members where user_id = v_uid) then
    raise exception 'already_member' using errcode = 'P0001';
  end if;
  loop
    v_code := public.new_invite_code();
    begin
      insert into public.households (budget_agorot, cycle_start_day, invite_code)
      values (p_budget_agorot, p_cycle_start_day, v_code)
      returning id into v_hid;
      exit;
    exception when unique_violation then
      -- Invite code collision: try another.
    end;
  end loop;
  insert into public.members (household_id, user_id, display_name, color)
  values (v_hid, v_uid, v_name, 'teal')
  returning id into v_mid;
  insert into public.member_secrets (member_id, personal_code) values (v_mid, v_personal);
  return jsonb_build_object('household_id', v_hid, 'member_id', v_mid, 'invite_code', v_code);
end $$;

-- Join by invite code (case-insensitive, spaces ignored). A household holds at most 2 members.
-- With a personal code as well, the caller takes back the seat that code belongs to (same member,
-- same history) instead of joining as someone new; the personal code then changes.
create or replace function public.join_household(p_code text, p_display_name text, p_personal_code text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := btrim(coalesce(p_display_name, ''));
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'));
  v_personal text := upper(regexp_replace(coalesce(p_personal_code, ''), '\s', '', 'g'));
  v_hid uuid;
  v_mid uuid;
  v_count int;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if exists (select 1 from public.members where user_id = v_uid) then
    raise exception 'already_member' using errcode = 'P0001';
  end if;
  -- Lock the household row so two people joining at once cannot both take the second seat.
  select id into v_hid from public.households where invite_code = v_code for update;
  if v_hid is null then
    raise exception 'code_not_found' using errcode = 'P0001';
  end if;

  if v_personal <> '' then
    select m.id into v_mid
    from public.members m
    join public.member_secrets s on s.member_id = m.id
    where m.household_id = v_hid and s.personal_code = v_personal;
    if v_mid is null then
      raise exception 'personal_code_invalid' using errcode = 'P0001';
    end if;
    perform set_config('kupa.rejoin', 'on', true);
    update public.members set user_id = v_uid where id = v_mid;
    -- With the second seat still free, the old device could walk back in with the old invite
    -- code, so the invite code changes too. (With both seats taken, it simply gets household_full.)
    if (select count(*) from public.members where household_id = v_hid) < 2 then
      loop
        begin
          update public.households set invite_code = public.new_invite_code() where id = v_hid;
          exit;
        exception when unique_violation then
          -- Collision with another household's code: try again.
        end;
      end loop;
    end if;
    perform set_config('kupa.rejoin', 'off', true);
    update public.member_secrets set personal_code = public.new_personal_code() where member_id = v_mid;
    return jsonb_build_object('household_id', v_hid, 'member_id', v_mid, 'rejoined', true);
  end if;

  if char_length(v_name) < 1 or char_length(v_name) > 30 then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  select count(*) into v_count from public.members where household_id = v_hid;
  if v_count >= 2 then
    raise exception 'household_full' using errcode = 'P0001';
  end if;
  insert into public.members (household_id, user_id, display_name, color)
  values (v_hid, v_uid, v_name, 'violet')
  returning id into v_mid;
  insert into public.member_secrets (member_id, personal_code) values (v_mid, public.new_personal_code());
  return jsonb_build_object('household_id', v_hid, 'member_id', v_mid, 'rejoined', false);
end $$;

-- Only the two RPCs are callable by clients; helpers stay internal. Grants are explicit, so the
-- script works whether or not the project exposes new functions automatically.
revoke execute on function public.random_code(int) from public, anon, authenticated;
revoke execute on function public.new_invite_code() from public, anon, authenticated;
revoke execute on function public.new_personal_code() from public, anon, authenticated;
revoke execute on function public.israel_today() from public, anon;
grant execute on function public.israel_today() to authenticated;
revoke execute on function public.create_household(text, int, int) from public, anon;
revoke execute on function public.join_household(text, text, text) from public, anon;
grant execute on function public.create_household(text, int, int) to authenticated;
grant execute on function public.join_household(text, text, text) to authenticated;
revoke execute on function public.is_member(uuid) from public, anon;
revoke execute on function public.my_member_id(uuid) from public, anon;
grant execute on function public.is_member(uuid) to authenticated;
grant execute on function public.my_member_id(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: partners see each other's changes live (RLS applies to what each one receives).
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.expenses, public.households, public.members;
