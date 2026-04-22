create table if not exists public.driver_history_summary (
  driver_id text primary key,
  permanent_number text,
  code text,
  url text,
  given_name text not null,
  family_name text not null,
  date_of_birth date,
  nationality text,
  recent_constructor_name text,
  recent_constructor_id text,
  career_summary jsonb not null default '{}'::jsonb,
  best_race_finish jsonb,
  seasons jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.constructor_history_summary (
  constructor_id text primary key,
  url text,
  name text not null,
  nationality text,
  career_summary jsonb not null default '{}'::jsonb,
  best_race_finish jsonb,
  seasons jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists driver_history_summary_updated_at_idx
  on public.driver_history_summary (updated_at desc);

create index if not exists constructor_history_summary_updated_at_idx
  on public.constructor_history_summary (updated_at desc);
