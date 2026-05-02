-- Store precomputed Jolpica/FastF1 race-weekend session result payloads.
-- This is the fast path for RaceDetail practice, sprint qualifying, and sprint tabs.

create table if not exists public.race_session_results (
  id bigint generated always as identity primary key,
  season integer not null,
  round integer not null,
  session text not null,
  source text not null default 'jolpica',
  race_name text,
  circuit_id text,
  fetched_at timestamptz not null default timezone('utc', now()),
  payload jsonb not null,
  constraint race_session_results_session_check
    check (session in ('FP1', 'FP2', 'FP3', 'SQ', 'SS', 'S')),
  constraint race_session_results_source_check
    check (source in ('jolpica', 'fastf1')),
  constraint race_session_results_unique_session
    unique (season, round, session, source)
);

create index if not exists race_session_results_lookup_idx
  on public.race_session_results (season, round, session);

create index if not exists race_session_results_source_lookup_idx
  on public.race_session_results (season, round, session, source);

create index if not exists race_session_results_fetched_at_idx
  on public.race_session_results (fetched_at desc);

alter table public.race_session_results enable row level security;

drop policy if exists "race session results public read" on public.race_session_results;
create policy "race session results public read"
  on public.race_session_results
  for select
  using (true);
