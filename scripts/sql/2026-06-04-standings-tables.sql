-- Store pre-fetched season standings from the Jolpica Ergast API.
-- Populated by scripts/prefetch-jolpica-to-supabase.ts.
-- The frontend reads from these tables instead of calling the Jolpica API directly.

-- season_driver_standings: one row per driver per season

create table if not exists public.season_driver_standings (
  id bigint generated always as identity primary key,
  season int not null,
  position int not null,
  driver_id text not null,
  permanent_number text,
  code text,
  given_name text not null,
  family_name text not null,
  date_of_birth text,
  nationality text,
  constructor_id text not null,
  constructor_name text not null,
  points double precision not null default 0,
  wins int not null default 0,
  constraint season_driver_standings_unique unique (season, driver_id)
);

create index if not exists season_driver_standings_season_idx
  on public.season_driver_standings (season);

create index if not exists season_driver_standings_driver_idx
  on public.season_driver_standings (driver_id);

alter table public.season_driver_standings enable row level security;

drop policy if exists "season driver standings public read" on public.season_driver_standings;
create policy "season driver standings public read"
  on public.season_driver_standings
  for select
  using (true);

-- season_constructor_standings: one row per constructor per season

create table if not exists public.season_constructor_standings (
  id bigint generated always as identity primary key,
  season int not null,
  position int not null,
  constructor_id text not null,
  constructor_name text not null,
  nationality text,
  points double precision not null default 0,
  wins int not null default 0,
  constraint season_constructor_standings_unique unique (season, constructor_id)
);

create index if not exists season_constructor_standings_season_idx
  on public.season_constructor_standings (season);

create index if not exists season_constructor_standings_constructor_idx
  on public.season_constructor_standings (constructor_id);

alter table public.season_constructor_standings enable row level security;

drop policy if exists "season constructor standings public read" on public.season_constructor_standings;
create policy "season constructor standings public read"
  on public.season_constructor_standings
  for select
  using (true);
