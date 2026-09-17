begin;

-- Remove permissive historical policies; a second public SELECT policy would
-- otherwise OR with a member-only policy and reopen anonymous access.
do $$
declare item record;
begin
  for item in select tablename, policyname from pg_policies
    where schemaname = 'public' and tablename in
      ('fastf1_session_analytics', 'prediction_runs', 'prediction_candidates')
  loop
    execute format('drop policy %I on public.%I', item.policyname, item.tablename);
  end loop;
end $$;

alter table public.fastf1_session_analytics enable row level security;
alter table public.prediction_runs enable row level security;
alter table public.prediction_candidates enable row level security;

create policy "Members read analytics" on public.fastf1_session_analytics for select to authenticated
using (auth.uid() is not null and coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false);
create policy "Members read predictions" on public.prediction_runs for select to authenticated
using (auth.uid() is not null and coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false);
create policy "Members read candidates" on public.prediction_candidates for select to authenticated
using (auth.uid() is not null and coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false);

revoke all on public.fastf1_session_analytics, public.prediction_runs, public.prediction_candidates
  from public, anon, authenticated;
grant select on public.fastf1_session_analytics, public.prediction_runs, public.prediction_candidates to authenticated;
grant all on public.fastf1_session_analytics, public.prediction_runs, public.prediction_candidates to service_role;
alter view public.race_prediction_current set (security_invoker = true);
revoke all on public.race_prediction_current from public, anon, authenticated;
grant select on public.race_prediction_current to authenticated, service_role;

notify pgrst, 'reload schema';
commit;
