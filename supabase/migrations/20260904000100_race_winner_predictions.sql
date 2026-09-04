begin;

create extension if not exists pgcrypto;

create table if not exists public.prediction_models (
  version text primary key,
  feature_schema_version integer not null check (feature_schema_version > 0),
  trained_through_season integer not null,
  trained_through_round integer not null,
  artifact jsonb not null,
  metrics jsonb not null default '{}'::jsonb,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists prediction_models_one_active_idx
  on public.prediction_models (is_active) where is_active;

create table if not exists public.prediction_runs (
  id uuid primary key default gen_random_uuid(),
  season integer not null check (season >= 1950),
  round integer not null check (round > 0),
  race_name text not null,
  phase text not null check (phase in ('pre_weekend', 'post_quali')),
  model_version text not null references public.prediction_models(version),
  input_hash text not null,
  generated_at timestamptz not null default now(),
  data_cutoff_at timestamptz not null,
  unique (season, round, phase, model_version, input_hash)
);

create index if not exists prediction_runs_lookup_idx
  on public.prediction_runs (season, round, generated_at desc);

create index if not exists prediction_runs_model_version_idx
  on public.prediction_runs (model_version);

create table if not exists public.prediction_candidates (
  run_id uuid not null references public.prediction_runs(id) on delete cascade,
  driver_id text not null,
  constructor_id text not null,
  rank integer not null check (rank > 0),
  probability double precision not null check (probability between 0 and 1),
  score double precision not null,
  factors jsonb not null default '[]'::jsonb,
  primary key (run_id, driver_id),
  unique (run_id, rank)
);

alter table public.prediction_models enable row level security;
alter table public.prediction_runs enable row level security;
alter table public.prediction_candidates enable row level security;

drop policy if exists "Public read prediction runs" on public.prediction_runs;
create policy "Public read prediction runs" on public.prediction_runs
  for select using (true);

drop policy if exists "Public read prediction candidates" on public.prediction_candidates;
create policy "Public read prediction candidates" on public.prediction_candidates
  for select using (true);

create or replace view public.race_prediction_current
with (security_invoker = true) as
select
  run.id as run_id,
  run.season,
  run.round,
  run.race_name,
  run.phase,
  run.model_version,
  run.generated_at,
  run.data_cutoff_at,
  coalesce(candidates.items, '[]'::jsonb) as candidates
from (
  select distinct on (season, round)
    id, season, round, race_name, phase, model_version, generated_at, data_cutoff_at
  from public.prediction_runs
  order by season, round, generated_at desc,
    case phase when 'post_quali' then 1 else 0 end desc
) as run
left join lateral (
  select jsonb_agg(jsonb_build_object(
    'driver_id', candidate.driver_id,
    'constructor_id', candidate.constructor_id,
    'rank', candidate.rank,
    'probability', candidate.probability,
    'factors', candidate.factors
  ) order by candidate.rank) as items
  from public.prediction_candidates as candidate
  where candidate.run_id = run.id
) as candidates on true;

grant select on public.race_prediction_current to anon, authenticated;
grant select on public.prediction_runs, public.prediction_candidates to anon, authenticated;
revoke all on public.prediction_models from anon, authenticated;

commit;
