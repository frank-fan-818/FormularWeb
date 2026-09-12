-- Atomic, idempotent per-race FIA publications. Apply once before enabling the workflow.
-- Rollback: drop table public.fia_race_upgrade_snapshots;
-- Legacy fia_car_upgrades records are deliberately preserved.
begin;
create table if not exists public.fia_race_upgrade_snapshots (
  season integer not null check (season between 1950 and 2100),
  round integer not null check (round between 1 and 40),
  document_hash text not null check (document_hash ~ '^[a-f0-9]{64}$'),
  artifact jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (season, round),
  constraint fia_snapshot_payload_valid check (
    jsonb_typeof(artifact) = 'object'
    and artifact ?& array['season', 'round', 'records', 'summaries']
    and jsonb_typeof(artifact->'records') = 'array'
    and jsonb_typeof(artifact->'summaries') = 'array'
    and (artifact->>'season')::integer = season
    and (artifact->>'round')::integer = round
  )
);
alter table public.fia_race_upgrade_snapshots enable row level security;
revoke all on public.fia_race_upgrade_snapshots from anon, authenticated;
grant select on public.fia_race_upgrade_snapshots to anon, authenticated;
grant select, insert, update on public.fia_race_upgrade_snapshots to service_role;
drop policy if exists "fia snapshots public read" on public.fia_race_upgrade_snapshots;
create policy "fia snapshots public read" on public.fia_race_upgrade_snapshots
  for select to anon, authenticated using (true);
commit;
