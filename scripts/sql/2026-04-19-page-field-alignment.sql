alter table public.drivers
  add column if not exists total_points numeric,
  add column if not exists best_race_finish_position integer;

alter table public.constructors
  add column if not exists total_points numeric,
  add column if not exists best_race_finish_position integer;

alter table public.races
  add column if not exists circuit_name text,
  add column if not exists locality text,
  add column if not exists country text;
