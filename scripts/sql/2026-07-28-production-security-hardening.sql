-- Production security hardening for every application-owned table.
-- Safe to re-run. Apply this after all earlier schema files and before release.

begin;

set local statement_timeout = '30s';

-- Fail closed when the public schema drifts. Every application table must be
-- classified here before this migration is allowed to continue.
do $$
declare
  expected_tables constant text[] := array[
    'circuits',
    'constructor_history_summary',
    'constructors',
    'driver_history_summary',
    'drivers',
    'error_logs',
    'fastf1_session_analytics',
    'fia_car_upgrades',
    'qualifying_results',
    'race_results',
    'race_session_results',
    'races',
    'season_constructor_standings',
    'season_driver_standings',
    'seasons',
    'tasks'
  ];
  actual_tables text[];
  missing_tables text[];
  unexpected_tables text[];
begin
  select coalesce(array_agg(tablename order by tablename), array[]::text[])
    into actual_tables
    from pg_tables
    where schemaname = 'public';

  select coalesce(array_agg(expected_name order by expected_name), array[]::text[])
    into missing_tables
    from unnest(expected_tables) as expected_name
    where not (expected_name = any(actual_tables));

  select coalesce(array_agg(actual_name order by actual_name), array[]::text[])
    into unexpected_tables
    from unnest(actual_tables) as actual_name
    where not (actual_name = any(expected_tables));

  if cardinality(missing_tables) > 0 then
    raise exception 'Security hardening is missing expected public tables: %', missing_tables;
  end if;
  if cardinality(unexpected_tables) > 0 then
    raise exception 'Unclassified public tables must be reviewed before release: %', unexpected_tables;
  end if;
end
$$;

do $$
declare
  current_table_name text;
  stale_policy_name text;
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
  foreach current_table_name in array public_read_tables loop
    if to_regclass(format('public.%I', current_table_name)) is not null then
      execute format(
        'alter table public.%I enable row level security',
        current_table_name
      );
      execute format(
        'revoke all on public.%I from public, anon, authenticated',
        current_table_name
      );
      execute format(
        'grant select on public.%I to anon, authenticated',
        current_table_name
      );

      -- Remove legacy browser-write policies as well as their grants. This
      -- prevents a later grant change from silently making writes public.
      for stale_policy_name in
        select policyname
        from pg_policies
        where schemaname = 'public'
          and tablename = current_table_name
          and cmd <> 'SELECT'
      loop
        execute format(
          'drop policy if exists %I on public.%I',
          stale_policy_name,
          current_table_name
        );
      end loop;

      execute format(
        'drop policy if exists "public read" on public.%I',
        current_table_name
      );
      execute format(
        'create policy "public read" on public.%I for select to anon, authenticated using (true)',
        current_table_name
      );
    end if;
  end loop;
end
$$;

-- Views must execute with the caller's permissions so they cannot bypass RLS
-- on their underlying tables.
do $$
begin
  if to_regclass('public.fia_car_upgrade_summaries') is not null then
    alter view public.fia_car_upgrade_summaries set (security_invoker = true);
    revoke all on table public.fia_car_upgrade_summaries
      from public, anon, authenticated;
    grant select on table public.fia_car_upgrade_summaries
      to anon, authenticated;
  end if;
end
$$;

-- Operational tables are private by default.
do $$
begin
  if to_regclass('public.error_logs') is not null then
    alter table public.error_logs enable row level security;
    alter table public.error_logs
      add column if not exists user_id uuid
      references auth.users(id) on delete set null;
    alter table public.error_logs
      alter column user_id set default auth.uid();
    create index if not exists idx_error_logs_user_timestamp
      on public.error_logs (user_id, timestamp desc);

    revoke all on table public.error_logs from public, anon, authenticated;
    grant insert (module, function, error, level, user_agent, url)
      on table public.error_logs to authenticated;

    drop policy if exists "authenticated error insert" on public.error_logs;
    create policy "authenticated error insert"
      on public.error_logs
      for insert
      to authenticated
      with check (user_id = (select auth.uid()));
  end if;

  if to_regclass('public.tasks') is not null then
    alter table public.tasks enable row level security;
    revoke all on table public.tasks from public, anon, authenticated;
  end if;
end
$$;

-- No browser policy is created for tasks. Pipeline workers must use the
-- service-role key and server-side execution.

commit;
