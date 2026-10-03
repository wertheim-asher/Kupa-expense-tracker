-- Kupa 0003: one code to come back.
-- Run once in the Supabase SQL editor, after 0002_harder_codes.sql (see SETUP.md).
--  - The personal code alone takes a member's seat back on a new device. At 12 characters (about
--    59 bits) it cannot be guessed and is unique, so it finds its household by itself. The invite
--    code is only for the partner's first join.
--  - The old way (invite code + personal code) still works, so the app in use keeps working until
--    the new version is live.

-- No two members may share a personal code, now that one finds its seat on its own. Two random
-- 12-character codes match about once in 10^17 tries; any pair that does gets new codes first.
update public.member_secrets
set personal_code = public.new_personal_code()
where personal_code in (
  select personal_code from public.member_secrets group by personal_code having count(*) > 1
);
create unique index if not exists member_secrets_personal_code_key on public.member_secrets (personal_code);

-- Join by invite code (case-insensitive, spaces ignored). A household holds at most 2 members.
-- With a personal code, the caller takes back the seat that code belongs to (same member, same
-- history) instead of joining as someone new, with or without the invite code. The personal code
-- then changes, and if the second seat is still free the invite code changes too.
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

  if v_code = '' and v_personal <> '' then
    -- The personal code alone: it leads to its household, which is locked like below. The code is
    -- checked again under the lock, so two devices using the same code at once cannot both get in.
    select m.household_id into v_hid
    from public.member_secrets s
    join public.members m on m.id = s.member_id
    where s.personal_code = v_personal;
    select id into v_hid from public.households where id = v_hid for update;
    if v_hid is null then
      raise exception 'personal_code_invalid' using errcode = 'P0001';
    end if;
  else
    -- Lock the household row so two people joining at once cannot both take the second seat.
    select id into v_hid from public.households where invite_code = v_code for update;
    if v_hid is null then
      raise exception 'code_not_found' using errcode = 'P0001';
    end if;
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
