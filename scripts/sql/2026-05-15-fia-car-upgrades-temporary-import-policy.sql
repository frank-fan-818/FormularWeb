-- Temporary policy for importing FIA upgrade records without a service role key.
-- Prefer SUPABASE_SERVICE_ROLE_KEY for scripts; drop this policy after import if used.

drop policy if exists "fia car upgrades temporary insert" on public.fia_car_upgrades;
create policy "fia car upgrades temporary insert"
  on public.fia_car_upgrades
  for insert
  with check (true);

drop policy if exists "fia car upgrades temporary update" on public.fia_car_upgrades;
create policy "fia car upgrades temporary update"
  on public.fia_car_upgrades
  for update
  using (true)
  with check (true);

drop policy if exists "fia car upgrades temporary delete" on public.fia_car_upgrades;
create policy "fia car upgrades temporary delete"
  on public.fia_car_upgrades
  for delete
  using (true);
