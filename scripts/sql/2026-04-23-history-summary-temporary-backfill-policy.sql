-- SECURITY NOTICE
-- Anonymous backfill policies are intentionally no longer supported.
-- Run backfills with SUPABASE_SERVICE_ROLE_KEY instead.

begin;

drop policy if exists "temporary anon insert driver history summary" on public.driver_history_summary;
drop policy if exists "temporary anon update driver history summary" on public.driver_history_summary;
drop policy if exists "temporary anon insert constructor history summary" on public.constructor_history_summary;
drop policy if exists "temporary anon update constructor history summary" on public.constructor_history_summary;

revoke insert, update, delete, truncate on public.driver_history_summary from anon, authenticated;
revoke insert, update, delete, truncate on public.constructor_history_summary from anon, authenticated;

grant select on public.driver_history_summary to anon, authenticated;
grant select on public.constructor_history_summary to anon, authenticated;

commit;
