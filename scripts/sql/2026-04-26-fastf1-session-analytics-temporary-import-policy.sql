-- Optional: use only when importing locally without SUPABASE_SERVICE_ROLE_KEY.
-- Run this after 2026-04-26-fastf1-session-analytics.sql, import the data,
-- then run the cleanup statements at the bottom.

drop policy if exists "fastf1 session analytics temporary insert" on public.fastf1_session_analytics;
create policy "fastf1 session analytics temporary insert"
  on public.fastf1_session_analytics
  for insert
  with check (true);

drop policy if exists "fastf1 session analytics temporary update" on public.fastf1_session_analytics;
create policy "fastf1 session analytics temporary update"
  on public.fastf1_session_analytics
  for update
  using (true)
  with check (true);

-- Cleanup after import:
-- drop policy if exists "fastf1 session analytics temporary insert" on public.fastf1_session_analytics;
-- drop policy if exists "fastf1 session analytics temporary update" on public.fastf1_session_analytics;
