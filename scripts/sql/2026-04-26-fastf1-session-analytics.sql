-- Store FastF1 session analytics exported by scripts/export-fastf1-race-data.py.
-- Supports race, qualifying, sprint qualifying, and sprint shootout payloads.

create table if not exists public.fastf1_session_analytics (
  id bigint generated always as identity primary key,
  season integer not null,
  round integer not null,
  session text not null,
  event_name text,
  session_name text,
  generated_at timestamptz,
  imported_at timestamptz not null default timezone('utc', now()),
  payload jsonb not null,
  constraint fastf1_session_analytics_session_check
    check (session in ('R', 'Q', 'SQ', 'SS', 'S')),
  constraint fastf1_session_analytics_unique_session
    unique (season, round, session)
);

create index if not exists fastf1_session_analytics_lookup_idx
  on public.fastf1_session_analytics (season, round, session);

create index if not exists fastf1_session_analytics_imported_at_idx
  on public.fastf1_session_analytics (imported_at desc);

alter table public.fastf1_session_analytics enable row level security;

drop policy if exists "fastf1 session analytics public read" on public.fastf1_session_analytics;
create policy "fastf1 session analytics public read"
  on public.fastf1_session_analytics
  for select
  using (true);
