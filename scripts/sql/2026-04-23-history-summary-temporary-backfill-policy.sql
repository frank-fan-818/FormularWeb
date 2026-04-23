-- Temporary write policies for history summary backfill with the anon key.
-- Use only when SUPABASE_SERVICE_ROLE_KEY is not available locally.
-- Run this before:
-- npm.cmd run audit:derived-data -- --apply
--
-- Important:
-- These policies allow the public anon role to insert/update summary rows.
-- Run 2026-04-23-history-summary-lockdown-after-backfill.sql immediately after
-- the backfill succeeds.

alter table public.driver_history_summary enable row level security;
alter table public.constructor_history_summary enable row level security;

grant select, insert, update on public.driver_history_summary to anon;
grant select, insert, update on public.constructor_history_summary to anon;

drop policy if exists "temporary anon insert driver history summary" on public.driver_history_summary;
drop policy if exists "temporary anon update driver history summary" on public.driver_history_summary;
drop policy if exists "temporary anon insert constructor history summary" on public.constructor_history_summary;
drop policy if exists "temporary anon update constructor history summary" on public.constructor_history_summary;

create policy "temporary anon insert driver history summary"
  on public.driver_history_summary
  for insert
  to anon
  with check (true);

create policy "temporary anon update driver history summary"
  on public.driver_history_summary
  for update
  to anon
  using (true)
  with check (true);

create policy "temporary anon insert constructor history summary"
  on public.constructor_history_summary
  for insert
  to anon
  with check (true);

create policy "temporary anon update constructor history summary"
  on public.constructor_history_summary
  for update
  to anon
  using (true)
  with check (true);
