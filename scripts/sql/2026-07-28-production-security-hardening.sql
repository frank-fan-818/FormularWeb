-- Production security hardening for every application-owned table.
-- Safe to re-run. Apply this after all earlier schema files and before release.

begin;

do $$
declare
  table_name text;
  public_read_tables constant text[] := array[
    'circuits',
    'constructors',
    'constructor_history_summary',
    'drivers',
    'driver_history_summary',
    'fastf1_session_analytics',
    'fia_car_upgrades',
    'qualifying_results',
    'races',
    'race_results',
    'race_session_results',
    'seasons',
    'season_constructor_standings',
    'season_driver_standings'
  ];
begin
  foreach table_name in array public_read_tables loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('alter table public.%I enable row level security', table_name);
      execute format(
        'revoke insert, update, delete, truncate on public.%I from anon, authenticated',
        table_name
      );
      execute format('grant select on public.%I to anon, authenticated', table_name);
      execute format('drop policy if exists "public read" on public.%I', table_name);
      execute format(
        'create policy "public read" on public.%I for select to anon, authenticated using (true)',
        table_name
      );
    end if;
  end loop;
end
$$;

-- Views must execute with the caller's permissions so they cannot bypass RLS
-- on their underlying tables.
alter view if exists public.fia_car_upgrade_summaries
  set (security_invoker = true);
revoke all on table public.fia_car_upgrade_summaries from public, anon, authenticated;
grant select on table public.fia_car_upgrade_summaries to anon, authenticated;

-- Operational tables are private by default.
alter table if exists public.error_logs enable row level security;
alter table if exists public.tasks enable row level security;

alter table if exists public.error_logs
  add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table if exists public.error_logs
  alter column user_id set default auth.uid();
create index if not exists idx_error_logs_user_timestamp
  on public.error_logs (user_id, timestamp desc);

revoke all on table public.error_logs from anon;
revoke all on table public.tasks from anon;

revoke insert, update, delete, truncate on public.error_logs from authenticated;
revoke insert, update, delete, truncate on public.tasks from authenticated;

drop policy if exists "authenticated error insert" on public.error_logs;
create policy "authenticated error insert"
  on public.error_logs
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

-- No browser policy is created for tasks. Pipeline workers must use the
-- service-role key and server-side execution.

commit;
