-- SECURITY NOTICE
-- Anonymous import policies are intentionally no longer supported.
-- Run import scripts with SUPABASE_SERVICE_ROLE_KEY instead.

begin;

drop policy if exists "fastf1 session analytics temporary insert" on public.fastf1_session_analytics;
drop policy if exists "fastf1 session analytics temporary update" on public.fastf1_session_analytics;

revoke insert, update, delete, truncate on public.fastf1_session_analytics from anon;
revoke insert, update, delete, truncate on public.fastf1_session_analytics from authenticated;

grant select on public.fastf1_session_analytics to anon, authenticated;

commit;
