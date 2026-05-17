-- Store FIA Car Presentation Submissions upgrade records.
-- Source documents are FIA PDF decision documents published per Grand Prix.

create table if not exists public.fia_car_upgrades (
  id bigint generated always as identity primary key,
  source_record_key text not null,
  season integer not null,
  round integer,
  grand_prix text,
  team text not null,
  constructor_id text,
  car_number text,
  area text,
  component text,
  primary_reason text not null default 'Unknown',
  geometric_differences text,
  description text,
  component_importance numeric(4, 2) not null default 1,
  confidence numeric(4, 3) not null default 0,
  source_type text not null default 'FIA',
  document_title text,
  document_url text,
  source_path text,
  raw_text text not null,
  imported_at timestamptz not null default timezone('utc', now()),
  constraint fia_car_upgrades_source_record_key_unique
    unique (source_record_key),
  constraint fia_car_upgrades_source_type_check
    check (source_type = 'FIA'),
  constraint fia_car_upgrades_reason_check
    check (primary_reason in ('Performance', 'Circuit specific', 'Reliability', 'Cooling', 'Other', 'Unknown')),
  constraint fia_car_upgrades_confidence_check
    check (confidence >= 0 and confidence <= 1),
  constraint fia_car_upgrades_component_importance_check
    check (component_importance >= 0)
);

create index if not exists fia_car_upgrades_event_idx
  on public.fia_car_upgrades (season, round);

create index if not exists fia_car_upgrades_constructor_idx
  on public.fia_car_upgrades (constructor_id, season, round);

create index if not exists fia_car_upgrades_team_idx
  on public.fia_car_upgrades (team, season, round);

create index if not exists fia_car_upgrades_reason_idx
  on public.fia_car_upgrades (primary_reason);

create or replace view public.fia_car_upgrade_summaries as
select
  season,
  round,
  grand_prix,
  team,
  constructor_id,
  count(*)::integer as declared_upgrade_count,
  coalesce(sum(component_importance), 0)::numeric(8, 2) as declared_upgrade_intensity,
  coalesce(avg(case when primary_reason = 'Performance' then 1 else 0 end), 0)::numeric(5, 4) as performance_intent,
  coalesce(avg(case when primary_reason = 'Circuit specific' then 1 else 0 end), 0)::numeric(5, 4) as circuit_specific_intent,
  coalesce(avg(case when primary_reason = 'Reliability' then 1 else 0 end), 0)::numeric(5, 4) as reliability_intent,
  coalesce(avg(case when primary_reason = 'Cooling' then 1 else 0 end), 0)::numeric(5, 4) as cooling_intent,
  coalesce(max(component_importance), 0)::numeric(4, 2) as max_component_importance,
  max(imported_at) as last_imported_at
from public.fia_car_upgrades
group by season, round, grand_prix, team, constructor_id;

alter table public.fia_car_upgrades enable row level security;

drop policy if exists "fia car upgrades public read" on public.fia_car_upgrades;
create policy "fia car upgrades public read"
  on public.fia_car_upgrades
  for select
  using (true);
