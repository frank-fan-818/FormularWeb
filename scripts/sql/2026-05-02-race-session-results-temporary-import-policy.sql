-- Temporary import policy for browser-anon/service-script backfills.
-- Prefer SUPABASE_SERVICE_ROLE_KEY for imports when possible, then remove these policies.

grant select, insert, update on public.race_session_results to anon;

drop policy if exists "race session results temporary insert" on public.race_session_results;
create policy "race session results temporary insert"
  on public.race_session_results
  for insert
  with check (true);

drop policy if exists "race session results temporary update" on public.race_session_results;
create policy "race session results temporary update"
  on public.race_session_results
  for update
  using (true)
  with check (true);

-- After import, lock this back down:
-- drop policy if exists "race session results temporary insert" on public.race_session_results;
-- drop policy if exists "race session results temporary update" on public.race_session_results;
-- revoke insert, update on public.race_session_results from anon;
