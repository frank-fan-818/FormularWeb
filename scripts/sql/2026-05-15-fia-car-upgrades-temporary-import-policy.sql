-- SECURITY NOTICE
-- Anonymous import policies are intentionally no longer supported.
-- Run import scripts with SUPABASE_SERVICE_ROLE_KEY instead. The service role
-- bypasses RLS and does not require a public write policy.

begin;

drop policy if exists "fia car upgrades temporary insert" on public.fia_car_upgrades;
drop policy if exists "fia car upgrades temporary update" on public.fia_car_upgrades;
drop policy if exists "fia car upgrades temporary delete" on public.fia_car_upgrades;

revoke insert, update, delete, truncate on public.fia_car_upgrades from anon;
revoke insert, update, delete, truncate on public.fia_car_upgrades from authenticated;

commit;
