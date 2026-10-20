-- Read-only production acceptance. Run with: supabase db query --linked --file ...
begin isolation level repeatable read read only;
do $$
declare
  relation record;
  browser_role text;
  operation text;
  member_tables constant text[] := array[
    'fastf1_session_analytics', 'prediction_runs', 'prediction_candidates'
  ];
begin
  foreach browser_role in array array['anon', 'authenticated'] loop
    for relation in
      select c.oid, c.relname, c.relkind, c.relrowsecurity
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm')
    loop
      foreach operation in array array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'] loop
        if has_table_privilege(browser_role, relation.oid, operation) then
          raise exception 'Browser role % has % on public.%', browser_role, operation, relation.relname;
        end if;
      end loop;
      if relation.relkind in ('r', 'p') and not relation.relrowsecurity then
        raise exception 'RLS disabled on public.%', relation.relname;
      end if;
    end loop;
  end loop;

  foreach browser_role in array array['anon', 'authenticated'] loop
    if exists (select 1 from information_schema.column_privileges
      where table_schema = 'public' and grantee = browser_role
      and privilege_type in ('INSERT', 'UPDATE') and table_name <> 'error_logs') then
      raise exception 'Browser role % has a business-data column write grant', browser_role;
    end if;
  end loop;

  for relation in select unnest(member_tables) as name loop
    if has_table_privilege('anon', 'public.' || relation.name, 'SELECT') then
      raise exception 'Anonymous read allowed on member table public.%', relation.name;
    end if;
    if not has_table_privilege('authenticated', 'public.' || relation.name, 'SELECT') then
      raise exception 'Member read missing on public.%', relation.name;
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public'
      and tablename = relation.name and cmd = 'SELECT' and roles = array['authenticated']::name[]
      and qual like '%is_anonymous%' and qual like '%uid()%') then
      raise exception 'Non-anonymous member policy missing on public.%', relation.name;
    end if;
    if exists (select 1 from pg_policies where schemaname = 'public'
      and tablename = relation.name and ('anon'::name = any(roles) or 'public'::name = any(roles))) then
      raise exception 'Public policy remains on public.%', relation.name;
    end if;
    foreach operation in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE'] loop
      if not has_table_privilege('service_role', 'public.' || relation.name, operation) then
        raise exception 'Service worker % missing on public.%', operation, relation.name;
      end if;
    end loop;
  end loop;

  if has_table_privilege('anon', 'public.race_prediction_current', 'SELECT') then
    raise exception 'Anonymous read allowed on prediction view';
  end if;
  if not exists (select 1 from pg_class where oid = 'public.race_prediction_current'::regclass
    and reloptions @> array['security_invoker=true']) then
    raise exception 'Prediction view must execute with caller permissions';
  end if;
  if has_table_privilege('anon', 'public.error_logs', 'SELECT')
    or has_table_privilege('authenticated', 'public.error_logs', 'SELECT') then
    raise exception 'Browser diagnostic reads must be disabled';
  end if;
  if exists (select 1 from information_schema.column_privileges where table_schema = 'public'
    and table_name = 'error_logs' and grantee in ('anon','authenticated') and privilege_type = 'SELECT') then
    raise exception 'Browser diagnostic column reads must be disabled';
  end if;
  if not exists (select 1 from storage.buckets where id = 'fastf1-private' and not public) then
    raise exception 'FastF1 bucket is missing or public';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
    and policyname = 'FastF1 read boundary' and permissive = 'RESTRICTIVE'
    and qual like '%is_anonymous%') then
    raise exception 'Private Storage member boundary is missing';
  end if;
end;
$$;

-- A Supabase anonymous sign-in also has the authenticated database role.
-- Verify the JWT claim still prevents it from seeing member-only rows.
select set_config('release.expected_member_counts', jsonb_build_object(
  'predictions', (select count(*) from public.race_prediction_current),
  'analytics', (select count(*) from public.fastf1_session_analytics)
)::text, true);
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000001","is_anonymous":true}';
do $$
begin
  if exists (select 1 from public.fastf1_session_analytics)
    or exists (select 1 from public.prediction_runs)
    or exists (select 1 from public.prediction_candidates)
    or exists (select 1 from public.race_prediction_current)
    or exists (select 1 from storage.objects where bucket_id = 'fastf1-private') then
    raise exception 'An anonymous auth session can read member data';
  end if;
end;
$$;
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000001","is_anonymous":false}';
-- Member reads must see the same rows as the administrative snapshot, rather
-- than merely succeed with an empty result because an RLS policy denies all.
do $$
declare
  expected jsonb := current_setting('release.expected_member_counts')::jsonb;
begin
  if (select count(*) from public.race_prediction_current) <> (expected ->> 'predictions')::bigint
    or (select count(*) from public.fastf1_session_analytics) <> (expected ->> 'analytics')::bigint then
    raise exception 'Member read does not expose the expected published rows';
  end if;
end;
$$;
reset role;
select 'pass' as release_access;
rollback;
