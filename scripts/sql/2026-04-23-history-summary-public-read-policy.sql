-- Public read policies for pre-aggregated history summary tables.
-- These tables contain public racing statistics and are safe to expose read-only.
-- Run this in Supabase SQL Editor after creating/backfilling the summary tables.

alter table public.driver_history_summary enable row level security;
alter table public.constructor_history_summary enable row level security;

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
