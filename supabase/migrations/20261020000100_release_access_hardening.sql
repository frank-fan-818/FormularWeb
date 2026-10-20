-- Align database access with the existing member-only Web features.
-- Idempotent; changes grants and policies only, never application rows.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $$
declare
  member_table_name text;
  policy record;
  column_grant record;
begin
  foreach member_table_name in array array[
    'fastf1_session_analytics', 'prediction_runs', 'prediction_candidates'
  ] loop
    execute format('alter table public.%I enable row level security', member_table_name);
    execute format('revoke all on table public.%I from public, anon, authenticated', member_table_name);
    for column_grant in
      select distinct column_name from information_schema.column_privileges
      where table_schema = 'public' and information_schema.column_privileges.table_name = member_table_name
        and grantee in ('PUBLIC', 'anon', 'authenticated')
    loop
      execute format('revoke all (%I) on public.%I from public, anon, authenticated', column_grant.column_name, member_table_name);
    end loop;
    for policy in select policyname from pg_policies
      where schemaname = 'public' and tablename = member_table_name
    loop
      execute format('drop policy %I on public.%I', policy.policyname, member_table_name);
    end loop;
    execute format('grant select on public.%I to authenticated', member_table_name);
    execute format('grant select, insert, update, delete on public.%I to service_role', member_table_name);
    execute format($policy$
      create policy "member read" on public.%I for select to authenticated
      using ((select auth.uid()) is not null
        and coalesce((select auth.jwt()) ->> 'is_anonymous', 'false') = 'false')
    $policy$, member_table_name);
  end loop;
end;
$$;

alter view public.race_prediction_current set (security_invoker = true);
revoke all on public.race_prediction_current from public, anon, authenticated;
do $$
declare
  column_grant record;
begin
  for column_grant in select distinct column_name from information_schema.column_privileges
    where table_schema = 'public' and table_name = 'race_prediction_current'
      and grantee in ('PUBLIC', 'anon', 'authenticated')
  loop
    execute format('revoke all (%I) on public.race_prediction_current from public, anon, authenticated', column_grant.column_name);
  end loop;
end;
$$;
grant select on public.race_prediction_current to authenticated, service_role;
revoke all on public.prediction_models from public, anon, authenticated;

-- Diagnostic inserts stay bound to the existing auth.uid() policy. Browsers
-- have no need to read diagnostics, even their own, or mutate existing rows.
revoke all on public.error_logs from public, anon, authenticated;
do $$
declare
  column_grant record;
  insert_columns text;
begin
  for column_grant in select distinct column_name from information_schema.column_privileges
    where table_schema = 'public' and table_name = 'error_logs'
      and grantee in ('PUBLIC', 'anon', 'authenticated')
  loop
    execute format('revoke all (%I) on public.error_logs from public, anon, authenticated', column_grant.column_name);
  end loop;
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into insert_columns
    from information_schema.columns where table_schema = 'public' and table_name = 'error_logs'
      and column_name = any(array[
        'module','function','error','level','user_agent','url',
        'flow_id','feature','season','round','section','session',
        'operation','outcome','source','reason_code','duration_ms'
      ]);
  execute format('grant insert (%s) on public.error_logs to authenticated', insert_columns);
end;
$$;
notify pgrst, 'reload schema';
commit;
