begin;

-- Separate actual published forecast performance from offline backtest metrics.
create table if not exists public.prediction_evaluations (
  run_id uuid primary key references public.prediction_runs(id) on delete cascade,
  winner_driver_id text not null,
  winner_in_field boolean not null,
  winner_rank integer check (winner_rank > 0),
  winner_probability double precision not null check (winner_probability between 0 and 1),
  top1_hit boolean not null,
  top3_hit boolean not null,
  log_loss double precision not null check (log_loss >= 0),
  brier_score double precision not null check (brier_score >= 0),
  candidate_count integer not null check (candidate_count >= 15),
  scored_at timestamptz not null default now()
);

alter table public.prediction_evaluations enable row level security;
revoke all on public.prediction_evaluations from anon, authenticated;
grant select, insert, update on public.prediction_evaluations to service_role;

commit;
