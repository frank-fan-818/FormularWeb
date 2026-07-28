-- SECURITY NOTICE
-- Anonymous import policies are intentionally no longer supported.
-- Run import scripts with SUPABASE_SERVICE_ROLE_KEY instead.

begin;

drop policy if exists "race session results temporary insert" on public.race_session_results;
drop policy if exists "race session results temporary update" on public.race_session_results;

revoke insert, update, delete, truncate on public.race_session_results from anon;
revoke insert, update, delete, truncate on public.race_session_results from authenticated;

grant select on public.race_session_results to anon, authenticated;

commit;
