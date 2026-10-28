-- Tiny function the daily keep-alive job calls, so Supabase sees a real, successful database query.
-- Reads no user data. Returns the row count of a system table and the time.
create or replace function public.keepalive()
returns timestamptz
language sql
stable
security invoker
set search_path = ''
as $$
  select now() where (select count(*) from pg_catalog.pg_class) > 0;
$$;

revoke all on function public.keepalive() from public;
grant execute on function public.keepalive() to anon, authenticated;
