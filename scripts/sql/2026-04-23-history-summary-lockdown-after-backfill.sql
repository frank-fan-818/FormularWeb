-- Remove temporary anon write permissions after history summary backfill.
-- Run this after:
-- npm.cmd run audit:derived-data -- --apply

drop policy if exists "temporary anon insert driver history summary" on public.driver_history_summary;
drop policy if exists "temporary anon update driver history summary" on public.driver_history_summary;
drop policy if exists "temporary anon insert constructor history summary" on public.constructor_history_summary;
drop policy if exists "temporary anon update constructor history summary" on public.constructor_history_summary;

revoke insert, update on public.driver_history_summary from anon;
revoke insert, update on public.constructor_history_summary from anon;

grant select on public.driver_history_summary to anon;
grant select on public.constructor_history_summary to anon;

drop policy if exists "public anon read driver history summary" on public.driver_history_summary;
drop policy if exists "public anon read constructor history summary" on public.constructor_history_summary;

create policy "public anon read driver history summary"
  on public.driver_history_summary
  for select
  to anon
  using (true);

create policy "public anon read constructor history summary"
  on public.constructor_history_summary
  for select
  to anon
  using (true);
