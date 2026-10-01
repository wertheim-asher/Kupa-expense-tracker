-- Kupa 0002: harder personal codes, and a clean cut-off after a rejoin.
-- Run once in the Supabase SQL editor, after 0001_init.sql (see SETUP.md).
--  - Personal codes become 12 characters (about 59 bits) from an unbiased generator, so they
--    cannot be guessed even with unlimited tries. Existing members get a new code.
--  - When someone takes their seat back while the second seat is still free, the invite code
--    changes too, so the old device cannot walk back in through the free seat.

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

revoke execute on function public.random_code(int) from public, anon, authenticated;
revoke execute on function public.new_invite_code() from public, anon, authenticated;
revoke execute on function public.new_personal_code() from public, anon, authenticated;

-- Existing personal codes are 6 characters: give every member a new 12-character one.
alter table public.member_secrets drop constraint if exists member_secrets_personal_code_check;
update public.member_secrets set personal_code = public.new_personal_code();
alter table public.member_secrets add constraint member_secrets_personal_code_check
  check (personal_code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{12}$');

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
-- same history) instead of joining as someone new; the personal code then changes, and if the
-- second seat is still free the invite code changes too.
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
